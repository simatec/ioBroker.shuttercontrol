'use strict';

// @ts-ignore
const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');                           // shutterState
const checkPendingAlarm = require('./shutterAlarm.js').checkPendingAlarm;    // shutterAlarm
const checkFrostAlarm = require('./shutterAlarm.js').checkFrostAlarm;      // shutterAlarm - check frost alarm
const CheckInSummerNotDown = require('./isSummerTime.js').CheckInSummerNotDown;
const GetXmasLevel = require('./isSummerTime.js').GetXmasLevel;

// @ts-ignore
function shutterDownComplete(adapter, delayDown, shutterSettings) {

    try {
        const driveDelayDownLiving = adapter.config.driveDelayDownLiving * 1000;

        const downTimeComplete = adapter.config.betweenPositionTime.split(':');

        adapter.log.debug('complete down at ' + adapter.config.betweenPositionTime);

        schedule.cancelJob('shutterDownComplete');

        const downComplete = schedule.scheduleJob('shutterDownComplete', downTimeComplete[1] + ' ' + downTimeComplete[0] + ' * * *', function () {
            delayDown = delayDown * driveDelayDownLiving;

            // Full Result
            const resultFull = shutterSettings;

            if (resultFull) {
                // Filter Area Living
                const /**
                     * @param {{ typeDown: string; }} d
                     */
                    // @ts-ignore
                    resLiving = resultFull.filter(d => d.betweenPosition == true);
                // Filter enabled
                let /**
                     * @param {{ enabled: boolean; }} d
                     */
                    // @ts-ignore
                    resEnabled = resLiving.filter(d => d.enabled === true);

                const result = resEnabled;

                for (const i in result) {
                    for (const s in shutterSettings) {
                        if (shutterSettings[s].shutterName == result[i].shutterName && shutterSettings[s].currentAction == 'middle') {
                            const inSummerNotDown = CheckInSummerNotDown(adapter, shutterSettings[s]);
                            const XmasLevel = GetXmasLevel(adapter, shutterSettings[s]);
                            let targetLevel2Set = 0;
                            let downAction = 'down';

                            let pendingAlarm = false;
                            // @ts-ignore
                            checkPendingAlarm(adapter, shutterSettings[s], function (resAlarmPending) {
                                pendingAlarm = resAlarmPending;

                                let statusAlarmFrost = false;
                                // @ts-ignore
                                checkFrostAlarm(adapter, shutterSettings[s], function (resAlarmFrost) {
                                    statusAlarmFrost = resAlarmFrost;

                                    //entweder xmas level oder standard down level
                                    targetLevel2Set = XmasLevel > -1 ? XmasLevel : parseFloat(shutterSettings[s].heightDown);

                                    // save current required position to alarmtrigger before overwriting
                                    shutterSettings[s].alarmTriggerLevel = targetLevel2Set;
                                    shutterSettings[s].alarmTriggerAction = downAction;

                                    // overwrite target position and downAction if frost alarm is set.
                                    if (statusAlarmFrost == true && shutterSettings[s].enableAlarmFrost == true) {
                                        targetLevel2Set = parseFloat(adapter.config.alarmFrostLevel);
                                        downAction = 'frost';
                                    }

                                    if (!inSummerNotDown) {

                                        const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                                        /**
                                         * @param {any} err
                                         * @param {boolean} state
                                         */
                                        // @ts-ignore
                                        adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                                            if (state && state === true || state && state.val === true) {
                                                if (pendingAlarm == false) {
                                                    setTimeout(function () {
                                                        let currentValue = '';
                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: string; }} state
                                                         */
                                                        // @ts-ignore
                                                        adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {
                                                            const mustValue = ('' + shutterSettings[s].triggerState);
                                                            const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);
                                                            if (typeof state != undefined && state != null) {
                                                                currentValue = ('' + state.val);
                                                            }
                                                            if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyUp' && shutterSettings[s].autoDrive != 'off')) {
                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: any; }} state
                                                                 */
                                                                // @ts-ignore
                                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                                                        adapter.log.info('#12 Set ID: ' + shutterSettings[s].name + ' ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                                                        adapter.setForeignState(shutterSettings[s].name, targetLevel2Set, false);
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                        shutterSettings[s].currentAction = 'down';
                                                                        shutterSettings[s].lastAutoAction = 'Down_Complete';
                                                                        adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                        return (shutterSettings);
                                                                    }
                                                                    else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                        shutterSettings[s].currentAction = 'down';
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        adapter.log.debug('Complete down ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                        return (shutterSettings);
                                                                    }
                                                                });
                                                            } else if (shutterSettings[s].triggerID == '') {
                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: any; }} state
                                                                 */
                                                                // @ts-ignore
                                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                                        adapter.log.info('#13 Set ID: ' + shutterSettings[s].name + ' ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                                                        adapter.setForeignState(shutterSettings[s].name, targetLevel2Set, false);
                                                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                        shutterSettings[s].currentAction = 'down';
                                                                        shutterSettings[s].lastAutoAction = 'Down_Complete';
                                                                        adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                        return (shutterSettings);
                                                                    }
                                                                    else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                        shutterSettings[s].currentAction = 'down';
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        adapter.log.debug('Complete down ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                        return (shutterSettings);
                                                                    }
                                                                });
                                                            } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: number; }} state
                                                                 */
                                                                // @ts-ignore
                                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                                        adapter.log.info('#14 Will close ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                                        shutterSettings[s].triggerHeight = targetLevel2Set;
                                                                        adapter.log.debug('save new trigger height: ' + targetLevel2Set + '%');
                                                                        shutterSettings[s].triggerAction = 'down';
                                                                        adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                        return (shutterSettings);
                                                                    }
                                                                });
                                                            }
                                                        });
                                                    }, delayDown);
                                                } else {
                                                    adapter.log.info('Down Complete not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                                }
                                            }
                                        });
                                    }
                                });
                            });
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