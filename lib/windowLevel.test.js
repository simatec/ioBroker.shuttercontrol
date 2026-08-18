'use strict';

const { expect } = require('chai');
const { getWindowDownLevel, driveWindowLevel, clearWindowLevelTimers } = require('./windowLevel.js');

const SHUTTER_ID = 'zigbee.0.shutter.position';
const WINDOW_ID = 'javascript.0.window';

// currentShutterStateTime of the mock is 0.2s. The tests only have to tell a real wait from no
// wait at all, so the bound is kept below the configured time - Date.now() has a resolution of
// about 16ms on Windows and the tests run there as well.
const WAITED = 150;

/**
 * Builds an adapter mock with a window contact and a shutter position.
 *
 * @param {object} [options] windowValues (values the contact returns one after another),
 *                           shutterLevel, shutterAck
 * @returns {object} adapter mock, the driven values are collected in `writes`
 */
function adapterMock(options) {
    const opts = Object.assign({ windowValues: ['true'], shutterLevel: 0, shutterAck: true }, options);
    const writes = [];
    const timers = { started: 0, cleared: 0 };
    let windowReads = 0;

    return {
        writes,
        timers,
        config: { shutterStateRound: 1, currentShutterStateTime: 0.2 },
        log: { info: () => { }, debug: () => { }, warn: () => { }, error: () => { } },
        async getForeignStateAsync(id) {
            if (id === WINDOW_ID) {
                const value = opts.windowValues[Math.min(windowReads, opts.windowValues.length - 1)];
                windowReads++;
                return { val: value, ack: true };
            }
            return { val: opts.shutterLevel, ack: opts.shutterAck };
        },
        async setForeignStateAsync(id, val) {
            writes.push({ id, val });
            opts.shutterLevel = val;
        },
        async setStateAsync() { },
        // the adapter timers of the js-controller, they are cleared when the adapter is killed
        setTimeout(cb, ms) {
            timers.started++;
            return opts.noTimer === true ? undefined : global.setTimeout(cb, ms);
        },
        clearTimeout(timer) {
            timers.cleared++;
            global.clearTimeout(timer);
        },
    };
}

/**
 * Builds a shutter setting with the feature enabled and a window contact that reports
 * 'false' when closed and 'true' when open. The heights are the ones already configured
 * for the trigger.
 *
 * @param {object} [overrides] properties to overwrite
 * @returns {object} shutter settings
 */
function settings(overrides) {
    return Object.assign(
        {
            shutterName: 'test shutter',
            name: SHUTTER_ID,
            triggerID: WINDOW_ID,
            triggerState: 'false',
            triggerStateTilted: 'none',
            useOpenWindowLevel: true,
            triggerDrive: '30',
            triggerDriveTildet: '15',
        },
        overrides,
    );
}

