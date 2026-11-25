import { sunProtect } from './sunProtect';
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
 * Closes the shutters of type elevation when the sun elevation falls below the configured value
 *
 * @param adapter adapter instance
 * @param elevation current sun elevation
 * @param azimuth current sun azimuth
 * @param shutterSettings all shutter settings
 */
export async function elevationDown(adapter: ioBroker.Adapter, elevation: number, azimuth: number, shutterSettings: ShutterSettings[]): Promise<ShutterSettings[] | undefined> {
    if (shutterSettings) {
        const driveDelayUpAstro = adapter.config.driveDelayUpAstro != 0 ? adapter.config.driveDelayUpAstro * 1000 : 20;
        const resLiving = shutterSettings.filter((d) => d.typeDown == 'elevation');
        const result = resLiving.filter((d) => d.enabled === true || d.enabled === 'true');

        for (let i = 0; i < result.length; i++) {
            for (let s = 0; s < shutterSettings.length; s++) {
                if (shutterSettings[s].shutterName == result[i].shutterName) {
                    const inSummerNotDown = await CheckInSummerNotDown(adapter, shutterSettings[s]);
                    const XmasLevel = await GetXmasLevel(adapter, shutterSettings[s]);
                    const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                    const pendingAlarm = await checkPendingAlarm(adapter, shutterSettings[s]);
                    const statusAlarmFrost = await checkFrostAlarm(adapter, shutterSettings[s]);

                    let targetLevel2Set = 0;
                    let downAction = 'down';

                    // between Position Level
                    if (getDate() < adapter.config.betweenPositionTime) {
                        targetLevel2Set = shutterSettings[s].betweenPosition == true ? parseFloat(String(shutterSettings[s].betweenPositionLevel)) : parseFloat(String(shutterSettings[s].heightDown));
                        downAction = shutterSettings[s].betweenPosition == true ? 'middle' : 'down';
                    } else {
                        targetLevel2Set = parseFloat(String(shutterSettings[s].heightDown));
                        downAction = 'down';
                    }

                    // xmas level or standard down level
                    targetLevel2Set = XmasLevel > -1 ? XmasLevel : targetLevel2Set;
                    downAction = XmasLevel > -1 ? 'Xmas' : downAction;

                    // position to return to after an alarm - stored below only if the shutter is really driven (or waits for an alarm)
                    const alarmTriggerLevel = targetLevel2Set;
                    const alarmTriggerAction = downAction;

                    // overwrite target position and downAction if frost alarm is set.
                    if (statusAlarmFrost && shutterSettings[s].enableAlarmFrost == true && downAction != 'Xmas') {
                        targetLevel2Set = parseFloat(String(adapter.config.alarmFrostLevel));
                        downAction = 'frost';
                    }
                    if (!inSummerNotDown) {
                        const _autoDownState = await adapter.getStateAsync(`shutters.autoDown.${nameDevice}`).catch((e) => adapter.log.warn(e));

                        if (_autoDownState?.val === true) {
                            const elevationEnd = (Number(shutterSettings[s].elevation) - 1);

                            if (elevation <= Number(shutterSettings[s].elevation) &&
                                elevation >= elevationEnd &&
                                shutterSettings[s].currentAction != 'down' &&
                                azimuth > 180) {
                                shutterSettings[s].alarmTriggerLevel = alarmTriggerLevel;
                                shutterSettings[s].alarmTriggerAction = alarmTriggerAction;

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
                                            shutterSettings[s].lastAutoAction = 'Elevation_down';
                                            shutterSettings[s].triggerHeight = targetLevel2Set; // reset Trigger
                                            shutterSettings[s].triggerAction = downAction;      // reset Trigger

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Elevation Down #3');

                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                            adapter.log.debug(`save current height: ${shutterSettings[s].currentHeight}% from ${shutterSettings[s].shutterName}`);
                                        } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set) {

                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                            shutterSettings[s].currentAction = downAction;

                                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                            adapter.log.debug(`Elevation down ${shutterSettings[s].shutterName} already down at: ${targetLevel2Set}% - setting current action: ${shutterSettings[s].currentAction}`);
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
                                            shutterSettings[s].lastAutoAction = 'Elevation_down';

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Elevation Down #4');

                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                            adapter.log.debug(`save current height: ${shutterSettings[s].currentHeight}% from ${shutterSettings[s].shutterName}`);
                                        } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set) {

                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                            shutterSettings[s].currentAction = downAction;

                                            adapter.log.debug(`elevation down ${shutterSettings[s].shutterName} already down at: ${targetLevel2Set}% - setting current action: ${shutterSettings[s].currentAction}`);

                                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);
                                        }

                                    } else if (currentValue != mustValue &&
                                        currentValue != mustValueTilted &&
                                        shutterSettings[s].driveAfterClose == true) {

                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {

                                            shutterSettings[s].triggerHeight = targetLevel2Set;
                                            shutterSettings[s].triggerAction = downAction;

                                            adapter.log.info(`#5 Will close ID: ${shutterSettings[s].shutterName} value: ${targetLevel2Set}% after the window has been closed`);
                                            adapter.log.debug(`save new trigger height: ${targetLevel2Set}%`);
                                            adapter.log.debug(`save new trigger action: ${shutterSettings[s].triggerAction}`);
                                        }
                                    } else {
                                        adapter.log.info(`Elevation down not moving now due to active alarm: ${shutterSettings[s].shutterName} value: ${targetLevel2Set}%`);
                                        shutterSettings[s].alarmTriggerLevel = targetLevel2Set;
                                        shutterSettings[s].alarmTriggerAction = downAction;
                                    }
                                    await adapter.delay(driveDelayUpAstro);
                                } else {
                                    adapter.log.info(`Elevation down not moving now due to active alarm: ${shutterSettings[s].shutterName} value: ${targetLevel2Set}%`);
                                }
                            }
                        }
                    }
                }
            }
        }
        adapter.setTimeout(async function () {
            if (elevation <= adapter.config.sunProtEndElevation) {
                void sunProtect(adapter, elevation, azimuth, shutterSettings);
            }
        }, 120000);
        return (shutterSettings);
    }
}
