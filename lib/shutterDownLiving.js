'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');         // shutterState
//const IsSummerTime = require('./isSummerTime.js');         // IsSummerTime

const CheckInSummerNotDown = require('./isSummerTime.js').CheckInSummerNotDown;
const GetXmasLevel = require('./isSummerTime.js').GetXmasLevel;

function shutterDownLiving(adapter, downTimeLiving, autoLivingStr) {

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
        const resultFull = adapter.config.events;

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

                const inSummerNotDown = CheckInSummerNotDown(adapter, result[i]);

                const XmasLevel = GetXmasLevel(adapter, result[i]);

                //entweder xmas level oder standard down level
                const targetLevel2Set = XmasLevel > -1 ? XmasLevel : result[i].heightDown;

                if (!inSummerNotDown) {

                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
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
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    let mustValue = ('' + result[i].triggerState);
                                    if (typeof state != undefined && state != null) {
                                        currentValue = ('' + state.val);
                                    }
                                    if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp' && result[i].autoDrive != 'off')) {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: any; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                adapter.log.info('#17 Set ID: ' + result[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                adapter.setForeignState(result[i].name, parseFloat(targetLevel2Set), false);
                                                result[i].currentHeight = targetLevel2Set;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                result[i].currentAction = 'down';
                                                adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                adapter.log.debug('shutterDownLiving #1 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                shutterState(result[i].name, adapter);
                                            }
                                            else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                result[i].currentHeight = targetLevel2Set;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                result[i].currentAction = 'down';
                                                adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                adapter.log.debug('shutterDownLiving #1 ' + result[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + result[i].currentAction);
                                                shutterState(result[i].name, adapter);
                                            }
                                        });
                                    } else if (result[i].triggerID == '') {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: any; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                adapter.log.info('#18 Set ID: ' + result[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                adapter.setForeignState(result[i].name, parseFloat(targetLevel2Set), false);
                                                result[i].currentHeight = targetLevel2Set;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                result[i].currentAction = 'down';
                                                adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                adapter.log.debug('shutterDownLiving #2 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                shutterState(result[i].name, adapter);
                                            }
                                            else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                result[i].currentHeight = targetLevel2Set;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                result[i].currentAction = 'down';
                                                adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                adapter.log.debug('shutterDownLiving #2 ' + result[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + result[i].currentAction);
                                                shutterState(result[i].name, adapter);
                                            }
                                        });
                                    } else if (currentValue != mustValue && result[i].autoDrive == 'onlyUp' && result[i].driveAfterClose == true) {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: any; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                adapter.log.info('#19 Will close ID: ' + result[i].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                result[i].triggerHeight = targetLevel2Set;
                                                adapter.log.debug('save new trigger height: ' + result[i].triggerHeight + '%');
                                                result[i].triggerAction = 'down';
                                                adapter.log.debug('save new trigger action: ' + result[i].triggerAction);
                                            }
                                        });
                                    }
                                });
                            }, driveDelayUpLiving * i, i);
                        }
                    });
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

                        const inSummerNotDown = CheckInSummerNotDown(adapter, result[i]);

                        const XmasLevel = GetXmasLevel(adapter, result[i]);

                        //entweder xmas level oder standard down level
                        const targetLevel2Set = XmasLevel > -1 ? XmasLevel : result[i].heightDown;

                        if (!inSummerNotDown) {

                            let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
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
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp' && result[i].autoDrive != 'off')) {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: any; }} state
                                                 */
                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                        adapter.log.info('#20 Set ID: ' + result[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                        adapter.setForeignState(result[i].name, parseFloat(targetLevel2Set), false);
                                                        result[i].currentHeight = targetLevel2Set;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                        result[i].currentAction = 'down';
                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                        adapter.log.debug('shutterDownLiving #3 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                        shutterState(result[i].name, adapter);
                                                    }
                                                    else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                        result[i].currentHeight = targetLevel2Set;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                        result[i].currentAction = 'down';
                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                        adapter.log.debug('shutterDownLiving #3 ' + result[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + result[i].currentAction);
                                                        shutterState(result[i].name, adapter);
                                                    }
                                                });
                                            } else if (result[i].triggerID == '') {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: any; }} state
                                                 */
                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                        adapter.log.info('#21 Set ID: ' + result[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                        adapter.setForeignState(result[i].name, parseFloat(targetLevel2Set), false);
                                                        result[i].currentHeight = targetLevel2Set;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                        result[i].currentAction = 'down';
                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                        adapter.log.debug('shutterDownLiving #4 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                        shutterState(result[i].name, adapter);
                                                    }
                                                    else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                        result[i].currentHeight = targetLevel2Set;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                        result[i].currentAction = 'down';
                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                        adapter.log.debug('shutterDownLiving #4 ' + result[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + result[i].currentAction);
                                                        shutterState(result[i].name, adapter);
                                                    }

                                                });
                                            } else if (currentValue != mustValue && result[i].autoDrive == 'onlyUp' && result[i].driveAfterClose == true) {
                                                /**
                                                * @param {any} err
                                                * @param {{ val: any; }} state
                                                */
                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                        adapter.log.info('#22 Will close ID: ' + result[i].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                        result[i].triggerHeight = targetLevel2Set;
                                                        adapter.log.debug('save new trigger height: ' + result[i].triggerHeight + '%');
                                                        result[i].triggerAction = 'down';
                                                        adapter.log.debug('save new trigger action: ' + result[i].triggerAction);
                                                    }
                                                });
                                            }
                                        });
                                    }, driveDelayUpLiving * i, i);
                                }
                            });
                        }
                    }
                }
            }, timeoutLivingAuto);
        }
    });
}

module.exports = shutterDownLiving;