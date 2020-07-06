'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');         // shutterState

function shutterUpLiving(adapter, upTimeLiving, autoLivingStr) {

    const driveDelayUpLiving = adapter.config.driveDelayUpLiving * 1000;

    if ((upTimeLiving) == undefined) {
        upTimeLiving = adapter.config.W_shutterUpLivingMax;
    }
    let upTime = upTimeLiving.split(':');
    /** @type {number | undefined} */
    let timeoutLivingAuto;

    schedule.cancelJob('shutterUpLiving');

    const upLiving = schedule.scheduleJob('shutterUpLiving', upTime[1] + ' ' + upTime[0] + ' * * *', function () {
        // Full Result
        const resultFull = adapter.config.events;

        if (resultFull) {
            // Filter Area Living
            const /**
                 * @param {{ typeUp: string; }} d
                 */
                resLiving = resultFull.filter(d => d.typeUp == 'living');
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
                                            adapter.log.info('#13 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                            adapter.setForeignState(result[i].name, shutterHeight, false);
                                            result[i].currentHeight = shutterHeight;
                                            adapter.log.debug('shutterUpLiving #1 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + shutterHeight + '%');
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
                                            adapter.log.info('#14 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                            adapter.setForeignState(result[i].name, shutterHeight, false);
                                            result[i].currentHeight = shutterHeight;
                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                            adapter.log.debug('shutterUpLiving #2 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + shutterHeight + '%');
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
        if (autoLivingStr == true) {
            setTimeout(function () {
                // Filter Area Living Auto
                if (resultFull) {
                    const /**
                         * @param {{ typeUp: string; }} d
                         */
                        resLivingAuto = resultFull.filter(d => d.typeUp == 'living-auto');
                    // Filter enabled
                    let /**
                         * @param {{ enabled: boolean; }} d
                         */
                        resEnabled = resLivingAuto.filter(d => d.enabled === true);

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
                                                    adapter.log.info('#15 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                                    adapter.setForeignState(result[i].name, shutterHeight, false);
                                                    result[i].currentHeight = shutterHeight;
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                    adapter.log.debug('shutterUpLiving #3 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + shutterHeight + '%');
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
                                                    adapter.log.info('#16 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                                    adapter.setForeignState(result[i].name, shutterHeight, false);
                                                    result[i].currentHeight = shutterHeight;
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                    adapter.log.debug('shutterUpLiving #4 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + shutterHeight + '%');
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
            }, timeoutLivingAuto);
        }
    });
}

module.exports = shutterUpLiving;