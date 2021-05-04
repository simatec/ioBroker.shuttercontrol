'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');         // shutterState
//const IsSummerTime = require('./isSummerTime.js');         // IsSummerTime

const CheckInSummerNotDown = require('./isSummerTime.js').CheckInSummerNotDown;
const GetXmasLevel = require('./isSummerTime.js').GetXmasLevel;

function getDate(d) {
    d = d || new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

function shutterDownSleep(adapter, downTimeSleep, delayDown, autoSleepStr, shutterSettings) {

    const driveDelayUpSleep = adapter.config.driveDelayUpSleep * 1000;
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving * 1000;

    if ((downTimeSleep) == undefined) {
        downTimeSleep = adapter.config.W_shutterDownSleep;
    }
    let downTime = downTimeSleep.split(':');
    /** @type {number | undefined} */
    let timeoutSleepAuto;

    schedule.cancelJob('shutterDownSleep');

    const downSleep = schedule.scheduleJob('shutterDownSleep', downTime[1] + ' ' + downTime[0] + ' * * *', function () {
        delayDown = delayDown * driveDelayUpLiving;
        setTimeout(function () {
            // Full Result
            const resultFull = shutterSettings;

            if (resultFull) {
                // Filter Area sleep
                const /**
                     * @param {{ typeDown: string; }} d
                     */
                    resSleep = resultFull.filter(d => d.typeDown == 'sleep');
                // Filter enabled
                let /**
                     * @param {{ enabled: boolean; }} d
                     */
                    resEnabled = resSleep.filter(d => d.enabled === true);

                let result = resEnabled;
                let number = 0;

                for (const i in result) {
                    number++;
                }

                timeoutSleepAuto = number * driveDelayUpSleep;

                for (const i in result) {
                    for (const s in shutterSettings) {
                        if (shutterSettings[s].shutterName == result[i].shutterName) {
                            const inSummerNotDown = CheckInSummerNotDown(adapter, shutterSettings[s]);

                            const XmasLevel = GetXmasLevel(adapter, shutterSettings[s]);

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

                            //entweder xmas level oder standard down level
                            targetLevel2Set = XmasLevel > -1 ? XmasLevel : targetLevel2Set;
                            downAction = XmasLevel > -1 ? 'Xmas' : downAction;

                            if (!inSummerNotDown) {

                                let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                                adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                                    if (state && state === true || state && state.val === true) {
                                        setTimeout(function () {
                                            let currentValue = '';
                                            /**
                                             * @param {any} err
                                             * @param {{ val: string; }} state
                                             */
                                            adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {
                                                const mustValue = ('' + shutterSettings[s].triggerState);
                                                if (typeof state != undefined && state != null) {
                                                    currentValue = ('' + state.val);
                                                }
                                                if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyUp' && shutterSettings[s].autoDrive != 'off')) {
                                                    /**
                                                     * @param {any} err
                                                     * @param {{ val: any; }} state
                                                     */
                                                    adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                        if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                            adapter.log.info('#26 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                                            adapter.setForeignState(shutterSettings[s].name, targetLevel2Set, false);
                                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                            shutterSettings[s].currentAction = downAction;
                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                            adapter.log.debug('shutterDownSleep #1 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                            return (shutterSettings);
                                                        }
                                                        else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                            shutterSettings[s].currentAction = downAction;
                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                            adapter.log.debug('shutterDownSleep #1 ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
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
                                                            adapter.log.info('#27 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                                            adapter.setForeignState(shutterSettings[s].name, targetLevel2Set, false);
                                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                            shutterSettings[s].currentAction = downAction;
                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                            adapter.log.debug('shutterDownSleep #2 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                            return (shutterSettings);
                                                        }
                                                        else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                            shutterSettings[s].currentAction = downAction;
                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                            adapter.log.debug('shutterDownSleep #2 ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                            return (shutterSettings);
                                                        }
                                                    });
                                                } else if (currentValue != mustValue && shutterSettings[s].autoDrive == 'onlyUp' && shutterSettings[s].driveAfterClose == true) {
                                                    /**
                                                     * @param {any} err
                                                     * @param {{ val: any; }} state
                                                     */
                                                    adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                        if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                            adapter.log.info('#28 Will close ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                            shutterSettings[s].triggerHeight = targetLevel2Set;
                                                            adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                            shutterSettings[s].triggerAction = downAction;
                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                            return (shutterSettings);
                                                        }
                                                    });
                                                }
                                            });
                                        }, driveDelayUpSleep * i, i);
                                    }
                                });
                            }
                        }
                    }
                }
            }
            if (autoSleepStr == true) {
                setTimeout(function () {
                    // Full Result
                    const resultFull = shutterSettings;

                    if (resultFull) {
                        // Filter Area sleep
                        const /**
                             * @param {{ typeDown: string; }} d
                             */
                            resSleep = resultFull.filter(d => d.typeDown == 'sleep-auto');
                        // Filter enabled
                        let /**
                             * @param {{ enabled: boolean; }} d
                             */
                            resEnabled = resSleep.filter(d => d.enabled === true);

                        let result = resEnabled;

                        for (const i in result) {
                            for (const s in shutterSettings) {
                                if (shutterSettings[s].shutterName == result[i].shutterName) {
                                    const inSummerNotDown = CheckInSummerNotDown(adapter, shutterSettings[s]);

                                    const XmasLevel = GetXmasLevel(adapter, shutterSettings[s]);

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

                                    //entweder xmas level oder standard down level
                                    targetLevel2Set = XmasLevel > -1 ? XmasLevel : targetLevel2Set;
                                    downAction = XmasLevel > -1 ? 'Xmas' : downAction;

                                    if (!inSummerNotDown) {

                                        let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                                        /**
                                         * @param {any} err
                                         * @param {boolean} state
                                         */
                                        adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                                            if (state && state === true || state && state.val === true) {
                                                setTimeout(function () {
                                                    let currentValue = '';
                                                    /**
                                                     * @param {any} err
                                                     * @param {{ val: string; }} state
                                                     */
                                                    adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {
                                                        let mustValue = ('' + shutterSettings[s].triggerState);
                                                        if (typeof state != undefined && state != null) {
                                                            currentValue = ('' + state.val);
                                                        }
                                                        if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyUp' && shutterSettings[s].autoDrive != 'off')) {
                                                            /**
                                                             * @param {any} err
                                                             * @param {{ val: any; }} state
                                                             */
                                                            adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                                    adapter.log.info('#29 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                                                    adapter.setForeignState(shutterSettings[s].name, targetLevel2Set, false);
                                                                    shutterSettings[s].currentHeight = targetLevel2Set;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                                    shutterSettings[s].currentAction = downAction;
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                    adapter.log.debug('shutterDownSleep #3 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                                else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                                    shutterSettings[s].currentHeight = targetLevel2Set;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                                    shutterSettings[s].currentAction = downAction;
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                    adapter.log.debug('shutterDownSleep #3 ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
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
                                                                    adapter.log.info('#30 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                                                    adapter.setForeignState(shutterSettings[s].name, targetLevel2Set, false);
                                                                    shutterSettings[s].currentHeight = targetLevel2Set;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                                    shutterSettings[s].currentAction = downAction;
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                    adapter.log.debug('shutterDownSleep #4 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                                else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                                    shutterSettings[s].currentHeight = targetLevel2Set;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                                    shutterSettings[s].currentAction = downAction;
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                    adapter.log.debug('shutterDownSleep #4 ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                            });
                                                        } else if (currentValue != mustValue && shutterSettings[s].autoDrive == 'onlyUp' && shutterSettings[s].driveAfterClose == true) {
                                                            /**
                                                             * @param {any} err
                                                             * @param {{ val: any; }} state
                                                             */
                                                            adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                                    adapter.log.info('#31 Will close ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                                    shutterSettings[s].triggerHeight = targetLevel2Set;
                                                                    adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                                    shutterSettings[s].triggerAction = downAction;
                                                                    adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                    return (shutterSettings);
                                                                }
                                                            });
                                                        }
                                                    });
                                                }, driveDelayUpSleep * i, i);
                                            }
                                        });
                                    }
                                }
                            }
                        }
                    }
                }, timeoutSleepAuto);
            }
        }, delayDown);
    });
}
module.exports = shutterDownSleep;