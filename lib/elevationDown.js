'use strict';

const sunProtect = require('./sunProtect.js');                                  // sunProtect
const checkPendingAlarm = require('./shutterAlarm.js').checkPendingAlarm;       // shutterAlarm
const checkFrostAlarm = require('./shutterAlarm.js').checkFrostAlarm;           // shutterAlarm - check frost alarm
const setShutterState = require('./setShutter.js').setShutterState;             // set Shutter State
const setShutterInfo = require('./setShutter.js').setShutterInfo;               // set Shutter State
const CheckInSummerNotDown = require('./isSummerTime.js').CheckInSummerNotDown;         // Check is summer
const GetXmasLevel = require('./isSummerTime.js').GetXmasLevel;                         // Check is XMas

/**
 * @param {Date | undefined} [d]
 */
function getDate(d) {
    d = d || new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

let timerSleep = 0;

async function sleep(ms) {
    return new Promise(async (resolve) => {
        // @ts-ignore
        timerSleep = setTimeout(async () => resolve(), ms);
    });
}

// @ts-ignore
async function elevationDown(adapter, elevation, azimuth, shutterSettings) {
    if (shutterSettings) {
        const driveDelayUpAstro = adapter.config.driveDelayUpAstro != 0 ? adapter.config.driveDelayUpAstro * 1000 : 20;
        const resLiving = shutterSettings.filter((/** @type {{ typeDown: string; }} */ d) => d.typeDown == 'elevation');
        const result = resLiving.filter((/** @type {{ enabled: boolean | string; }} */ d) => d.enabled === true || d.enabled === 'true');

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

                    // between Position Level
                    if (getDate() < adapter.config.betweenPositionTime) {
                        targetLevel2Set = shutterSettings[s].betweenPosition == true ? parseFloat(shutterSettings[s].betweenPositionLevel) : parseFloat(shutterSettings[s].heightDown);
                        downAction = shutterSettings[s].betweenPosition == true ? 'middle' : 'down';
                    } else {
                        targetLevel2Set = parseFloat(shutterSettings[s].heightDown);
                        downAction = 'down';
                    }

                    // xmas level or standard down level
                    targetLevel2Set = XmasLevel > -1 ? XmasLevel : targetLevel2Set;
                    downAction = XmasLevel > -1 ? 'Xmas' : downAction;

                    // save current required position to alarmtrigger before overwriting
                    shutterSettings[s].alarmTriggerLevel = targetLevel2Set;
                    shutterSettings[s].alarmTriggerAction = downAction;

                    // overwrite target position and downAction if frost alarm is set.
                    if (statusAlarmFrost && shutterSettings[s].enableAlarmFrost == true && downAction != 'Xmas') {
                        targetLevel2Set = parseFloat(adapter.config.alarmFrostLevel);
                        downAction = 'frost';
                    }
                    if (!inSummerNotDown) {
                        const _autoDownState = await adapter.getStateAsync(`shutters.autoDown.${nameDevice}`).catch((e) => adapter.log.warn(e));

                        if (_autoDownState && _autoDownState === true || _autoDownState && _autoDownState.val === true) {
                            const elevationEnd = (shutterSettings[s].elevation - 1);

                            if (elevation <= shutterSettings[s].elevation && elevation >= elevationEnd && shutterSettings[s].currentAction != 'down' && azimuth > 180) {

                                if (pendingAlarm == false) {
                                    let currentValue = '';
                                    const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;

                                    const mustValue = ('' + shutterSettings[s].triggerState);
                                    const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                    if (typeof _triggerState != undefined && _triggerState != null) {
                                        currentValue = ('' + _triggerState.val);
                                    }

                                    if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyUp' && shutterSettings[s].autoDrive != 'off')) {
                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {
                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                            shutterSettings[s].currentAction = downAction;
                                            shutterSettings[s].lastAutoAction = 'Elevation_down';
                                            shutterSettings[s].triggerHeight = targetLevel2Set; // reset Trigger
                                            shutterSettings[s].triggerAction = downAction;      // reset Trigger

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Elevation Down #3');

                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                            adapter.log.debug(`save current height: ${shutterSettings[s].currentHeight}% from ${shutterSettings[s].shutterName}`);
                                        }
                                        else if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set) {
                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                            shutterSettings[s].currentAction = downAction;

                                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                            adapter.log.debug(`Elevation down ${shutterSettings[s].shutterName} already down at: ${targetLevel2Set}% - setting current action: ${shutterSettings[s].currentAction}`);
                                        }
                                    } else if (shutterSettings[s].triggerID == '') {
                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {
                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                            shutterSettings[s].currentAction = downAction;
                                            shutterSettings[s].lastAutoAction = 'Elevation_down';

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Elevation Down #4');

                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                            adapter.log.debug(`save current height: ${shutterSettings[s].currentHeight}% from ${shutterSettings[s].shutterName}`);
                                        }
                                        else if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set) {
                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                            shutterSettings[s].currentAction = downAction;

                                            adapter.log.debug(`elevation down ${shutterSettings[s].shutterName} already down at: ${targetLevel2Set}% - setting current action: ${shutterSettings[s].currentAction}`);

                                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);
                                        }

                                    } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {
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
                                    await sleep(driveDelayUpAstro);
                                } else {
                                    adapter.log.info(`Elevation down not moving now due to active alarm: ${shutterSettings[s].shutterName} value: ${targetLevel2Set}%`);
                                }
                            }
                        }
                    }
                }
            }
        }
        setTimeout(async function () {
            if (elevation <= adapter.config.sunProtEndElevation) {
                sunProtect(adapter, elevation, azimuth, shutterSettings);
            }
        }, 120000);
        clearTimeout(timerSleep);
        return (shutterSettings);
    }
}
module.exports = elevationDown;