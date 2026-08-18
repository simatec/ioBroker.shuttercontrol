'use strict';

const setShutterState = require('./setShutter.js').setShutterState;                 // set Shutter State

// running wait timers per shutter, so they can be cleared on unload
const windowLevelTimers = new Map();
let unloaded = false;

/**
 * Determines the shutter level to use when the window or door is open or tilted.
 *
 * The window contact is only used as a drive permission by the automatic modes - it never
 * changes the target level. The heights already configured for the trigger (triggerDrive and
 * triggerDriveTildet) are applied by triggerChange.js when the contact changes state, but not
 * when an automatic mode closes the shutter. This helper reuses exactly those heights, so an
 * open or tilted window ends up in the same position no matter what started the drive.
 *
 * Returns null whenever the standard target level has to be kept, so the calling module
 * stays on its original code path.
 *
 * @param {object} currentShutterSettings settings of the shutter to check
 * @param {string} currentValue current value of the window / door contact
 * @param {string} downAction planned action of the automatic mode ('down', 'middle', 'Xmas', 'frost')
 * @returns {{level: number, tilted: boolean}|null} level to drive to or null to keep the standard level
 */
function getWindowDownLevel(currentShutterSettings, currentValue, downAction) {
    if (!currentShutterSettings || currentShutterSettings.useOpenWindowLevel !== true) {
        return null;
    }

    // an active frost alarm always wins - it is a protective function
    if (downAction === 'frost') {
        return null;
    }

    // no window contact configured or no value available
    if (!currentShutterSettings.triggerID || currentValue === '' || currentValue === null || currentValue === undefined) {
        return null;
    }

    const mustValue = `${currentShutterSettings.triggerState}`;

    // the closed state of the contact is unknown, so the window state cannot be determined
    if (mustValue === 'none') {
        return null;
    }

    // window is closed - keep the standard level
    if (`${currentValue}` === mustValue) {
        return null;
    }

    const tiltedState = `${currentShutterSettings.triggerStateTilted}`;
    const tilted = tiltedState !== 'none' && tiltedState !== 'undefined' && `${currentValue}` === tiltedState;

    const configuredLevel = tilted ? currentShutterSettings.triggerDriveTildet : currentShutterSettings.triggerDrive;

    if (configuredLevel === null || configuredLevel === undefined || configuredLevel === '') {
        return null;
    }

    const level = parseFloat(configuredLevel);

    if (isNaN(level)) {
        return null;
    }

    return { level: level, tilted: tilted };
}

/**
 * Waits for the given time and keeps the timer so it can be cleared on unload.
 *
 * The timer of the adapter is used instead of a plain setTimeout, so the js-controller
 * removes it as well when the adapter is killed.
 *
 * @param adapter adapter instance
 * @param {string} shutterName name of the shutter the timer belongs to
 * @param {number} ms time to wait
 * @returns {Promise<boolean>} true when the time has passed, false when the adapter is shutting down
 */
async function sleep(adapter, shutterName, ms) {
    return new Promise((resolve) => {
        const timer = adapter.setTimeout(() => {
            windowLevelTimers.delete(shutterName);
            // @ts-ignore
            resolve(true);
        }, ms);

        // the adapter does not schedule anything anymore while it is shutting down
        if (!timer) {
            // @ts-ignore
            resolve(false);
            return;
        }

        // the resolve is kept as well, so clearing the timers does not leave the wait pending
        windowLevelTimers.set(shutterName, { timer: timer, resolve: resolve });
    });
}

/**
 * Reads the current value of the window / door contact.
 *
 * @param adapter adapter instance
 * @param {object} currentShutterSettings settings of the shutter to check
 * @returns {Promise<string>} current value of the contact or an empty string
 */
async function getTriggerValue(adapter, currentShutterSettings) {
    const _triggerState = currentShutterSettings.triggerID != ''
        ? await adapter.getForeignStateAsync(currentShutterSettings.triggerID).catch((e) => adapter.log.warn(e))
        : null;

    return _triggerState?.val !== null && _triggerState?.val !== undefined ? (`${_triggerState.val}`) : '';
}

/**
 * Waits until the shutter has finished the drive to the closed position.
 *
 * An acknowledged position is not a proof that the drive is over: several devices - zigbee2mqtt
 * is one of them - report the target position with an acknowledged value within milliseconds of
 * receiving the command and stay silent for the rest of the drive. A second command sent while
 * the motor is still running is lost, the device then reports the new level without ever having
 * moved to it. currentShutterStateTime is the time the adapter already uses everywhere else to
 * wait for a finished drive, so it is the wait time of the second drive as well.
 *
 * @param adapter adapter instance
 * @param {object} currentShutterSettings settings of the shutter to check
 * @param {number} closedLevel level the automatic mode has just driven to
 * @returns {Promise<boolean>} true when the run time has passed, false when the adapter is shutting down
 */
