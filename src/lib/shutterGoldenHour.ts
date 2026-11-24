import * as schedule from 'node-schedule';
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
    return `${(`0${d.getHours()}`).slice(-2)}:${(`0${d.getMinutes()}`).slice(-2)}`;
}

/**
 * Schedules the goldenhour end (up) and goldenhour (down) jobs
 *
 * @param adapter adapter instance
 * @param goldenHourEnd time of the goldenhour end (HH:MM)
 * @param goldenHour time of the goldenhour (HH:MM)
 * @param shutterSettings all shutter settings
 */
export async function shutterGoldenHour(adapter: ioBroker.Adapter, goldenHourEnd: string, goldenHour: string, shutterSettings: ShutterSettings[]): Promise<void> {
    const driveDelayUpAstro = adapter.config.driveDelayUpAstro != 0 ? adapter.config.driveDelayUpAstro * 1000 : 20;

    if (goldenHourEnd) {
        const upTime = goldenHourEnd.split(':');

        schedule.cancelJob('shutterUpGoldenHourEnd');

        schedule.scheduleJob('shutterUpGoldenHourEnd', `${upTime[1]} ${upTime[0]} * * *`, async function () {
            if (shutterSettings) {
                const resLiving = shutterSettings.filter((d) => d.typeUp == 'goldenhour End'); // Filter Area goldenhour end
                const result = resLiving.filter((d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

                for (const i in result) {
                    for (const s in shutterSettings) {
                        if (shutterSettings[s].shutterName == result[i].shutterName) {
                            const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                            const pendingAlarm = await checkPendingAlarm(adapter, shutterSettings[s]);

                            const _autoUpState = await adapter.getStateAsync(`shutters.autoUp.${nameDevice}`).catch((e) => adapter.log.warn(e));

                            if (_autoUpState?.val === true) {
                                let shutterHeight = 0;

                                if (shutterSettings[s].currentAction == 'sunProtect' ||
                                    shutterSettings[s].currentAction == 'OpenInSunProtect') {

                                    shutterHeight = parseFloat(String(shutterSettings[s].heightDownSun));
                                    shutterSettings[s].currentAction = 'sunProtect';
                                } else {
                                    shutterHeight = parseFloat(String(shutterSettings[s].heightUp));
                                    shutterSettings[s].currentAction = 'up';
                                }

                                if (pendingAlarm == false) {
                                    const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID) : null;
                                    const mustValue = (`${shutterSettings[s].triggerState}`);
                                    const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? (`${shutterSettings[s].triggerState}`) : (`${shutterSettings[s].triggerStateTilted}`);
                                    const currentValue = _triggerState?.val !== null && _triggerState?.val !== undefined ? (`${_triggerState.val}`) : '';

                                    if (currentValue === mustValue ||
                                        currentValue === mustValueTilted ||
                                        (currentValue != mustValue &&
                                            currentValue != mustValueTilted &&
                                            shutterSettings[s].autoDrive != 'onlyDown' &&
                                            shutterSettings[s].autoDrive != 'off')) {

                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterHeight) {

                                            shutterSettings[s].currentHeight = shutterHeight;
                                            shutterSettings[s].lastAutoAction = 'GoldenHour_up';
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight; // reset Trigger
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction; // reset Trigger

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], shutterHeight, nameDevice, 'Goldenhour end #5');

                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                            adapter.log.debug(`save current height: ${shutterSettings[s].currentHeight}%` + ` from ${shutterSettings[s].shutterName}`);
                                        } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterHeight) {

                                            shutterSettings[s].currentHeight = shutterHeight;
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight; // reset Trigger
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction; // reset Trigger

                                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                            adapter.log.debug(`GoldenHour up ${shutterSettings[s].shutterName} already up at: ${shutterSettings[s].heightUp}% - setting current action: ${shutterSettings[s].currentAction}`);
                                        }
                                    } else if (shutterSettings[s].triggerID == '') {
                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterHeight) {

                                            shutterSettings[s].currentHeight = shutterHeight;
                                            shutterSettings[s].lastAutoAction = 'GoldenHour_up';

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], shutterHeight, nameDevice, 'Goldenhour end #6');

                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                            adapter.log.debug(`save current height: ${shutterSettings[s].currentHeight}%` + ` from ${shutterSettings[s].shutterName}`);
                                        } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterHeight) {

                                            shutterSettings[s].currentHeight = shutterHeight;

                                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                            adapter.log.debug(`GoldenHour up ${shutterSettings[s].shutterName} already up at: ${shutterSettings[s].heightUp}% - setting current action: ${shutterSettings[s].currentAction}`);
                                        }
                                    } else if (currentValue != mustValue &&
                                        currentValue != mustValueTilted &&
                                        shutterSettings[s].driveAfterClose == true) {

                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterHeight) {

                                            shutterSettings[s].triggerHeight = shutterHeight;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            adapter.log.info(`#7 Will open ID: ${shutterSettings[s].shutterName} value: ${shutterHeight}%` + ` after the window has been closed `);
                                            adapter.log.debug(`save new trigger height: ${shutterHeight}%`);
                                            adapter.log.debug(`save new trigger action: ${shutterSettings[s].triggerAction}`);
                                        } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterHeight) {

                                            shutterSettings[s].triggerHeight = shutterHeight;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            adapter.log.info(`#8 Will open ID: ${shutterSettings[s].shutterName} value: ${shutterHeight}% after is the value for Goldenhour up`);
                                            adapter.log.debug(`save new trigger height: ${shutterHeight}%`);
                                            adapter.log.debug(`save new trigger action: ${shutterSettings[s].triggerAction}`);
                                        }
                                    }
                                } else {
                                    adapter.log.info(`Goldenhour up not moving now due to active alarm: ${shutterSettings[s].shutterName} value: ${shutterHeight}%`);
                                }
                                await adapter.delay(driveDelayUpAstro);
                            }
                        }
                    }
                }
                return (shutterSettings);
            }
        });
    }

    if (goldenHour) {
        const upTime = goldenHour.split(':');

        schedule.cancelJob('shutterDownGoldenHour');

        schedule.scheduleJob('shutterDownGoldenHour', `${upTime[1]} ${upTime[0]} * * *`, async function () {
            if (shutterSettings) {
                const resLiving = shutterSettings.filter((d) => d.typeDown == 'goldenhour'); // Filter Area Goldenhour
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

                            // xmas level or standard down level
                            targetLevel2Set = XmasLevel > -1 ? XmasLevel : targetLevel2Set;
                            downAction = XmasLevel > -1 ? 'Xmas' : downAction;

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
                                    if (pendingAlarm == false) {
                                        const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;
                                        const mustValue = (`${shutterSettings[s].triggerState}`);
                                        const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? (`${shutterSettings[s].triggerState}`) : (`${shutterSettings[s].triggerStateTilted}`);
                                        const currentValue = _triggerState?.val !== null && _triggerState?.val !== undefined ? (`${_triggerState.val}`) : '';

                                        if (currentValue === mustValue ||
                                            currentValue === mustValueTilted ||
                                            (currentValue != mustValue &&
                                                currentValue != mustValueTilted &&
                                                shutterSettings[s].autoDrive != 'onlyUp' &&
                                                shutterSettings[s].autoDrive != 'off')) {

                                            const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                            if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                                Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {

                                                shutterSettings[s].currentHeight = targetLevel2Set;
                                                shutterSettings[s].currentAction = downAction;
                                                shutterSettings[s].lastAutoAction = 'GoldenHour_down';
                                                shutterSettings[s].triggerHeight = targetLevel2Set; // reset Trigger
                                                shutterSettings[s].triggerAction = downAction;      // reset Trigger

                                                await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Goldenhour #8');

                                                adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                adapter.log.debug(`save current height: ${shutterSettings[s].currentHeight}%` + ` from ${shutterSettings[s].shutterName}`);
                                            } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                                Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set) {

                                                shutterSettings[s].currentHeight = targetLevel2Set;
                                                shutterSettings[s].currentAction = downAction;

                                                await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                                adapter.log.debug(`GoldenHour down ${shutterSettings[s].shutterName} already down at: ${targetLevel2Set}% - setting current action: ${shutterSettings[s].currentAction}`);
                                            }

                                            // the shutter is closed first and only then moved to the ventilation height
                                            driveWindowLevel(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, downAction, nameDevice)
                                                .catch((e) => adapter.log.warn(`#driveWindowLevel: ${e}`));
                                        } else if (shutterSettings[s].triggerID == '') {
                                            const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                            if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                                Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {

                                                shutterSettings[s].currentHeight = targetLevel2Set;
                                                shutterSettings[s].currentAction = downAction;
                                                shutterSettings[s].lastAutoAction = 'GoldenHour_down';

                                                await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Goldenhour #9');

                                                adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                adapter.log.debug(`save current height: ${shutterSettings[s].currentHeight}%` + ` from ${shutterSettings[s].shutterName}`);
                                            } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                                Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set) {

                                                shutterSettings[s].currentHeight = targetLevel2Set;
                                                shutterSettings[s].currentAction = downAction;

                                                await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                                adapter.log.debug(`GoldenHour down ${shutterSettings[s].shutterName} already down at: ${targetLevel2Set}% - setting current action: ${shutterSettings[s].currentAction}`);
                                            }
                                        } else if (currentValue != mustValue &&
                                            currentValue != mustValueTilted &&
                                            shutterSettings[s].driveAfterClose == true) {

                                            const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                            if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                                Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {

                                                shutterSettings[s].triggerHeight = targetLevel2Set;
                                                shutterSettings[s].triggerAction = downAction;

                                                adapter.log.info(`#7 Will close ID: ${shutterSettings[s].shutterName} value: ${targetLevel2Set}%` + ` after the window has been closed `);
                                                adapter.log.debug(`save new trigger height: ${targetLevel2Set}%`);
                                                adapter.log.debug(`save new trigger action: ${shutterSettings[s].triggerAction}`);
                                            }
                                        }
                                        await adapter.delay(driveDelayUpAstro);
                                    } else {
                                        adapter.log.info(`Goldenhour down not moving now due to active alarm: ${shutterSettings[s].shutterName} value: ${targetLevel2Set}%`);
                                    }
                                }
                            }
                        }
                    }
                }
                return (shutterSettings);
            }
        });
    }
}
