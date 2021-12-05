'use strict';

// @ts-ignore
const schedule = require('node-schedule');
const checkPendingAlarm = require('./shutterAlarm.js').checkPendingAlarm;           // shutterAlarm
const checkFrostAlarm = require('./shutterAlarm.js').checkFrostAlarm;               // shutterAlarm - check frost alarm
const CheckInSummerNotDown = require('./isSummerTime.js').CheckInSummerNotDown;     // check Summertime
const GetXmasLevel = require('./isSummerTime.js').GetXmasLevel;                     // check Xmas Time
const setShutterState = require('./setShutter.js').setShutterState;                 // set Shutter State
const setShutterInfo = require('./setShutter.js').setShutterInfo;                   // set Shutter State

// @ts-ignore
async function shutterDownComplete(adapter, delayDown, shutterSettings) {
    try {
        const driveDelayDownLiving = adapter.config.driveDelayDownLiving * 1000;
        const downTimeComplete = adapter.config.betweenPositionTime.split(':');

        adapter.log.debug('complete down at ' + adapter.config.betweenPositionTime);

        schedule.cancelJob('shutterDownComplete');

        const downComplete = schedule.scheduleJob('shutterDownComplete', downTimeComplete[1] + ' ' + downTimeComplete[0] + ' * * *', async function () {
            delayDown = delayDown * driveDelayDownLiving;

            if (shutterSettings) {
                const resLiving = shutterSettings.filter((/** @type {{ betweenPosition: boolean; }} */ d) => d.betweenPosition == true); // Filter Area Living
                const result = resLiving.filter((/** @type {{ enabled: boolean; }} */ d) => d.enabled === true); // Filter enabled

                for (const i in result) {
                    for (const s in shutterSettings) {
                        if (shutterSettings[s].shutterName == result[i].shutterName && shutterSettings[s].currentAction == 'middle') {
                            const inSummerNotDown = await CheckInSummerNotDown(adapter, shutterSettings[s]);
                            const XmasLevel = await GetXmasLevel(adapter, shutterSettings[s]);
                            let targetLevel2Set = 0;
                            let downAction = 'down';

                            const pendingAlarm = await checkPendingAlarm(adapter, shutterSettings[s]);
                            const statusAlarmFrost = await checkFrostAlarm(adapter, shutterSettings[s]);

                            targetLevel2Set = XmasLevel > -1 ? XmasLevel : parseFloat(shutterSettings[s].heightDown); // xmas level or standard down level

                            // save current required position to alarmtrigger before overwriting
                            shutterSettings[s].alarmTriggerLevel = targetLevel2Set;
                            shutterSettings[s].alarmTriggerAction = downAction;

                            // overwrite target position and downAction if frost alarm is set.
                            if (statusAlarmFrost == true && shutterSettings[s].enableAlarmFrost == true && downAction != 'Xmas') {
                                targetLevel2Set = parseFloat(adapter.config.alarmFrostLevel);
                                downAction = 'frost';
                            }

                            if (!inSummerNotDown) {
                                const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                                const _autoDownState = await adapter.getStateAsync(`shutters.autoDown.${nameDevice}`);

                                if (_autoDownState && _autoDownState === true || _autoDownState && _autoDownState.val === true) {
                                    if (pendingAlarm == false) {
                                        setTimeout(async function () {
                                            let currentValue = '';
                                            const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID) : null;
                                            const mustValue = ('' + shutterSettings[s].triggerState);
                                            const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                            if (typeof _triggerState != undefined && _triggerState != null) {
                                                currentValue = ('' + _triggerState.val);
                                            }

                                            if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyUp' && shutterSettings[s].autoDrive != 'off')) {
                                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name);

                                                if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != targetLevel2Set) {
                                                    shutterSettings[s].currentHeight = targetLevel2Set;
                                                    shutterSettings[s].currentAction = 'down';
                                                    shutterSettings[s].lastAutoAction = 'Down_Complete';
                                                    shutterSettings[s].triggerHeight = targetLevel2Set; // reset Trigger
                                                    shutterSettings[s].triggerAction = 'down';          // reset Trigger

                                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Complete Down #12');

                                                    adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                    return (shutterSettings);
                                                }
                                                else if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val == targetLevel2Set) {
                                                    shutterSettings[s].currentHeight = targetLevel2Set;
                                                    shutterSettings[s].currentAction = 'down';

                                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                                    adapter.log.debug('Complete down ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                    return (shutterSettings);
                                                }
                                            } else if (shutterSettings[s].triggerID == '') {
                                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name);

                                                if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != targetLevel2Set) {
                                                    shutterSettings[s].currentHeight = targetLevel2Set;
                                                    shutterSettings[s].currentAction = 'down';
                                                    shutterSettings[s].lastAutoAction = 'Down_Complete';

                                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Complete Down #13');

                                                    adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                    return (shutterSettings);
                                                }
                                                else if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val == targetLevel2Set) {
                                                    shutterSettings[s].currentHeight = targetLevel2Set;
                                                    shutterSettings[s].currentAction = 'down';

                                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                                    adapter.log.debug('Complete down ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                    return (shutterSettings);
                                                }
                                            } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name);

                                                if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != targetLevel2Set) {
                                                    shutterSettings[s].triggerHeight = targetLevel2Set;
                                                    shutterSettings[s].triggerAction = 'down';

                                                    adapter.log.info('#14 Will close ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                    adapter.log.debug('save new trigger height: ' + targetLevel2Set + '%');
                                                    adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                    return (shutterSettings);
                                                }
                                            }
                                        }, delayDown);
                                    } else {
                                        adapter.log.info('Down Complete not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }
    catch (e) {
        adapter.log.error('exception catch shutterDownComplete [' + e + ']');
    }
}
module.exports = shutterDownComplete;