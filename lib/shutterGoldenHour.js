'use strict';

// @ts-ignore
const schedule = require('node-schedule');
const checkPendingAlarm = require('./shutterAlarm.js').checkPendingAlarm;           // shutterAlarm
const checkFrostAlarm = require('./shutterAlarm.js').checkFrostAlarm;               // shutterAlarm - check frost alarm
const setShutterState = require('./setShutter.js').setShutterState;                 // set Shutter State
const setShutterInfo = require('./setShutter.js').setShutterInfo;                   // set Shutter State

/**
 * @param {Date | undefined} [d]
 */
function getDate(d) {
    d = d || new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

// @ts-ignore
async function shutterGoldenHour(adapter, goldenHourEnd, goldenHour, shutterSettings) {
    const driveDelayUpAstro = adapter.config.driveDelayUpAstro != 0 ? adapter.config.driveDelayUpAstro * 1000 : 2000;

    if (goldenHourEnd) {
        const upTime = goldenHourEnd.split(':');
        //const statusAlarmFrost = await adapter.getForeignStateAsync(adapter.config.alarmFrost); //???

        schedule.cancelJob('shutterUpGoldenHourEnd');

        const upGoldenHour = schedule.scheduleJob('shutterUpGoldenHourEnd', upTime[1] + ' ' + upTime[0] + ' * * *', async function () {
            if (shutterSettings) {
                const resLiving = shutterSettings.filter((/** @type {{ typeUp: string; }} */ d) => d.typeUp == 'goldenhour End'); // Filter Area goldenhour end
                const result = resLiving.filter((/** @type {{ enabled: boolean; }} */ d) => d.enabled === true); // Filter enabled

                for (const i in result) {
                    for (const s in shutterSettings) {
                        if (shutterSettings[s].shutterName == result[i].shutterName) {
                            const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                            const pendingAlarm = await checkPendingAlarm(adapter, shutterSettings[s]);

                            const _autoUpState = await adapter.getStateAsync(`shutters.autoUp.${nameDevice}`);

                            if (_autoUpState && _autoUpState === true || _autoUpState && _autoUpState.val === true) {
                                setTimeout(async function () {
                                    let shutterHeight = 0;

                                    if (shutterSettings[s].currentAction == 'sunProtect' || shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                        shutterHeight = parseFloat(shutterSettings[s].heightDownSun);
                                        shutterSettings[s].currentAction = 'sunProtect';
                                    } else {
                                        shutterHeight = parseFloat(shutterSettings[s].heightUp);
                                        shutterSettings[s].currentAction = 'up';
                                    }

                                    if (!pendingAlarm) {
                                        let currentValue = '';

                                        const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID) : null;

                                        const mustValue = ('' + shutterSettings[s].triggerState);
                                        const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                        if (typeof _triggerState != undefined && _triggerState != null) {
                                            currentValue = ('' + _triggerState.val);
                                        }

                                        if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyDown' && shutterSettings[s].autoDrive != 'off')) {
                                            const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name);

                                            if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != shutterHeight) {
                                                shutterSettings[s].currentHeight = shutterHeight;
                                                shutterSettings[s].lastAutoAction = 'GoldenHour_up';

                                                await setShutterState(adapter, shutterSettings, shutterSettings[s], shutterHeight, nameDevice, 'Goldenhour end #5');

                                                adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                                return (shutterSettings);
                                            }
                                            else if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val == shutterHeight) {
                                                shutterSettings[s].currentHeight = shutterHeight;

                                                await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                                adapter.log.debug('GoldenHour up ' + shutterSettings[s].shutterName + ' already up at: ' + shutterSettings[s].heightUp + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                return (shutterSettings);
                                            }
                                        } else if (shutterSettings[s].triggerID == '') {
                                            const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name);

                                            if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != shutterHeight) {
                                                shutterSettings[s].currentHeight = shutterHeight;
                                                shutterSettings[s].lastAutoAction = 'GoldenHour_up';

                                                await setShutterState(adapter, shutterSettings, shutterSettings[s], shutterHeight, nameDevice, 'Goldenhour end #6');

                                                adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                                return (shutterSettings);
                                            }
                                            else if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val == shutterHeight) {
                                                shutterSettings[s].currentHeight = shutterHeight;

                                                await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                                adapter.log.debug('GoldenHour up ' + shutterSettings[s].shutterName + ' already up at: ' + shutterSettings[s].heightUp + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                return (shutterSettings);
                                            }
                                        } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                            const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name);

                                            if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != shutterHeight) {
                                                shutterSettings[s].triggerHeight = shutterHeight;
                                                shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                                adapter.log.info('#7 Will open ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%' + ' after the window has been closed ');
                                                adapter.log.debug('save new trigger height: ' + shutterHeight + '%');
                                                adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                return (shutterSettings);
                                            }
                                        }
                                    } else {
                                        adapter.log.info('Goldenhour up not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                    }
                                    // @ts-ignore
                                }, driveDelayUpAstro * i, i);
                            }
                        }
                    }
                }
            }
        });
    }

    if (goldenHour) {
        const upTime = goldenHour.split(':');

        schedule.cancelJob('shutterDownGoldenHour');

        const downGoldenHour = schedule.scheduleJob('shutterDownGoldenHour', upTime[1] + ' ' + upTime[0] + ' * * *', async function () {
            if (shutterSettings) {
                const resLiving = shutterSettings.filter((/** @type {{ typeDown: string; }} */ d) => d.typeDown == 'goldenhour'); // Filter Area Goldenhour
                const result = resLiving.filter((/** @type {{ enabled: boolean; }} */ d) => d.enabled === true); // Filter enabled

                for (const i in result) {
                    for (const s in shutterSettings) {
                        if (shutterSettings[s].shutterName == result[i].shutterName) {
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

                            // save current required position to alarmtrigger before overwriting
                            shutterSettings[s].alarmTriggerLevel = targetLevel2Set;
                            shutterSettings[s].alarmTriggerAction = downAction;

                            // overwrite target position and downAction if frost alarm is set.
                            if (statusAlarmFrost == true && shutterSettings[s].enableAlarmFrost == true) {
                                targetLevel2Set = parseFloat(adapter.config.alarmFrostLevel);
                                downAction = 'frost';
                            }

                            const _autoDownState = await adapter.getStateAsync(`shutters.autoDown.${nameDevice}`);

                            if (_autoDownState && _autoDownState === true || _autoDownState && _autoDownState.val === true) {
                                if (!pendingAlarm) {
                                    setTimeout(async function () {
                                        let currentValue = '';

                                        const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID) : null;

                                        let mustValue = ('' + shutterSettings[s].triggerState);
                                        let mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);
                                        if (typeof _triggerState != undefined && _triggerState != null) {
                                            currentValue = ('' + _triggerState.val);
                                        }
                                        if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyUp' && shutterSettings[s].autoDrive != 'off')) {
                                            const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name);

                                            if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != targetLevel2Set) {
                                                shutterSettings[s].currentHeight = targetLevel2Set;
                                                shutterSettings[s].currentAction = downAction;
                                                shutterSettings[s].lastAutoAction = 'GoldenHour_down';

                                                await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Goldenhour #8');

                                                adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                                return (shutterSettings);
                                            }
                                            else if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val == targetLevel2Set) {
                                                shutterSettings[s].currentHeight = targetLevel2Set;
                                                shutterSettings[s].currentAction = downAction;

                                                await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                                adapter.log.debug('GoldenHour down ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                return (shutterSettings);
                                            }
                                        } else if (shutterSettings[s].triggerID == '') {
                                            const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name);

                                            if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != targetLevel2Set) {
                                                shutterSettings[s].currentHeight = targetLevel2Set;
                                                shutterSettings[s].currentAction = downAction;
                                                shutterSettings[s].lastAutoAction = 'GoldenHour_down';

                                                await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Goldenhour #9');

                                                adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                                return (shutterSettings);
                                            }
                                            else if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val == targetLevel2Set) {
                                                shutterSettings[s].currentHeight = targetLevel2Set;
                                                shutterSettings[s].currentAction = downAction;

                                                await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                                adapter.log.debug('GoldenHour down ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                return (shutterSettings);
                                            }
                                        } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                            const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name);

                                            if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != targetLevel2Set) {
                                                shutterSettings[s].triggerHeight = targetLevel2Set;
                                                shutterSettings[s].triggerAction = downAction;

                                                adapter.log.info('#7 Will close ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                adapter.log.debug('save new trigger height: ' + targetLevel2Set + '%');
                                                adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                return (shutterSettings);
                                            }
                                        }
                                        // @ts-ignore
                                    }, driveDelayUpAstro * i, i);
                                } else {
                                    adapter.log.info('Goldenhour down not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                }
                            }
                        }
                    }
                }
            }
        });
    }
}
module.exports = shutterGoldenHour;