describe('windowLevel => getWindowDownLevel', () => {
    it('returns null when the feature is disabled', () => {
        expect(getWindowDownLevel(settings({ useOpenWindowLevel: false }), 'true', 'down')).to.equal(null);
    });

    it('returns null when the feature flag is missing', () => {
        const cfg = settings();
        delete cfg.useOpenWindowLevel;
        expect(getWindowDownLevel(cfg, 'true', 'down')).to.equal(null);
    });

    it('returns null when the shutter settings are missing', () => {
        expect(getWindowDownLevel(undefined, 'true', 'down')).to.equal(null);
    });

    it('returns null while a frost alarm is active', () => {
        expect(getWindowDownLevel(settings(), 'true', 'frost')).to.equal(null);
    });

    it('returns null when no window contact is configured', () => {
        expect(getWindowDownLevel(settings({ triggerID: '' }), 'true', 'down')).to.equal(null);
    });

    it('returns null when the contact has no value', () => {
        expect(getWindowDownLevel(settings(), '', 'down')).to.equal(null);
    });

    it('returns null when the closed state of the contact is unknown', () => {
        expect(getWindowDownLevel(settings({ triggerState: 'none' }), 'true', 'down')).to.equal(null);
    });

    it('returns null when the window is closed', () => {
        expect(getWindowDownLevel(settings(), 'false', 'down')).to.equal(null);
    });

    it('returns the trigger height when the window is open and no tilted state is configured', () => {
        expect(getWindowDownLevel(settings(), 'true', 'down')).to.deep.equal({ level: 30, tilted: false });
    });

    it('returns the trigger height when the window is open and a tilted state is configured', () => {
        const cfg = settings({ triggerState: '0', triggerStateTilted: '1' });
        expect(getWindowDownLevel(cfg, '2', 'down')).to.deep.equal({ level: 30, tilted: false });
    });

    it('returns the tilted trigger height when the window is tilted', () => {
        const cfg = settings({ triggerState: '0', triggerStateTilted: '1' });
        expect(getWindowDownLevel(cfg, '1', 'down')).to.deep.equal({ level: 15, tilted: true });
    });

    it('handles numeric contact values', () => {
        const cfg = settings({ triggerState: '0', triggerStateTilted: '1' });
        expect(getWindowDownLevel(cfg, 1, 'down')).to.deep.equal({ level: 15, tilted: true });
        expect(getWindowDownLevel(cfg, 0, 'down')).to.equal(null);
    });

    it('handles boolean contact values', () => {
        expect(getWindowDownLevel(settings(), true, 'down')).to.deep.equal({ level: 30, tilted: false });
        expect(getWindowDownLevel(settings(), false, 'down')).to.equal(null);
    });

    it('accepts a trigger height of 0', () => {
        expect(getWindowDownLevel(settings({ triggerDrive: '0' }), 'true', 'down')).to.deep.equal({
            level: 0,
            tilted: false,
        });
    });

    it('accepts numeric trigger heights', () => {
        expect(getWindowDownLevel(settings({ triggerDrive: 45 }), 'true', 'down')).to.deep.equal({
            level: 45,
            tilted: false,
        });
    });

    it('returns null when the trigger height is empty', () => {
        expect(getWindowDownLevel(settings({ triggerDrive: '' }), 'true', 'down')).to.equal(null);
    });

    it('returns null when the trigger height is not a number', () => {
        expect(getWindowDownLevel(settings({ triggerDrive: 'abc' }), 'true', 'down')).to.equal(null);
    });

    it('overrides the intermediate position level', () => {
        expect(getWindowDownLevel(settings(), 'true', 'middle')).to.deep.equal({ level: 30, tilted: false });
    });

    it('overrides the xmas level', () => {
        expect(getWindowDownLevel(settings(), 'true', 'Xmas')).to.deep.equal({ level: 30, tilted: false });
    });
});

