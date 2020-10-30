'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');         // shutterState
//const IsSummerTime = require('./isSummerTime.js');         // IsSummerTime

const CheckInSummerNotDown = require('./isSummerTime.js').CheckInSummerNotDown;
const GetXmasLevel = require('./isSummerTime.js').GetXmasLevel;

function shutterDownChildren(adapter, downTimeChildren, delayDown, autoChildrenStr) {

    const driveDelayUpChildren = adapter.config.driveDelayUpChildren * 1000;
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving * 1000;

    if ((downTimeChildren) == undefined) {
        downTimeChildren = adapter.config.W_shutterDownChildren;
    }

    let downTime;

    try {
        downTime = downTimeChildren.split(':');
    } catch (e) {
        adapter.log.debug('downtime for the childrenarea is not defined ... Please check your config!!');
    }
    /** @type {number | undefined} */
    let timeoutChildrenAuto;

    schedule.cancelJob('shutterDownChildren');
    try {
        const downChildren = schedule.scheduleJob('shutterDownChildren', downTime[1] + ' ' + downTime[0] + ' * * *', function () {
            delayDown = delayDown * driveDelayUpLiving;
            setTimeout(function () {
                // Full Result
                const resultFull = adapter.config.events;

                if (resultFull) {
                    // Filter Area children
                    const /**
                     * @param {{ typeDown: string; }} d
                     */
                        resChildren = resultFull.filter(d => d.typeDown == 'children');
                    // Filter enabled
                    let /**
                     * @param {{ enabled: boolean; }} d
                     */
                        resEnabled = resChildren.filter(d => d.enabled === true);

                    let result = resEnabled;
                    let number = 0;

                    for (const i in result) {
                        number++;
                    }

                    timeoutChildrenAuto = number * driveDelayUpChildren;

                    for (const i in result) {
                        const inSummerNotDown = CheckInSummerNotDown(adapter, result[i]);

                        const XmasLevel = GetXmasLevel(adapter, result[i]);

                        //entweder xmas level oder standard down level
                        const targetLevel2Set = XmasLevel > -1 ? XmasLevel : result[i].heightDown;

                        if (!inSummerNotDown) {

                            let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                            adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                                if (state && state === true || state && state.val === true) {
                                    setTimeout(function () {
                                        let currentValue = '';
                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            const mustValue = ('' + result[i].triggerState);
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
                                                        adapter.log.info('#26 Set ID: ' + result[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                        adapter.setForeignState(result[i].name, parseFloat(targetLevel2Set), false);
                                                        result[i].currentHeight = targetLevel2Set;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                        result[i].currentAction = 'down';
                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                        adapter.log.debug('shutterDownChildren #1 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                        shutterState(result[i].name, adapter);
                                                    }
                                                    else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                        result[i].currentHeight = targetLevel2Set;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                        result[i].currentAction = 'down';
                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                        adapter.log.debug('shutterDownChildren #1 ' + result[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + result[i].currentAction);
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
                                                        adapter.log.info('#27 Set ID: ' + result[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                        adapter.setForeignState(result[i].name, parseFloat(targetLevel2Set), false);
                                                        result[i].currentHeight = targetLevel2Set;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                        result[i].currentAction = 'down';
                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                        adapter.log.debug('shutterDownChildren #2 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                        shutterState(result[i].name, adapter);
                                                    }
                                                    else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                        result[i].currentHeight = targetLevel2Set;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                        result[i].currentAction = 'down';
                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                        adapter.log.debug('shutterDownChildren #2 ' + result[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + result[i].currentAction);
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
                                                        adapter.log.info('#28 Will close ID: ' + result[i].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                        result[i].triggerHeight = targetLevel2Set;
                                                        adapter.log.debug('save new trigger height: ' + result[i].triggerHeight + '%');
                                                        result[i].triggerAction = 'down';
                                                        adapter.log.debug('save new trigger action: ' + result[i].triggerAction);
                                                    }
                                                });
                                            }
                                        });
                                    }, driveDelayUpChildren * i, i);
                                }
                            });
                        }
                    }
                }
                if (autoChildrenStr == true) {
                    setTimeout(function () {
                        // Full Result
                        const resultFull = adapter.config.events;

                        if (resultFull) {
                            // Filter Area children
                            const /**
                             * @param {{ typeDown: string; }} d
                             */
                                resChildren = resultFull.filter(d => d.typeDown == 'children-auto');
                            // Filter enabled
                            let /**
                             * @param {{ enabled: boolean; }} d
                             */
                                resEnabled = resChildren.filter(d => d.enabled === true);

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
                                                                adapter.log.info('#29 Set ID: ' + result[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                                adapter.setForeignState(result[i].name, parseFloat(targetLevel2Set), false);
                                                                result[i].currentHeight = targetLevel2Set;
                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                                result[i].currentAction = 'down';
                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                adapter.log.debug('shutterDownChildren #3 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                                shutterState(result[i].name, adapter);
                                                            }
                                                            else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                                result[i].currentHeight = targetLevel2Set;
                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                                result[i].currentAction = 'down';
                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                adapter.log.debug('shutterDownChildren #3 ' + result[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + result[i].currentAction);
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
                                                                adapter.log.info('#30 Set ID: ' + result[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                                adapter.setForeignState(result[i].name, parseFloat(targetLevel2Set), false);
                                                                result[i].currentHeight = targetLevel2Set;
                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                                result[i].currentAction = 'down';
                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                adapter.log.debug('shutterDownChildren #4 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                                shutterState(result[i].name, adapter);
                                                            }
                                                            else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                                result[i].currentHeight = targetLevel2Set;
                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                                result[i].currentAction = 'down';
                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                adapter.log.debug('shutterDownChildren #4 ' + result[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + result[i].currentAction);
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
                                                                adapter.log.info('#31 Will close ID: ' + result[i].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                                result[i].triggerHeight = targetLevel2Set;
                                                                adapter.log.debug('save new trigger height: ' + result[i].triggerHeight + '%');
                                                                result[i].triggerAction = 'down';
                                                                adapter.log.debug('save new trigger action: ' + result[i].triggerAction);
                                                            }
                                                        });
                                                    }
                                                });
                                            }, driveDelayUpChildren * i, i);
                                        }
                                    });
                                }
                            }
                        }
                    }, timeoutChildrenAuto);
                }
            }, delayDown);
        });
    } catch (e) {
        adapter.log.debug('error on downtime for childrenarea ... please check your config!!');
    }
}
module.exports = shutterDownChildren;