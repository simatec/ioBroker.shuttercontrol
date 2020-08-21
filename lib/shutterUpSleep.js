'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');         // shutterState

function shutterUpSleep(adapter, upTimeSleep, delayUp, autoSleepStr) {

    const driveDelayUpSleep = adapter.config.driveDelayUpSleep * 1000;
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving * 1000;
    const noGoDelay = adapter.config.noGoTime * 1000 *60;

    if ((upTimeSleep) == undefined) {
        upTimeSleep = adapter.config.W_shutterUpSleepMax;
    }
    let upTime = upTimeSleep.split(':');
    /** @type {number | undefined} */
    let timeoutSleepAuto;

    schedule.cancelJob('shutterUpSleep');

    const upSleep = schedule.scheduleJob('shutterUpSleep', upTime[1] + ' ' + upTime[0] + ' * * *', function () {

        delayUp = delayUp * driveDelayUpLiving;
        setTimeout(function () {
            // Full Result
            const resultFull = adapter.config.events;

            if (resultFull) {
                // Filter Area sleep
                const /**
                     * @param {{ typeUp: string; }} d
                     */
                    resSleep = resultFull.filter(d => d.typeUp == 'sleep');
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
                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                    /**
                     * @param {any} err
                     * @param {boolean} state
                     */
                    adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {
                            setTimeout(function () {
                                let shutterHeight = 0;
                                if (result[i].currentAction == 'sunProtect' || result[i].currentAction == 'OpenInSunProtect') {
                                    shutterHeight = parseFloat(result[i].heightDownSun);
                                    result[i].currentAction = 'sunProtect';
                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                } else {
                                    shutterHeight = parseFloat(result[i].heightUp);
                                    result[i].currentAction = 'up';
                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                }
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
                                    if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].autoDrive != 'off')) {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: number; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                adapter.log.info('#21 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                                adapter.setForeignState(result[i].name, shutterHeight, false);
                                                result[i].currentHeight = shutterHeight;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                adapter.log.debug('shutterUpSleep #1 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + shutterHeight + '%');
                                                shutterState(result[i].name, adapter);
                                            }
											else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                result[i].currentHeight = shutterHeight;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                adapter.log.debug('shutterUpSleep #1 ' + result[i].shutterName + 'already up at: ' + shutterHeight + '% - setting current action: ' + result[i].currentAction);
                                                shutterState(result[i].name, adapter);
                                            }
                                        });
                                    } else if (result[i].triggerID == '') {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: number; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != shutterHeight &&  Date.now() >= (state.lc + noGoDelay)) {
                                                adapter.log.info('#22 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                                adapter.setForeignState(result[i].name, shutterHeight, false);
                                                result[i].currentHeight = shutterHeight;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                adapter.log.debug('shutterUpSleep #2 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + shutterHeight + '%');
                                                shutterState(result[i].name, adapter);
                                            }
											else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                result[i].currentHeight = shutterHeight;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                adapter.log.debug('shutterUpSleep #2 ' + result[i].shutterName + 'already up at: ' + shutterHeight + '% - setting current action: ' + result[i].currentAction);
                                                shutterState(result[i].name, adapter);
                                            }
                                        });
                                    }
                                });
                            }, driveDelayUpSleep * i, i);
                        }
                    });
                }
            }
            if (autoSleepStr == true) {
                setTimeout(function () {
                    // Full Result
                    const resultFull = adapter.config.events;
                    // Filter Area sleep
                    if (resultFull) {
                        const /**
                             * @param {{ typeUp: string; }} d
                             */
                            resSleep = resultFull.filter(d => d.typeUp == 'sleep-auto');
                        // Filter enabled
                        let /**
                             * @param {{ enabled: boolean; }} d
                             */
                            resEnabled = resSleep.filter(d => d.enabled === true);

                        let result = resEnabled;

                        for (const i in result) {
                            let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                            /**
                             * @param {any} err
                             * @param {boolean} state
                             */
                            adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                                if (state && state === true || state && state.val === true) {
                                    setTimeout(function () {
                                        let shutterHeight = 0;
                                        if (result[i].currentAction == 'sunProtect' || result[i].currentAction == 'OpenInSunProtect') {
                                            shutterHeight = parseFloat(result[i].heightDownSun);
                                            result[i].currentAction = 'sunProtect';
                                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                        } else {
                                            shutterHeight = parseFloat(result[i].heightUp);
                                            result[i].currentAction = 'up';
                                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                        }
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
                                            if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].autoDrive != 'off')) {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: number; }} state
                                                 */
                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                        adapter.log.info('#23 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                                        adapter.setForeignState(result[i].name, shutterHeight, false);
                                                        result[i].currentHeight = shutterHeight;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                        adapter.log.debug('shutterUpSleep #3 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + shutterHeight + '%');
                                                        shutterState(result[i].name, adapter);
                                                    }
													else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
														result[i].currentHeight = shutterHeight;
														adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
														adapter.log.debug('shutterUpSleep #3 ' + result[i].shutterName + 'already up at: ' + shutterHeight + '% - setting current action: ' + result[i].currentAction);
														shutterState(result[i].name, adapter);
													}
                                                });
                                            } else if (result[i].triggerID == '') {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: number; }} state
                                                 */
                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                        adapter.log.info('#24 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                                        adapter.setForeignState(result[i].name, shutterHeight, false);
                                                        result[i].currentHeight = shutterHeight;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                        adapter.log.debug('shutterUpSleep #4 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + shutterHeight + '%');
                                                        shutterState(result[i].name, adapter);
                                                    }
													else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
														result[i].currentHeight = shutterHeight;
														adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
														adapter.log.debug('shutterUpSleep #4 ' + result[i].shutterName + 'already up at: ' + shutterHeight + '% - setting current action: ' + result[i].currentAction);
														shutterState(result[i].name, adapter);
													}
                                                });
                                            }
                                        });
                                    }, driveDelayUpSleep * i, i);
                                }
                            });
                        }
                    }
                }, timeoutSleepAuto);
            }
        }, delayUp);
    });
}
module.exports = shutterUpSleep;