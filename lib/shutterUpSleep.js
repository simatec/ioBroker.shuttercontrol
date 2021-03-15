'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');         // shutterState

function shutterUpSleep(adapter, upTimeSleep, delayUp, autoSleepStr, shutterSettings) {

    const driveDelayUpSleep = adapter.config.driveDelayUpSleep * 1000;
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving * 1000;
    const noGoDelay = adapter.config.noGoTime * 1000 * 60;

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
            const resultFull = shutterSettings;

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
                    let nameDevice = shutterSettings[i].shutterName.replace(/[.;, ]/g, '_');
                    /**
                     * @param {any} err
                     * @param {boolean} state
                     */
                    adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {
                            setTimeout(function () {
                                let shutterHeight = 0;
                                if (shutterSettings[i].currentAction == 'sunProtect' || shutterSettings[i].currentAction == 'OpenInSunProtect') {
                                    shutterHeight = parseFloat(shutterSettings[i].heightDownSun);
                                    shutterSettings[i].currentAction = 'sunProtect';
                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                } else {
                                    shutterHeight = parseFloat(shutterSettings[i].heightUp);
                                    shutterSettings[i].currentAction = 'up';
                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                }
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
                                    if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyDown' && shutterSettings[i].autoDrive != 'off')) {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: number; }} state
                                         */
                                        adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                adapter.log.info('#21 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterHeight + '%');
                                                adapter.setForeignState(shutterSettings[i].name, shutterHeight, false);
                                                shutterSettings[i].currentHeight = shutterHeight;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                adapter.log.debug('shutterUpSleep #1 ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterHeight + '%');
                                                shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                return (shutterSettings);
                                            }
                                            else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                shutterSettings[i].currentHeight = shutterHeight;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                adapter.log.debug('shutterUpSleep #1 ' + shutterSettings[i].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[i].currentAction);
                                                shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                return (shutterSettings);
                                            }
                                        });
                                    } else if (shutterSettings[i].triggerID == '') {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: number; }} state
                                         */
                                        adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                adapter.log.info('#22 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterHeight + '%');
                                                adapter.setForeignState(shutterSettings[i].name, shutterHeight, false);
                                                shutterSettings[i].currentHeight = shutterHeight;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                adapter.log.debug('shutterUpSleep #2 ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterHeight + '%');
                                                shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                return (shutterSettings);
                                            }
                                            else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                shutterSettings[i].currentHeight = shutterHeight;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                adapter.log.debug('shutterUpSleep #2 ' + shutterSettings[i].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[i].currentAction);
                                                shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                return (shutterSettings);
                                            }
                                        });
                                    } else if (currentValue != mustValue && shutterSettings[i].autoDrive == 'onlyDown' && shutterSettings[i].driveAfterClose == true) {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: any; }} state
                                         */
                                        adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                adapter.log.info('#23 Will open ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterHeight + '%' + ' after the window has been closed ');
                                                shutterSettings[i].triggerHeight = shutterHeight;
                                                adapter.log.debug('save new trigger height: ' + shutterHeight + '%');
                                                shutterSettings[i].triggerAction = shutterSettings[i].currentAction;
                                                adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
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
            if (autoSleepStr == true) {
                setTimeout(function () {
                    // Full Result
                    const resultFull = shutterSettings;
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
                            let nameDevice = shutterSettings[i].shutterName.replace(/[.;, ]/g, '_');
                            /**
                             * @param {any} err
                             * @param {boolean} state
                             */
                            adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                                if (state && state === true || state && state.val === true) {
                                    setTimeout(function () {
                                        let shutterHeight = 0;
                                        if (shutterSettings[i].currentAction == 'sunProtect' || shutterSettings[i].currentAction == 'OpenInSunProtect') {
                                            shutterHeight = parseFloat(shutterSettings[i].heightDownSun);
                                            shutterSettings[i].currentAction = 'sunProtect';
                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                        } else {
                                            shutterHeight = parseFloat(shutterSettings[i].heightUp);
                                            shutterSettings[i].currentAction = 'up';
                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                        }
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
                                            if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyDown' && shutterSettings[i].autoDrive != 'off')) {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: number; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                        adapter.log.info('#23 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterHeight + '%');
                                                        adapter.setForeignState(shutterSettings[i].name, shutterHeight, false);
                                                        shutterSettings[i].currentHeight = shutterHeight;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                        adapter.log.debug('shutterUpSleep #3 ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterHeight + '%');
                                                        shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                        return (shutterSettings);
                                                    }
                                                    else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                        shutterSettings[i].currentHeight = shutterHeight;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                        adapter.log.debug('shutterUpSleep #3 ' + shutterSettings[i].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[i].currentAction);
                                                        shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                        return (shutterSettings);
                                                    }
                                                });
                                            } else if (shutterSettings[i].triggerID == '') {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: number; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                        adapter.log.info('#24 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterHeight + '%');
                                                        adapter.setForeignState(shutterSettings[i].name, shutterHeight, false);
                                                        shutterSettings[i].currentHeight = shutterHeight;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                        adapter.log.debug('shutterUpSleep #4 ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterHeight + '%');
                                                        shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                        return (shutterSettings);
                                                    }
                                                    else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                        shutterSettings[i].currentHeight = shutterHeight;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                        adapter.log.debug('shutterUpSleep #4 ' + shutterSettings[i].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[i].currentAction);
                                                        shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                        return (shutterSettings);
                                                    }
                                                });
                                            } else if (currentValue != mustValue && shutterSettings[i].autoDrive == 'onlyDown' && shutterSettings[i].driveAfterClose == true) {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: any; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                        adapter.log.info('#25 Will close ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterHeight + '%' + ' after the window has been closed ');
                                                        shutterSettings[i].triggerHeight = shutterHeight;
                                                        adapter.log.debug('save new trigger height: ' + shutterHeight + '%');
                                                        shutterSettings[i].triggerAction = shutterSettings[i].currentAction;
                                                        adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
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
                }, timeoutSleepAuto);
            }
        }, delayUp);
    });
}
module.exports = shutterUpSleep;