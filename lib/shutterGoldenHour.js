'use strict';

// @ts-ignore
const schedule = require('node-schedule');
const checkPendingAlarm = require('./shutterAlarm.js').checkPendingAlarm;           // shutterAlarm
const checkFrostAlarm = require('./shutterAlarm.js').checkFrostAlarm;               // shutterAlarm - check frost alarm
const setShutterState = require('./setShutter.js').setShutterState;                 // set Shutter State
const setShutterInfo = require('./setShutter.js').setShutterInfo;                   // set Shutter State
const GetXmasLevel = require('./isSummerTime.js').GetXmasLevel;                     // Check if XMas
const CheckInSummerNotDown = require('./isSummerTime.js').CheckInSummerNotDown;     // Check if summer

let timerSleep = 0;

async function sleep(ms) {
    return new Promise(async (resolve) => {
        // @ts-ignore
        timerSleep = setTimeout(async () => resolve(), ms);
    });
}

/**
 * @param {Date | undefined} [d]
 */
function getDate(d) {
    d = d || new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

// @ts-ignore
async function shutterGoldenHour(adapter, goldenHourEnd, goldenHour, shutterSettings) {
    const driveDelayUpAstro = adapter.config.driveDelayUpAstro != 0 ? adapter.config.driveDelayUpAstro * 1000 : 20;

    if (goldenHourEnd) {
        const upTime = goldenHourEnd.split(':');
        //const statusAlarmFrost = await adapter.getForeignStateAsync(adapter.config.alarmFrost); //???

        schedule.cancelJob('shutterUpGoldenHourEnd');

        const upGoldenHour = schedule.scheduleJob('shutterUpGoldenHourEnd', upTime[1] + ' ' + upTime[0] + ' * * *', async function () {
            if (shutterSettings) {
                const resLiving = shutterSettings.filter((/** @type {{ typeUp: string; }} */ d) => d.typeUp == 'goldenhour End'); // Filter Area goldenhour end
                const result = resLiving.filter((/** @type {{ enabled: boolean | string; }} */ d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

                for (const i in result) {
                    for (const s in shutterSettings) {
                        if (shutterSettings[s].shutterName == result[i].shutterName) {
                            const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                            const pendingAlarm = await checkPendingAlarm(adapter, shutterSettings[s]);

                            const _autoUpState = await adapter.getStateAsync(`shutters.autoUp.${nameDevice}`).catch((e) => adapter.log.warn(e));

                            if (_autoUpState && _autoUpState === true || _autoUpState && _autoUpState.val === true) {
                                let shutterHeight = 0;

                                if (shutterSettings[s].currentAction == 'sunProtect' || shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                    shutterHeight = parseFloat(shutterSettings[s].heightDownSun);
                                    shutterSettings[s].currentAction = 'sunProtect';
                                } else {
                                    shutterHeight = parseFloat(shutterSettings[s].heightUp);
                                    shutterSettings[s].currentAction = 'up';
                                }

                                if (pendingAlarm == false) {
                                    let currentValue = '';

                                    const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID) : null;

                                    const mustValue = ('' + shutterSettings[s].triggerState);
                                    const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                    if (typeof _triggerState != undefined && _triggerState != null) {
                                        currentValue = ('' + _triggerState.val);
                                    }

                                    if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyDown' && shutterSettings[s].autoDrive != 'off')) {
                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterHeight) {
                                            shutterSettings[s].currentHeight = shutterHeight;
                                            shutterSettings[s].lastAutoAction = 'GoldenHour_up';
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight; // reset Trigger
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction; // reset Trigger

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], shutterHeight, nameDevice, 'Goldenhour end #5');

                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                            adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                        }
                                        else if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterHeight) {
                                            shutterSettings[s].currentHeight = shutterHeight;
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight; // reset Trigger
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction; // reset Trigger

                                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                            adapter.log.debug('GoldenHour up ' + shutterSettings[s].shutterName + ' already up at: ' + shutterSettings[s].heightUp + '% - setting current action: ' + shutterSettings[s].currentAction);
                                        }
                                    } else if (shutterSettings[s].triggerID == '') {
                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterHeight) {
                                            shutterSettings[s].currentHeight = shutterHeight;
                                            shutterSettings[s].lastAutoAction = 'GoldenHour_up';

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], shutterHeight, nameDevice, 'Goldenhour end #6');

                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                            adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                        }
                                        else if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterHeight) {
                                            shutterSettings[s].currentHeight = shutterHeight;

                                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                            adapter.log.debug('GoldenHour up ' + shutterSettings[s].shutterName + ' already up at: ' + shutterSettings[s].heightUp + '% - setting current action: ' + shutterSettings[s].currentAction);
                                        }
                                    } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterHeight) {
                                            shutterSettings[s].triggerHeight = shutterHeight;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            adapter.log.info('#7 Will open ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%' + ' after the window has been closed ');
                                            adapter.log.debug('save new trigger height: ' + shutterHeight + '%');
                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                        }
                                    }
                                } else {
                                    adapter.log.info('Goldenhour up not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                }
                                await sleep(driveDelayUpAstro);
                            }
                        }
                    }
                }
                clearTimeout(timerSleep);
                return (shutterSettings);
            }
        });
    }

    if (goldenHour) {
        const upTime = goldenHour.split(':');

        schedule.cancelJob('shutterDownGoldenHour');

        const downGoldenHour = schedule.scheduleJob('shutterDownGoldenHour', upTime[1] + ' ' + upTime[0] + ' * * *', async function () {
            if (shutterSettings) {
                const resLiving = shutterSettings.filter((/** @type {{ typeDown: string; }} */ d) => d.typeDown == 'goldenhour'); // Filter Area Goldenhour
                const result = resLiving.filter((/** @type {{ enabled: boolean | string; }} */ d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

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
                            if (statusAlarmFrost == true && shutterSettings[s].enableAlarmFrost == true && downAction != 'Xmas') {
                                targetLevel2Set = parseFloat(adapter.config.alarmFrostLevel);
                                downAction = 'frost';
                            }

                            if (!inSummerNotDown) {
                                const _autoDownState = await adapter.getStateAsync(`shutters.autoDown.${nameDevice}`).catch((e) => adapter.log.warn(e));

                                if (_autoDownState && _autoDownState === true || _autoDownState && _autoDownState.val === true) {
                                    if (pendingAlarm == false) {
                                        let currentValue = '';

                                        const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;

                                        let mustValue = ('' + shutterSettings[s].triggerState);
                                        let mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);
                                        if (typeof _triggerState != undefined && _triggerState != null) {
                                            currentValue = ('' + _triggerState.val);
                                        }
                                        if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyUp' && shutterSettings[s].autoDrive != 'off')) {
                                            const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                            if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {
                                                shutterSettings[s].currentHeight = targetLevel2Set;
                                                shutterSettings[s].currentAction = downAction;
                                                shutterSettings[s].lastAutoAction = 'GoldenHour_down';
                                                shutterSettings[s].triggerHeight = targetLevel2Set; // reset Trigger
                                                shutterSettings[s].triggerAction = downAction;      // reset Trigger

                                                await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Goldenhour #8');

                                                adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                            }
                                            else if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set) {
                                                shutterSettings[s].currentHeight = targetLevel2Set;
                                                shutterSettings[s].currentAction = downAction;

                                                await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                                adapter.log.debug('GoldenHour down ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                            }
                                        } else if (shutterSettings[s].triggerID == '') {
                                            const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                            if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {
                                                shutterSettings[s].currentHeight = targetLevel2Set;
                                                shutterSettings[s].currentAction = downAction;
                                                shutterSettings[s].lastAutoAction = 'GoldenHour_down';

                                                await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Goldenhour #9');

                                                adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                            }
                                            else if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set) {
                                                shutterSettings[s].currentHeight = targetLevel2Set;
                                                shutterSettings[s].currentAction = downAction;

                                                await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                                adapter.log.debug('GoldenHour down ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                            }
                                        } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                            const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                            if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {
                                                shutterSettings[s].triggerHeight = targetLevel2Set;
                                                shutterSettings[s].triggerAction = downAction;

                                                adapter.log.info('#7 Will close ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                adapter.log.debug('save new trigger height: ' + targetLevel2Set + '%');
                                                adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                            }
                                        }
                                        await sleep(driveDelayUpAstro);
                                    } else {
                                        adapter.log.info('Goldenhour down not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                    }
                                }
                            }
                        }
                    }
                }
                clearTimeout(timerSleep);
                return (shutterSettings);
            }
        });
    }
}
module.exports = shutterGoldenHour;