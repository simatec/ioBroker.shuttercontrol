'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');         // shutterState
//const IsSummerTime = require('./isSummerTime.js');         // IsSummerTime

const CheckInSummerNotDown = require('./isSummerTime.js').CheckInSummerNotDown;
const GetXmasLevel = require('./isSummerTime.js').GetXmasLevel;

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
                                                adapter.log.info('#17 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                adapter.setForeignState(shutterSettings[i].name, parseFloat(targetLevel2Set), false);
                                                shutterSettings[i].currentHeight = targetLevel2Set;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                shutterSettings[i].currentAction = 'down';
                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                adapter.log.debug('shutterDownLiving #1 ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                return (shutterSettings);
                                            }
                                            else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                shutterSettings[i].currentHeight = targetLevel2Set;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                shutterSettings[i].currentAction = 'down';
                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                adapter.log.debug('shutterDownLiving #1 ' + shutterSettings[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[i].currentAction);
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
                                                adapter.log.info('#18 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                adapter.setForeignState(shutterSettings[i].name, parseFloat(targetLevel2Set), false);
                                                shutterSettings[i].currentHeight = targetLevel2Set;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                shutterSettings[i].currentAction = 'down';
                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                adapter.log.debug('shutterDownLiving #2 ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                return (shutterSettings);
                                            }
                                            else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                shutterSettings[i].currentHeight = targetLevel2Set;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                shutterSettings[i].currentAction = 'down';
                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                adapter.log.debug('shutterDownLiving #2 ' + shutterSettings[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[i].currentAction);
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
                                                adapter.log.info('#19 Will close ID: ' + shutterSettings[i].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                shutterSettings[i].triggerHeight = targetLevel2Set;
                                                adapter.log.debug('save new trigger height: ' + shutterSettings[i].triggerHeight + '%');
                                                shutterSettings[i].triggerAction = 'down';
                                                adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
                                                return (shutterSettings);
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
                                                        adapter.log.info('#20 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                        adapter.setForeignState(shutterSettings[i].name, parseFloat(targetLevel2Set), false);
                                                        shutterSettings[i].currentHeight = targetLevel2Set;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                        shutterSettings[i].currentAction = 'down';
                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                        adapter.log.debug('shutterDownLiving #3 ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                        shutterState(shutterSettings[i].name, adapter);
                                                    }
                                                    else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                        shutterSettings[i].currentHeight = targetLevel2Set;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                        shutterSettings[i].currentAction = 'down';
                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                        adapter.log.debug('shutterDownLiving #3 ' + shutterSettings[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[i].currentAction);
                                                        shutterState(shutterSettings[i].name, adapter);
                                                    }
                                                });
                                            } else if (shutterSettings[i].triggerID == '') {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: any; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                        adapter.log.info('#21 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                        adapter.setForeignState(shutterSettings[i].name, parseFloat(targetLevel2Set), false);
                                                        shutterSettings[i].currentHeight = targetLevel2Set;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                        shutterSettings[i].currentAction = 'down';
                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                        adapter.log.debug('shutterDownLiving #4 ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                                        shutterState(shutterSettings[i].name, adapter);
                                                    }
                                                    else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                        shutterSettings[i].currentHeight = targetLevel2Set;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                        shutterSettings[i].currentAction = 'down';
                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                        adapter.log.debug('shutterDownLiving #4 ' + shutterSettings[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[i].currentAction);
                                                        shutterState(shutterSettings[i].name, adapter);
                                                    }

                                                });
                                            } else if (currentValue != mustValue && shutterSettings[i].autoDrive == 'onlyUp' && shutterSettings[i].driveAfterClose == true) {
                                                /**
                                                * @param {any} err
                                                * @param {{ val: any; }} state
                                                */
                                                adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                        adapter.log.info('#22 Will close ID: ' + shutterSettings[i].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                        shutterSettings[i].triggerHeight = targetLevel2Set;
                                                        adapter.log.debug('save new trigger height: ' + shutterSettings[i].triggerHeight + '%');
                                                        shutterSettings[i].triggerAction = 'down';
                                                        adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
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