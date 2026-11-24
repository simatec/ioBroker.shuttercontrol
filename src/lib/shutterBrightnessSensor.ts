import { checkPendingAlarm, checkFrostAlarm } from './shutterAlarm';
import { setShutterState, setShutterInfo } from './setShutter';
import { CheckInSummerNotDown, GetXmasLevel } from './isSummerTime';
import { driveWindowLevel } from './windowLevel';
import type { ShutterSettings } from './types';

/**
 * @param [d]
 */
function getDate(d?: Date): string {
    d = d || new Date();
    return `${(`0${  d.getHours()}`).slice(-2)  }:${  (`0${  d.getMinutes()}`).slice(-2)}`;
}

/**
 * Evaluates whether the brightness requires the shutters to be down
 *
 * @param adapter adapter instance
 * @param brightnessValue current brightness value
 * @param brightnessDown current brightness down state
 */
export function brightnessState(adapter: ioBroker.Adapter, brightnessValue: number, brightnessDown: boolean): boolean {
    const shutterDownBrightness = adapter.config.lightsensorDown;
    const shutterUpBrightness = adapter.config.lightsensorUp;
    const shutterDownBrightnessTime = adapter.config.lightsensorDownTime;
    const shutterUpBrightnessTime = adapter.config.lightsensorUpTime;
    const currentTime = getDate();

    if (currentTime > shutterDownBrightnessTime && brightnessValue <= shutterDownBrightness) {
        brightnessDown = true;
        return (brightnessDown);
    } else if (currentTime >= shutterUpBrightnessTime && brightnessValue > shutterUpBrightness) {
        brightnessDown = false;
        return (brightnessDown);
    } else {
        brightnessDown = false;
        return (brightnessDown);
    }
}

/**
 * Drives the shutters of type lightsensor up or down depending on the brightness
 *
 * @param adapter adapter instance
 * @param brightnessValue current brightness value
 * @param shutterSettings all shutter settings
 * @param brightnessDown current brightness down state
 */