async function waitForPosition(adapter, currentShutterSettings, closedLevel) {
    const shutterStateRound = adapter.config.shutterStateRound ? adapter.config.shutterStateRound : 1;
    const runTime = adapter.config.currentShutterStateTime ? adapter.config.currentShutterStateTime * 1000 : 60000;

    const waited = await sleep(adapter, currentShutterSettings.shutterName, runTime);

    if (!waited || unloaded) {
        return false;
    }

    const _shutterState = await adapter.getForeignStateAsync(currentShutterSettings.name).catch((e) => adapter.log.warn(e));

    if (_shutterState?.val !== null &&
        _shutterState?.val !== undefined &&
        Math.round(parseFloat(_shutterState.val) / shutterStateRound) * shutterStateRound == closedLevel) {

        adapter.log.debug(`${currentShutterSettings.shutterName} - closed position ${closedLevel}% reached after ${runTime / 1000}s`);
    } else {
        adapter.log.debug(`${currentShutterSettings.shutterName} - closed position ${closedLevel}% was not reached within ${runTime / 1000}s - driving anyway`);
    }

    return true;
}

/**
 * Drives to the ventilation height after an automatic mode has closed the shutter.
 *
 * The shutter is closed completely first and only then moved up to the ventilation height.
 * Driving up from the closed end position is the same direction the trigger uses, so the
 * configured percentage always ends up at the same physical position - shutter motors are
 * usually faster downwards than upwards, which means the same percentage reached from above
 * is a different position than reached from below.
 *
 * Does nothing when the feature is disabled, the window is closed, a frost alarm is active or
 * the shutter is already at the ventilation height. The window is checked again after the wait,
 * so a window closed in the meantime keeps the shutter closed.
 *
 * @param adapter adapter instance
 * @param {Array} shutterSettings settings of all shutters
 * @param {object} currentShutterSettings settings of the shutter to drive
 * @param {number} closedLevel level the automatic mode has just driven to
 * @param {string} downAction action of the automatic mode ('down', 'middle', 'Xmas', 'frost')
 * @param {string} nameDevice name of the shutter used for the states
 * @returns {Promise<void>} resolves when the drive is done or nothing had to be done
 */
async function driveWindowLevel(adapter, shutterSettings, currentShutterSettings, closedLevel, downAction, nameDevice) {
    try {
        const windowDown = getWindowDownLevel(currentShutterSettings, await getTriggerValue(adapter, currentShutterSettings), downAction);

        if (windowDown === null) {
            return;
        }

        if (windowDown.level == closedLevel) {
            adapter.log.debug(`${currentShutterSettings.shutterName} - ventilation height ${windowDown.level}% is the closed position - nothing to do`);
            return;
        }

        adapter.log.info(`${currentShutterSettings.shutterName}: window is ${windowDown.tilted ? 'tilted' : 'open'} - driving to ${windowDown.level}% after reaching ${closedLevel}%`);

        const waited = await waitForPosition(adapter, currentShutterSettings, closedLevel);

        // the adapter is shutting down - the shutter stays where it is
        if (!waited || unloaded) {
            return;
        }

        // the window can have been closed while the shutter was moving - then it stays closed
        const currentValue = await getTriggerValue(adapter, currentShutterSettings);

        if (getWindowDownLevel(currentShutterSettings, currentValue, downAction) === null) {
            adapter.log.info(`${currentShutterSettings.shutterName}: window was closed while driving - staying at ${closedLevel}%`);
            return;
        }

        const shutterStateRound = adapter.config.shutterStateRound ? adapter.config.shutterStateRound : 1;
        const _shutterState = await adapter.getForeignStateAsync(currentShutterSettings.name).catch((e) => adapter.log.warn(e));

        if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
            Math.round(parseFloat(_shutterState.val) / shutterStateRound) * shutterStateRound == windowDown.level) {

            adapter.log.debug(`${currentShutterSettings.shutterName} - already at the ventilation height ${windowDown.level}%`);
            return;
        }

        /*
            The shutter has just been at the closed position, so that is its old height now. The
            status check of main.js compares the reported position against currentHeight and
            oldHeight and treats a position that matches neither as a manual drive. Its checks for
            the first drive end a few milliseconds after this second one starts - the device has
            not acknowledged the new level by then and still reports the closed position, which
            would be taken for Manu_Mode without the correct old height.
        */
        currentShutterSettings.oldHeight = closedLevel;

        // the darkening height stays in triggerHeight, so triggerChange.js drives to it once the window is closed
        currentShutterSettings.currentHeight = windowDown.level;
        currentShutterSettings.currentAction = 'triggered';

        await setShutterState(adapter, shutterSettings, currentShutterSettings, windowDown.level, nameDevice, 'Window open #30');
    } catch (e) {
        adapter.log.error(`exception catch driveWindowLevel [${e instanceof Error ? e.message : String(e)}]`);
    }
}

/**
 * Clears all running wait timers and stops pending drives.
 *
 * The js-controller clears the adapter timers on its own, but the waits are resolved here as
 * well, so no drive is left pending while the adapter shuts down.
 *
 * @param adapter adapter instance
 */
function clearWindowLevelTimers(adapter) {
    unloaded = true;

    for (const pending of windowLevelTimers.values()) {
        adapter.clearTimeout(pending.timer);
        pending.resolve(false);
    }

    windowLevelTimers.clear();
}

module.exports = {
    getWindowDownLevel,
    driveWindowLevel,
    clearWindowLevelTimers,
};