describe('windowLevel => driveWindowLevel', () => {
    it('drives to the ventilation height when the window is open', async () => {
        const cfg = settings();
        const adapter = adapterMock();

        await driveWindowLevel(adapter, [cfg], cfg, 0, 'down', 'test_shutter');

        expect(adapter.writes).to.deep.equal([{ id: SHUTTER_ID, val: 30 }]);
    });

    it('drives to the tilted height when the window is tilted', async () => {
        const cfg = settings({ triggerState: '0', triggerStateTilted: '1' });
        const adapter = adapterMock({ windowValues: ['1'] });

        await driveWindowLevel(adapter, [cfg], cfg, 0, 'down', 'test_shutter');

        expect(adapter.writes).to.deep.equal([{ id: SHUTTER_ID, val: 15 }]);
    });

    it('remembers the ventilation height as current height and marks the shutter as triggered', async () => {
        const cfg = settings();
        const adapter = adapterMock();

        await driveWindowLevel(adapter, [cfg], cfg, 0, 'down', 'test_shutter');

        expect(cfg.currentHeight).to.equal(30);
        expect(cfg.currentAction).to.equal('triggered');
    });

    it('remembers the closed position as old height, so the status check does not report a manual drive', async () => {
        const cfg = settings({ oldHeight: 100 });
        const adapter = adapterMock();

        await driveWindowLevel(adapter, [cfg], cfg, 0, 'down', 'test_shutter');

        // the shutter really was at the closed position right before this drive - without that
        // the status check of main.js compares the still reported closed position against the
        // new current height, finds neither, and switches the shutter to Manu_Mode
        expect(cfg.oldHeight).to.equal(0);
    });

    it('does not drive when the window is closed', async () => {
        const cfg = settings();
        const adapter = adapterMock({ windowValues: ['false'] });

        await driveWindowLevel(adapter, [cfg], cfg, 0, 'down', 'test_shutter');

        expect(adapter.writes).to.deep.equal([]);
    });

    it('does not drive when the feature is disabled', async () => {
        const cfg = settings({ useOpenWindowLevel: false });
        const adapter = adapterMock();

        await driveWindowLevel(adapter, [cfg], cfg, 0, 'down', 'test_shutter');

        expect(adapter.writes).to.deep.equal([]);
    });

    it('does not drive while a frost alarm is active', async () => {
        const cfg = settings();
        const adapter = adapterMock();

        await driveWindowLevel(adapter, [cfg], cfg, 0, 'frost', 'test_shutter');

        expect(adapter.writes).to.deep.equal([]);
    });

    it('does not drive when the ventilation height is the closed position', async () => {
        const cfg = settings({ triggerDrive: '0' });
        const adapter = adapterMock();

        await driveWindowLevel(adapter, [cfg], cfg, 0, 'down', 'test_shutter');

        expect(adapter.writes).to.deep.equal([]);
    });

    it('does not drive when the shutter is already at the ventilation height', async () => {
        const cfg = settings();
        const adapter = adapterMock({ shutterLevel: 30 });

        await driveWindowLevel(adapter, [cfg], cfg, 0, 'down', 'test_shutter');

        expect(adapter.writes).to.deep.equal([]);
    });

    it('stays closed when the window is closed while the shutter is moving', async () => {
        const cfg = settings();
        // the contact reports open first and closed from the second read on
        const adapter = adapterMock({ windowValues: ['true', 'false'] });

        await driveWindowLevel(adapter, [cfg], cfg, 0, 'down', 'test_shutter');

        expect(adapter.writes).to.deep.equal([]);
    });

    it('drives after the fallback time when the position is never confirmed', async () => {
        const cfg = settings();
        const adapter = adapterMock({ shutterAck: false });

        const start = Date.now();
        await driveWindowLevel(adapter, [cfg], cfg, 0, 'down', 'test_shutter');

        expect(adapter.writes).to.deep.equal([{ id: SHUTTER_ID, val: 30 }]);
        expect(Date.now() - start).to.be.at.least(WAITED);
    });

    it('waits the shutter run time even when the position is acknowledged at once', async () => {
        const cfg = settings();
        // zigbee2mqtt and others report the target position with an acknowledged value right
        // after the command, long before the motor has finished moving
        const adapter = adapterMock();

        const start = Date.now();
        await driveWindowLevel(adapter, [cfg], cfg, 0, 'down', 'test_shutter');

        expect(adapter.writes).to.deep.equal([{ id: SHUTTER_ID, val: 30 }]);
        expect(Date.now() - start).to.be.at.least(WAITED);
    });

    it('waits with the adapter timer, not with a plain setTimeout', async () => {
        const cfg = settings();
        const adapter = adapterMock();

        await driveWindowLevel(adapter, [cfg], cfg, 0, 'down', 'test_shutter');

        expect(adapter.timers.started).to.be.at.least(1);
    });

    it('does not drive when the adapter no longer schedules timers', async () => {
        const cfg = settings();
        // setTimeout of the adapter returns undefined once the adapter is shutting down
        const adapter = adapterMock({ noTimer: true });

        await driveWindowLevel(adapter, [cfg], cfg, 0, 'down', 'test_shutter');

        expect(adapter.writes).to.deep.equal([]);
    });

    // has to stay the last test - clearWindowLevelTimers marks the module as unloaded for good
    it('stops a pending drive and clears the adapter timer on unload', async () => {
        const cfg = settings();
        const adapter = adapterMock();

        const drive = driveWindowLevel(adapter, [cfg], cfg, 0, 'down', 'test_shutter');

        // wait until the drive really is in the waiting time - a fixed pause would be too short
        // on a loaded machine and the timer would not be running yet
        while (adapter.timers.started === 0) {
            await new Promise((resolve) => global.setTimeout(resolve, 5));
        }

        clearWindowLevelTimers(adapter);
        await drive;

        expect(adapter.timers.cleared).to.be.at.least(1);
        expect(adapter.writes).to.deep.equal([]);
    });
});
