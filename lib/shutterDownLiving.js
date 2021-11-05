'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');                           // shutterState
const checkPendingAlarm = require('./shutterAlarm.js').checkPendingAlarm;    // shutterAlarm
const checkFrostAlarm = require('./shutterAlarm.js').checkFrostAlarm;      // shutterAlarm - check frost alarm
//const IsSummerTime = require('./isSummerTime.js');                         // IsSummerTime

const CheckInSummerNotDown = require('./isSummerTime.js').CheckInSummerNotDown;
const GetXmasLevel = require('./isSummerTime.js').GetXmasLevel;

function getDate(d) {
    d = d || new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

function shutterDownLiving(adapter, downTimeLiving, autoLivingStr, shutterSettings) {

    adapter.log.debug('shutterDownLiving');

    const driveDelayUpLiving = adapter.config.driveDelayUpLiving * 1000;

    if ((downTimeLiving) == undefined) {
        downTimeLiving = adapter.config.W_shutterDownLiving;
    }
    let downTime = downTimeLiving.split(':');
    /** @type {number | undefined} */
    let timeoutLivingAuto;

    schedule.cancelJob('shutterDownLiving');

    const downLiving = schedule.scheduleJob('shutterDownLiving', downTime[1] + ' ' + downTime[0] + ' * * *', function () {
        // Full Result
        const resultFull = shutterSettings;

        if (resultFull) {
            // Filter Area Living
            const /**
                 * @param {{ typeDown: string; }} d
                 */
                resLiving = resultFull.filter(d => d.typeDown == 'living');
            // Filter enabled
            let /**
                 * @param {{ enabled: boolean; }} d
                 */
                resEnabled = resLiving.filter(d => d.enabled === true);

            let result = resEnabled;
            let number = 0;

            for (const i in result) {
                number++;
            }

            timeoutLivingAuto = number * driveDelayUpLiving;


            for (const i in result) {
                for (const s in shutterSettings) {
                    if (shutterSettings[s].shutterName == result[i].shutterName) {
                        const inSummerNotDown = CheckInSummerNotDown(adapter, shutterSettings[s]);
                        const XmasLevel = GetXmasLevel(adapter, shutterSettings[s]);

                        let targetLevel2Set = 0;
                        let downAction = 'down';

                        let pendingAlarm = false;
                        checkPendingAlarm(adapter, shutterSettings[s], function (resAlarmPending) {
                            pendingAlarm = resAlarmPending;

                            let statusAlarmFrost = false;
                            checkFrostAlarm(adapter, shutterSettings[s], function (resAlarmFrost) {
                                statusAlarmFrost = resAlarmFrost;


                                if (getDate() < adapter.config.betweenPositionTime) {
                                    // between Position Level
                                    targetLevel2Set = shutterSettings[s].betweenPosition == true ? parseFloat(shutterSettings[s].betweenPositionLevel) : parseFloat(shutterSettings[s].heightDown);
                                    downAction = shutterSettings[s].betweenPosition == true ? 'middle' : 'down';
                                } else {
                                    targetLevel2Set = parseFloat(shutterSettings[s].heightDown);
                                    downAction = 'down';
                                }

                                //entweder xmas level oder standard down level
                                targetLevel2Set = XmasLevel > -1 ? XmasLevel : targetLevel2Set;
                                downAction = XmasLevel > -1 ? 'Xmas' : downAction;

                                // save current required position to alarmtrigger before overwriting
                                shutterSettings[s].alarmTriggerLevel = targetLevel2Set;
                                shutterSettings[s].alarmTriggerAction = downAction;

                                // overwrite target position and downAction if frost alarm is set.
                                if (statusAlarmFrost == true && shutterSettings[s].enableAlarmFrost == true) {
                                    targetLevel2Set = parseFloat(adapter.config.alarmFrostLevel);
                                    downAction = 'frost';
                                }

                                if (!inSummerNotDown) {

                                    let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                                    /**
                                     * @param {any} err
                                     * @param {boolean} state
                                     */
                                    adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                                        if (state && state === true || state && state.val === true) {
                                            if (pendingAlarm == false) {
                                                setTimeout(function () {
                                                    let currentValue = '';
                                                    /**
                                                     * @param {any} err
                                                     * @param {{ val: string; }} state
                                                     */
                                                    adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {
                                                        let mustValue = ('' + shutterSettings[s].triggerState);
                                                        let mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);
                                                        if (typeof state != undefined && state != null) {
                                                            currentValue = ('' + state.val);
                                                        }
                                                        if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyUp' && shutterSettings[s].autoDrive != 'off')) {
                                                            /**
                                                             * @param {any} err
                                                             * @param {{ val: any; }} state
                                                             */
                                                            adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                                    adapter.log.info('#17 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                                                    adapter.setForeignState(shutterSettings[s].name, targetLevel2Set, false);
                                                                    shutterSettings[s].currentHeight = targetLevel2Set;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                    shutterSettings[s].currentAction = downAction;
                                                                    shutterSettings[s].lastAutoAction = 'Down_LivingTime';
                                                                    adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                    adapter.log.debug('shutterDownLiving #1 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                                else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                                    shutterSettings[s].currentHeight = targetLevel2Set;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                    shutterSettings[s].currentAction = downAction;
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                    adapter.log.debug('shutterDownLiving #1 ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                            });
                                                        } else if (shutterSettings[s].triggerID == '') {
                                                            /**
                                                             * @param {any} err
                                                             * @param {{ val: any; }} state
                                                             */
                                                            adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                                    adapter.log.info('#18 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                                                    adapter.setForeignState(shutterSettings[s].name, targetLevel2Set, false);
                                                                    shutterSettings[s].currentHeight = targetLevel2Set;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                    shutterSettings[s].currentAction = downAction;
                                                                    shutterSettings[s].lastAutoAction = 'Down_LivingTime';
                                                                    adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                    adapter.log.debug('shutterDownLiving #2 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                                else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                                    shutterSettings[s].currentHeight = targetLevel2Set;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                    shutterSettings[s].currentAction = downAction;
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                    adapter.log.debug('shutterDownLiving #2 ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                            });
                                                        } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                                            /**
                                                             * @param {any} err
                                                             * @param {{ val: any; }} state
                                                             */
                                                            adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                                    adapter.log.info('#19 Will close ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                                    shutterSettings[s].triggerHeight = targetLevel2Set;
                                                                    adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                                    shutterSettings[s].triggerAction = downAction;
                                                                    adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                    return (shutterSettings);
                                                                }
                                                            });
                                                        }
                                                    });
                                                }, driveDelayUpLiving * i, i);
                                            } else {
                                                adapter.log.info('Down living not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
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
        if (autoLivingStr == true) {
            setTimeout(function () {
                if (resultFull) {
                    // Filter Area Living Auto
                    const /**
                         * @param {{ typeDown: string; }} d
                         */
                        resLivingAuto = resultFull.filter(d => d.typeDown == 'living-auto');
                    // Filter enabled
                    let /**
                         * @param {{ enabled: boolean; }} d
                         */
                        resEnabled = resLivingAuto.filter(d => d.enabled === true);

                    let result = resEnabled;

                    for (const i in result) {
                        for (const s in shutterSettings) {
                            if (shutterSettings[s].shutterName == result[i].shutterName) {
                                const inSummerNotDown = CheckInSummerNotDown(adapter, shutterSettings[s]);
                                const XmasLevel = GetXmasLevel(adapter, shutterSettings[s]);

                                let targetLevel2Set = 0;
                                let downAction = 'down';

                                let pendingAlarm = false;
                                checkPendingAlarm(adapter, shutterSettings[s], function (resAlarmPending) {
                                    pendingAlarm = resAlarmPending;

                                    let statusAlarmFrost = false;
                                    checkFrostAlarm(adapter, shutterSettings[s], function (resAlarmFrost) {
                                        statusAlarmFrost = resAlarmFrost;

                                        if (getDate() < adapter.config.betweenPositionTime) {
                                            // between Position Level
                                            targetLevel2Set = shutterSettings[s].betweenPosition == true ? parseFloat(shutterSettings[s].betweenPositionLevel) : parseFloat(shutterSettings[s].heightDown);
                                            downAction = shutterSettings[s].betweenPosition == true ? 'middle' : 'down';
                                        } else {
                                            targetLevel2Set = parseFloat(shutterSettings[s].heightDown);
                                            downAction = 'down';
                                        }

                                        //entweder xmas level oder standard down level
                                        targetLevel2Set = XmasLevel > -1 ? XmasLevel : targetLevel2Set;
                                        downAction = XmasLevel > -1 ? 'Xmas' : downAction;

                                        // save current required position to alarmtrigger before overwriting
                                        shutterSettings[s].alarmTriggerLevel = targetLevel2Set;
                                        shutterSettings[s].alarmTriggerAction = downAction;

                                        // overwrite target position and downAction if frost alarm is set.
                                        if (statusAlarmFrost == true && shutterSettings[s].enableAlarmFrost == true) {
                                            targetLevel2Set = parseFloat(adapter.config.alarmFrostLevel);
                                            downAction = 'frost';
                                        }

                                        if (!inSummerNotDown) {

                                            let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                                            /**
                                             * @param {any} err
                                             * @param {boolean} state
                                             */
                                            adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                                                if (state && state === true || state && state.val === true) {
                                                    if (pendingAlarm == false) {
                                                        setTimeout(function () {
                                                            let currentValue = '';
                                                            /**
                                                             * @param {any} err
                                                             * @param {{ val: string; }} state
                                                             */
                                                            adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {
                                                                let mustValue = ('' + shutterSettings[s].triggerState);
                                                                let mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);
                                                                if (typeof state != undefined && state != null) {
                                                                    currentValue = ('' + state.val);
                                                                }
                                                                if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyUp' && shutterSettings[s].autoDrive != 'off')) {
                                                                    /**
                                                                     * @param {any} err
                                                                     * @param {{ val: any; }} state
                                                                     */
                                                                    adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                        if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                                            adapter.log.info('#20 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                                                            adapter.setForeignState(shutterSettings[s].name, targetLevel2Set, false);
                                                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                            shutterSettings[s].currentAction = downAction;
                                                                            shutterSettings[s].lastAutoAction = 'Down_LivingTime';
                                                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                            adapter.log.debug('shutterDownLiving #3 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                            return (shutterSettings);
                                                                        }
                                                                        else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                            shutterSettings[s].currentAction = downAction;
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                            adapter.log.debug('shutterDownLiving #3 ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                            return (shutterSettings);
                                                                        }
                                                                    });
                                                                } else if (shutterSettings[s].triggerID == '') {
                                                                    /**
                                                                     * @param {any} err
                                                                     * @param {{ val: any; }} state
                                                                     */
                                                                    adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                        if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                                            adapter.log.info('#21 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                                                            adapter.setForeignState(shutterSettings[s].name, targetLevel2Set, false);
                                                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                            shutterSettings[s].currentAction = downAction;
                                                                            shutterSettings[s].lastAutoAction = 'Down_LivingTime';
                                                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                            adapter.log.debug('shutterDownLiving #4 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                            return (shutterSettings);
                                                                        }
                                                                        else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                            shutterSettings[s].currentAction = downAction;
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                            adapter.log.debug('shutterDownLiving #4 ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                            return (shutterSettings);
                                                                        }

                                                                    });
                                                                } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                                                    /**
                                                                    * @param {any} err
                                                                    * @param {{ val: any; }} state
                                                                    */
                                                                    adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                        if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                                            adapter.log.info('#22 Will close ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                                            shutterSettings[s].triggerHeight = targetLevel2Set;
                                                                            adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                                            shutterSettings[s].triggerAction = downAction;
                                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                            return (shutterSettings);
                                                                        }
                                                                    });
                                                                }
                                                            });
                                                        }, driveDelayUpLiving * i, i);
                                                    } else {
                                                        adapter.log.info('Down living auto not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
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
            }, timeoutLivingAuto);
        }
    });
}

module.exports = shutterDownLiving;