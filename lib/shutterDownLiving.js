'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');         // shutterState
const IsSummerTime = require('./isSummerTime.js');         // IsSummerTime

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

                let inSummerNotDown = false;
                if (IsSummerTime(adapter)) {
                    inSummerNotDown = result[i].inSummerNotDown;

                    if (inSummerNotDown) {
                        adapter.log.debug(result[i].shutterName + ' in summer time not down ' + result[i].inSummerNotDown);
                    }
                    else {
                        adapter.log.debug(result[i].shutterName + ' in summer time down ' + result[i].inSummerNotDown);
                    }
                }

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
                                            if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                                                adapter.log.info('#17 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                                                adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                result[i].currentHeight = result[i].heightDown;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                result[i].currentAction = 'down';
                                                adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                adapter.log.debug('shutterDownLiving #1 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDownt + '%');
                                                shutterState(result[i].name, adapter);
                                            }
                                        });
                                    } else if (result[i].triggerID == '') {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: any; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                                                adapter.log.info('#18 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                                                adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                result[i].currentHeight = result[i].heightDown;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                result[i].currentAction = 'down';
                                                adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                adapter.log.debug('shutterDownLiving #2 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDown + '%');
                                                shutterState(result[i].name, adapter);
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

                        let inSummerNotDown = false;
                        if (IsSummerTime(adapter)) {
                            inSummerNotDown = result[i].inSummerNotDown;

                            if (inSummerNotDown) {
                                adapter.log.debug(result[i].shutterName + ' in summer time not down ' + result[i].inSummerNotDown);
                            }
                            else {
                                adapter.log.debug(result[i].shutterName + ' in summer time down ' + result[i].inSummerNotDown);
                            }
                        }

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
                                                    if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                                                        adapter.log.info('#19 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                        result[i].currentHeight = result[i].heightDown;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                        result[i].currentAction = 'down';
                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                        adapter.log.debug('shutterDownLiving #3 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDown + '%');
                                                        shutterState(result[i].name, adapter);
                                                    }
                                                });
                                            } else if (result[i].triggerID == '') {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: any; }} state
                                                 */
                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                                                        adapter.log.info('#20 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                        result[i].currentHeight = result[i].heightDown;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                        result[i].currentAction = 'down';
                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                        adapter.log.debug('shutterDownLiving #4 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDown + '%');
                                                        shutterState(result[i].name, adapter);
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