export async function shutterBrightnessSensor(adapter: ioBroker.Adapter, brightnessValue: number, shutterSettings: ShutterSettings[], brightnessDown: boolean): Promise<ShutterSettings[] | undefined> {
    const shutterDownBrightness = adapter.config.lightsensorDown;
    const shutterUpBrightness = adapter.config.lightsensorUp;
    const shutterDownBrightnessTime = adapter.config.lightsensorDownTime;
    const shutterUpBrightnessTime = adapter.config.lightsensorUpTime;
    const driveDelayAstro = adapter.config.driveDelayUpAstro != 0 ? adapter.config.driveDelayUpAstro * 1000 : 20;
    const currentTime = getDate();

    if (currentTime >= shutterDownBrightnessTime &&
        brightnessValue <= shutterDownBrightness &&
        brightnessDown == false) {

        if (shutterSettings) {
            const resLiving = shutterSettings.filter((d) => d.typeDown == 'lightsensor'); // Filter Area Living
            const result = resLiving.filter((d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

            for (const i in result) {
                for (const s in shutterSettings) {
                    if (shutterSettings[s].shutterName == result[i].shutterName) {
                        const inSummerNotDown = await CheckInSummerNotDown(adapter, shutterSettings[s]);
                        const XmasLevel = await GetXmasLevel(adapter, shutterSettings[s]);
                        const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                        const pendingAlarm = await checkPendingAlarm(adapter, shutterSettings[s]);
                        const statusAlarmFrost = await checkFrostAlarm(adapter, shutterSettings[s]);

                        let targetLevel2Set = 0;
                        let downAction = 'down';

                        if (getDate() < adapter.config.betweenPositionTime) {
                            // between Position Level
                            targetLevel2Set = shutterSettings[s].betweenPosition == true ? parseFloat(String(shutterSettings[s].betweenPositionLevel)) : parseFloat(String(shutterSettings[s].heightDown));
                            downAction = shutterSettings[s].betweenPosition == true ? 'middle' : 'down';
                        } else {
                            targetLevel2Set = parseFloat(String(shutterSettings[s].heightDown));
                            downAction = 'down';
                        }

                        targetLevel2Set = XmasLevel > -1 ? XmasLevel : targetLevel2Set; // xmas level or standard down level
                        downAction = XmasLevel > -1 ? 'Xmas' : downAction; // xmas Action or standard down Action

                        // save current required position to alarmtrigger before overwriting
                        shutterSettings[s].alarmTriggerLevel = targetLevel2Set;
                        shutterSettings[s].alarmTriggerAction = downAction;

                        // overwrite target position and downAction if frost alarm is set.
                        if (statusAlarmFrost == true &&
                            shutterSettings[s].enableAlarmFrost == true &&
                            downAction != 'Xmas') {

                            targetLevel2Set = parseFloat(String(adapter.config.alarmFrostLevel));
                            downAction = 'frost';
                        }

                        if (!inSummerNotDown) {
                            const _autoDownState = await adapter.getStateAsync(`shutters.autoDown.${nameDevice}`).catch((e) => adapter.log.warn(e));

                            if (_autoDownState?.val === true) {
                                if (shutterSettings[s].currentAction != 'triggered' ||
                                    (shutterSettings[s].currentAction as string) != 'triggered_Tilted' ||
                                    (shutterSettings[s].currentAction as string) != 'down') {

                                    if (pendingAlarm == false) {
                                        const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;
                                        const mustValue = (`${  shutterSettings[s].triggerState}`);
                                        const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? (`${  shutterSettings[s].triggerState}`) : (`${  shutterSettings[s].triggerStateTilted}`);
                                        const currentValue = _triggerState?.val !== null && _triggerState?.val !== undefined ? (`${  _triggerState.val}`) : '';

                                        if (currentValue === mustValue ||
                                            currentValue === mustValueTilted ||
                                            (currentValue != mustValue &&
                                                currentValue != mustValueTilted &&
                                                shutterSettings[s].autoDrive != 'onlyUp' &&
                                                shutterSettings[s].autoDrive != 'off')) {

                                            const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                            if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                                Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set &&
                                                shutterSettings[s].triggerAction != 'down') {

                                                shutterSettings[s].currentHeight = targetLevel2Set;
                                                shutterSettings[s].currentAction = downAction;
                                                shutterSettings[s].lastAutoAction = 'Down_Brightness';
                                                shutterSettings[s].triggerHeight = targetLevel2Set; // reset Trigger
                                                shutterSettings[s].triggerAction = downAction;      // reset Trigger

                                                await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Lightsensor #8');

                                                adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                adapter.log.debug(`save current height: ${shutterSettings[s].currentHeight}% from ${shutterSettings[s].shutterName}`);
                                            } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                                Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set && (shutterSettings[s].currentHeight != targetLevel2Set ||
                                                    shutterSettings[s].currentAction != downAction)) {

                                                shutterSettings[s].currentHeight = targetLevel2Set;
                                                shutterSettings[s].currentAction = downAction;

                                                await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                                adapter.log.debug(`Lightsensor down ${shutterSettings[s].shutterName} already down at: ${targetLevel2Set}% - setting current action: ${shutterSettings[s].currentAction}`);
                                            }

                                            // the shutter is closed first and only then moved to the ventilation height
                                            driveWindowLevel(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, downAction, nameDevice)
                                                .catch((e) => adapter.log.warn(`#driveWindowLevel: ${e}`));
                                        } else if (shutterSettings[s].triggerID == '') {
                                            const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                            if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                                Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set &&
                                                (Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterSettings[s].heightDownSun ||
                                                    Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterSettings[s].heightUp ||
                                                    Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterSettings[s].triggerDrive)) {

                                                shutterSettings[s].currentHeight = targetLevel2Set;
                                                shutterSettings[s].currentAction = downAction;
                                                shutterSettings[s].lastAutoAction = 'Down_Brightness';

                                                await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Lightsensor #9');

                                                adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                adapter.log.debug(`save current height: ${shutterSettings[s].currentHeight}% from ${shutterSettings[s].shutterName}`);
                                            } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                                Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set &&
                                                (shutterSettings[s].currentHeight != targetLevel2Set ||
                                                    shutterSettings[s].currentAction != downAction)) {

                                                shutterSettings[s].currentHeight = targetLevel2Set;
                                                shutterSettings[s].currentAction = downAction;

                                                await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                                adapter.log.debug(`Lightsensor down ${shutterSettings[s].shutterName} already down at: ${targetLevel2Set}% - setting current action: ${shutterSettings[s].currentAction}`);
                                            }

                                        } else if (currentValue != mustValue &&
                                            currentValue != mustValueTilted &&
                                            shutterSettings[s].driveAfterClose == true) {

                                            const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                            if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                                Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set &&
                                                (Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterSettings[s].heightDownSun ||
                                                    Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterSettings[s].heightUp ||
                                                    Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterSettings[s].triggerDrive)) {

                                                shutterSettings[s].triggerHeight = targetLevel2Set;
                                                shutterSettings[s].triggerAction = downAction;

                                                adapter.log.info(`Lightsensor #4 Will close ID: ${shutterSettings[s].shutterName} value: ${targetLevel2Set}% after the window has been closed`);
                                                adapter.log.debug(`save new trigger height: ${targetLevel2Set}%`);
                                                adapter.log.debug(`save new trigger action: ${shutterSettings[s].triggerAction}`);
                                            }
                                        }
                                        await adapter.delay(driveDelayAstro);
                                    } else {
                                        adapter.log.info(`Brighness down not moving now due to active alarm: ${shutterSettings[s].shutterName} value: ${targetLevel2Set}%`);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return (shutterSettings);
        }
    } else if (currentTime > shutterUpBrightnessTime &&
        currentTime < shutterDownBrightnessTime &&
        brightnessValue > shutterUpBrightness) {

        if (shutterSettings) {
            const resLiving = shutterSettings.filter((d) => d.typeUp == 'lightsensor'); // Filter Area Living
            const result = resLiving.filter((d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

            for (const i in result) {
                for (const s in shutterSettings) {
                    if (shutterSettings[s].shutterName == result[i].shutterName) {
                        const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                        const pendingAlarm = await checkPendingAlarm(adapter, shutterSettings[s]);

                        const _autoUpState = await adapter.getStateAsync(`shutters.autoUp.${nameDevice}`).catch((e) => adapter.log.warn(e));

                        if (_autoUpState?.val === true) {
                            if (pendingAlarm == false) {
                                let shutterHeight = 0;
                                if (shutterSettings[s].currentAction == 'sunProtect' ||
                                    shutterSettings[s].currentAction == 'OpenInSunProtect') {

                                    shutterHeight = parseFloat(String(shutterSettings[s].heightDownSun));
                                    shutterSettings[s].currentAction = 'sunProtect';
                                } else {
                                    shutterHeight = parseFloat(String(shutterSettings[s].heightUp));
                                    shutterSettings[s].currentAction = 'up';
                                }

                                // saving current required values to alarmtrigger
                                shutterSettings[s].alarmTriggerLevel = shutterHeight;
                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;


                                const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;
                                const mustValue = (`${  shutterSettings[s].triggerState}`);
                                const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? (`${  shutterSettings[s].triggerState}`) : (`${  shutterSettings[s].triggerStateTilted}`);
                                const currentValue = _triggerState?.val !== null && _triggerState?.val !== undefined ? (`${  _triggerState.val}`) : '';

                                if (pendingAlarm == false) {
                                    if (currentValue === mustValue ||
                                        currentValue === mustValueTilted ||
                                        (currentValue != mustValue &&
                                            currentValue != mustValueTilted &&
                                            shutterSettings[s].autoDrive != 'onlyDown' &&
                                            shutterSettings[s].autoDrive != 'off')) {

                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterHeight &&
                                            shutterSettings[s].lastAutoAction != 'up_Brightness') {

                                            shutterSettings[s].currentHeight = shutterHeight;
                                            shutterSettings[s].lastAutoAction = 'up_Brightness';
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight; // reset Trigger
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction; // reset Trigger

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], shutterHeight, nameDevice, 'Lightsensor #5');

                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                            adapter.log.debug(`save current height: ${  shutterSettings[s].currentHeight  }%` + ` from ${  shutterSettings[s].shutterName}`);
                                        } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterHeight) {

                                            shutterSettings[s].currentHeight = shutterHeight;
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight; // reset Trigger
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction; // reset Trigger

                                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                            adapter.log.debug(`Lightsensor up ${shutterSettings[s].shutterName} already up at: ${shutterSettings[s].heightUp}% - setting current action: ${shutterSettings[s].currentAction}`);
                                        }

                                    } else if (shutterSettings[s].triggerID == '') {
                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterHeight &&
                                            shutterSettings[s].lastAutoAction != 'up_Brightness') {

                                            shutterSettings[s].currentHeight = shutterHeight;
                                            shutterSettings[s].lastAutoAction = 'up_Brightness';

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], shutterHeight, nameDevice, 'Lightsensor #6');

                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                            adapter.log.debug(`save current height: ${shutterSettings[s].currentHeight}% from ${shutterSettings[s].shutterName}`);
                                        } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterHeight) {

                                            shutterSettings[s].currentHeight = shutterHeight;
                                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                            adapter.log.debug(`Lightsensor up ${shutterSettings[s].shutterName} already up at: ${shutterSettings[s].heightUp}% - setting current action: ${shutterSettings[s].currentAction}`);
                                        }

                                    } else if (currentValue != mustValue &&
                                        currentValue != mustValueTilted &&
                                        shutterSettings[s].driveAfterClose == true) {

                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterHeight) {

                                            shutterSettings[s].triggerHeight = shutterHeight;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            adapter.log.info(`Lightsensor #7 Will open ID: ${shutterSettings[s].shutterName} value: ${shutterHeight}% after the window has been closed`);
                                            adapter.log.debug(`save new trigger height: ${shutterHeight}%`);
                                            adapter.log.debug(`save new trigger action: ${shutterSettings[s].triggerAction}`);
                                        } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterHeight) {

                                            shutterSettings[s].triggerHeight = shutterHeight;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            adapter.log.info(`Lightsensor #8 Will open ID: ${shutterSettings[s].shutterName} value: ${shutterHeight}% after is the value for Lightsensor up`);
                                            adapter.log.debug(`save new trigger height: ${shutterHeight}%`);
                                            adapter.log.debug(`save new trigger action: ${shutterSettings[s].triggerAction}`);
                                        }
                                    }
                                }
                                await adapter.delay(driveDelayAstro);
                            } else {
                                let shutterHeight = 0;

                                if (shutterSettings[s].currentAction == 'sunProtect' ||
                                    shutterSettings[s].currentAction == 'OpenInSunProtect') {

                                    shutterHeight = parseFloat(String(shutterSettings[s].heightDownSun));
                                } else {
                                    shutterHeight = parseFloat(String(shutterSettings[s].heightUp));
                                }
                                adapter.log.info(`Brighness up not moving now due to active alarm: ${shutterSettings[s].shutterName} value: ${shutterHeight}%`);
                            }
                        }
                    }
                }
            }
            return (shutterSettings);
        }
    }
}

