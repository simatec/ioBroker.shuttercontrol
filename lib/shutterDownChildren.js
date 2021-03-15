'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');         // shutterState
//const IsSummerTime = require('./isSummerTime.js');         // IsSummerTime

const CheckInSummerNotDown = require('./isSummerTime.js').CheckInSummerNotDown;
const GetXmasLevel = require('./isSummerTime.js').GetXmasLevel;


function shutterDownChildren(adapter, downTimeChildren, delayDown, autoChildrenStr, shutterSettings) {

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
                const resultFull = shutterSettings;

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
                        const inSummerNotDown = CheckInSummerNotDown(adapter, shutterSettings[i]);

                        const XmasLevel = GetXmasLevel(adapter, shutterSettings[i]);

                        // between Position Level
                        let targetLevel2Set = shutterSettings[i].betweenPosition == true ? shutterSettings[i].betweenPositionLevel : shutterSettings[i].heightDown;

                        //entweder xmas level oder standard down level
                        targetLevel2Set = XmasLevel > -1 ? XmasLevel : targetLevel2Set;

                        if (!inSummerNotDown) {

                            let nameDevice = shutterSettings[i].shutterName.replace(/[.;, ]/g, '_');
                            adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                                if (state && state === true || state && state.val === true) {
                                    setTimeout(function () {
                                        let currentValue = '';
                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(shutterSettings[i].triggerID, (err, state) => {
                                            const mustValue = ('' + shutterSettings[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyUp' && shutterSettings[i].autoDrive != 'off')) {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: any; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                        adapter.log.info('#26 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                        adapter.setForeignState(shutterSettings[i].name, parseFloat(targetLevel2Set), false);
                                                        shutterSettings[i].currentHeight = targetLevel2Set;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                        shutterSettings[i].currentAction = 'down';
                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                        adapter.log.debug('shutterDownChildren #1 ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                        shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                        return (shutterSettings);
                                                    }
                                                    else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                        shutterSettings[i].currentHeight = targetLevel2Set;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                        shutterSettings[i].currentAction = 'down';
                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                        adapter.log.debug('shutterDownChildren #1 ' + shutterSettings[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[i].currentAction);
                                                        shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                        return (shutterSettings);
                                                    }
                                                });
                                            } else if (shutterSettings[i].triggerID == '') {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: any; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                        adapter.log.info('#27 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                        adapter.setForeignState(shutterSettings[i].name, parseFloat(targetLevel2Set), false);
                                                        shutterSettings[i].currentHeight = targetLevel2Set;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                        shutterSettings[i].currentAction = 'down';
                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                        adapter.log.debug('shutterDownChildren #2 ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                        shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                        return (shutterSettings);
                                                    }
                                                    else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                        shutterSettings[i].currentHeight = targetLevel2Set;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                        shutterSettings[i].currentAction = 'down';
                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                        adapter.log.debug('shutterDownChildren #2 ' + shutterSettings[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[i].currentAction);
                                                        shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                        return (shutterSettings);
                                                    }
                                                });
                                            } else if (currentValue != mustValue && shutterSettings[i].autoDrive == 'onlyUp' && shutterSettings[i].driveAfterClose == true) {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: any; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                        adapter.log.info('#28 Will close ID: ' + shutterSettings[i].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                        shutterSettings[i].triggerHeight = targetLevel2Set;
                                                        adapter.log.debug('save new trigger height: ' + shutterSettings[i].triggerHeight + '%');
                                                        shutterSettings[i].triggerAction = 'down';
                                                        adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
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
                        const resultFull = shutterSettings;

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

                                const inSummerNotDown = CheckInSummerNotDown(adapter, shutterSettings[i]);

                                const XmasLevel = GetXmasLevel(adapter, shutterSettings[i]);

                                // between Position Level
                                let targetLevel2Set = shutterSettings[i].betweenPosition == true ? shutterSettings[i].betweenPositionLevel : shutterSettings[i].heightDown;

                                //entweder xmas level oder standard down level
                                targetLevel2Set = XmasLevel > -1 ? XmasLevel : targetLevel2Set;

                                if (!inSummerNotDown) {

                                    let nameDevice = shutterSettings[i].shutterName.replace(/[.;, ]/g, '_');
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
                                                adapter.getForeignState(shutterSettings[i].triggerID, (err, state) => {
                                                    let mustValue = ('' + shutterSettings[i].triggerState);
                                                    if (typeof state != undefined && state != null) {
                                                        currentValue = ('' + state.val);
                                                    }
                                                    if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyUp' && shutterSettings[i].autoDrive != 'off')) {
                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: any; }} state
                                                         */
                                                        adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                            if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                                adapter.log.info('#29 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                                adapter.setForeignState(shutterSettings[i].name, parseFloat(targetLevel2Set), false);
                                                                shutterSettings[i].currentHeight = targetLevel2Set;
                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                                shutterSettings[i].currentAction = 'down';
                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                adapter.log.debug('shutterDownChildren #3 ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                                shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                                return (shutterSettings);
                                                            }
                                                            else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                                shutterSettings[i].currentHeight = targetLevel2Set;
                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                                shutterSettings[i].currentAction = 'down';
                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                adapter.log.debug('shutterDownChildren #3 ' + shutterSettings[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[i].currentAction);
                                                                shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                                return (shutterSettings);
                                                            }
                                                        });
                                                    } else if (shutterSettings[i].triggerID == '') {
                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: any; }} state
                                                         */
                                                        adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                            if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                                adapter.log.info('#30 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                                adapter.setForeignState(shutterSettings[i].name, parseFloat(targetLevel2Set), false);
                                                                shutterSettings[i].currentHeight = targetLevel2Set;
                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                                shutterSettings[i].currentAction = 'down';
                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                adapter.log.debug('shutterDownChildren #4 ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                                shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                                return (shutterSettings);
                                                            }
                                                            else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                                shutterSettings[i].currentHeight = targetLevel2Set;
                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                                shutterSettings[i].currentAction = 'down';
                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                adapter.log.debug('shutterDownChildren #4 ' + shutterSettings[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[i].currentAction);
                                                                shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                                return (shutterSettings);
                                                            }
                                                        });
                                                    } else if (currentValue != mustValue && shutterSettings[i].autoDrive == 'onlyUp' && shutterSettings[i].driveAfterClose == true) {
                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: any; }} state
                                                         */
                                                        adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                            if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                                adapter.log.info('#31 Will close ID: ' + shutterSettings[i].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                                shutterSettings[i].triggerHeight = targetLevel2Set;
                                                                adapter.log.debug('save new trigger height: ' + shutterSettings[i].triggerHeight + '%');
                                                                shutterSettings[i].triggerAction = 'down';
                                                                adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
                                                                return (shutterSettings);
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