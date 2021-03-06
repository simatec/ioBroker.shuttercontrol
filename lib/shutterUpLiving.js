'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');         // shutterState

function shutterUpLiving(adapter, upTimeLiving, autoLivingStr, shutterSettings) {

    const driveDelayUpLiving = adapter.config.driveDelayUpLiving * 1000;
    const noGoDelay = adapter.config.noGoTime * 1000 * 60;

    if ((upTimeLiving) == undefined) {
        upTimeLiving = adapter.config.W_shutterUpLivingMax;
    }
    let upTime = upTimeLiving.split(':');
    /** @type {number | undefined} */
    let timeoutLivingAuto;

    schedule.cancelJob('shutterUpLiving');

    const upLiving = schedule.scheduleJob('shutterUpLiving', upTime[1] + ' ' + upTime[0] + ' * * *', function () {
        // Full Result
        const resultFull = shutterSettings;

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
                for (const s in shutterSettings) {
                    if (shutterSettings[s].shutterName == result[i].shutterName) {
                        let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                        /**
                         * @param {any} err
                         * @param {boolean} state
                         */
                        adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                            if (state && state === true || state && state.val === true) {
                                setTimeout(function () {
                                    let shutterHeight = 0;
                                    if (shutterSettings[s].currentAction == 'sunProtect' || shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                        shutterHeight = parseFloat(shutterSettings[s].heightDownSun);
                                        shutterSettings[s].currentAction = 'sunProtect';
                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                    } else {
                                        shutterHeight = parseFloat(shutterSettings[s].heightUp);
                                        shutterSettings[s].currentAction = 'up';
                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                    }
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
                                        if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyDown' && shutterSettings[s].autoDrive != 'off')) {
                                            /**
                                             * @param {any} err
                                             * @param {{ val: number; }} state
                                             */
                                            adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                if (typeof state != undefined && state != null && state.val != shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                    adapter.log.info('#13 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                    adapter.setForeignState(shutterSettings[s].name, shutterHeight, false);
                                                    shutterSettings[s].currentHeight = shutterHeight;
                                                    adapter.log.debug('shutterUpLiving #1 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                    return (shutterSettings);
                                                }
                                                else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                    shutterSettings[s].currentHeight = shutterHeight;
                                                    adapter.log.debug('shutterUpLiving #1 ' + shutterSettings[s].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                    return (shutterSettings);
                                                }
                                            });
                                        } else if (shutterSettings[s].triggerID == '') {
                                            /**
                                             * @param {any} err
                                             * @param {{ val: number; }} state
                                             */
                                            adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                if (typeof state != undefined && state != null && state.val != shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                    adapter.log.info('#14 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                    adapter.setForeignState(shutterSettings[s].name, shutterHeight, false);
                                                    shutterSettings[s].currentHeight = shutterHeight;
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                    adapter.log.debug('shutterUpLiving #2 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                    return (shutterSettings);
                                                }
                                                else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                    shutterSettings[s].currentHeight = shutterHeight;
                                                    adapter.log.debug('shutterUpLiving #2 ' + shutterSettings[s].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                    return (shutterSettings);
                                                }
                                            });
                                        } else if (currentValue != mustValue && shutterSettings[s].autoDrive == 'onlyDown' && shutterSettings[s].driveAfterClose == true) {
                                            /**
                                             * @param {any} err
                                             * @param {{ val: any; }} state
                                             */
                                            adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                if (typeof state != undefined && state != null && state.val != shutterSettings[s].shutterHeight) {
                                                    adapter.log.info('#15 Will open ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%' + ' after the window has been closed ');
                                                    shutterSettings[s].triggerHeight = shutterHeight;
                                                    adapter.log.debug('save new trigger height: ' + shutterHeight + '%');
                                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                    adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
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
                        for (const s in shutterSettings) {
                            if (shutterSettings[s].shutterName == result[i].shutterName) {
                                let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                                /**
                                 * @param {any} err
                                 * @param {boolean} state
                                 */
                                adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                                    if (state && state === true || state && state.val === true) {
                                        setTimeout(function () {
                                            let shutterHeight = 0;
                                            if (shutterSettings[s].currentAction == 'sunProtect' || shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                shutterHeight = parseFloat(shutterSettings[s].heightDownSun);
                                                shutterSettings[s].currentAction = 'sunProtect';
                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                            } else {
                                                shutterHeight = parseFloat(shutterSettings[s].heightUp);
                                                shutterSettings[s].currentAction = 'up';
                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                            }
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
                                                if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyDown' && shutterSettings[s].autoDrive != 'off')) {
                                                    /**
                                                     * @param {any} err
                                                     * @param {{ val: number; }} state
                                                     */
                                                    adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                        if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                            adapter.log.info('#16 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                            adapter.setForeignState(shutterSettings[s].name, shutterHeight, false);
                                                            shutterSettings[s].currentHeight = shutterHeight;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                            adapter.log.debug('shutterUpLiving #3 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                            return (shutterSettings);
                                                        }
                                                        else if (typeof state != undefined && state != null && state.val == shutterHeight) {
                                                            shutterSettings[s].currentHeight = shutterHeight;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                            adapter.log.debug('shutterUpLiving #3 ' + shutterSettings[s].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                            return (shutterSettings);
                                                        }
                                                    });
                                                } else if (shutterSettings[s].triggerID == '') {
                                                    /**
                                                     * @param {any} err
                                                     * @param {{ val: number; }} state
                                                     */
                                                    adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                        if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                            adapter.log.info('#17 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                            adapter.setForeignState(shutterSettings[s].name, shutterHeight, false);
                                                            shutterSettings[s].currentHeight = shutterHeight;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                            adapter.log.debug('shutterUpLiving #4 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                            return (shutterSettings);
                                                        }
                                                        else if (typeof state != undefined && state != null && state.val == shutterHeight) {
                                                            shutterSettings[s].currentHeight = shutterHeight;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                            adapter.log.debug('shutterUpLiving #4 ' + shutterSettings[s].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                            return (shutterSettings);
                                                        }
                                                    });
                                                } else if (currentValue != mustValue && shutterSettings[s].autoDrive == 'onlyDown' && shutterSettings[s].driveAfterClose == true) {
                                                    /**
                                                     * @param {any} err
                                                     * @param {{ val: any; }} state
                                                     */
                                                    adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                        if (typeof state != undefined && state != null && state.val != shutterSettings[s].shutterHeight) {
                                                            adapter.log.info('#18 Will open ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%' + ' after the window has been closed ');
                                                            shutterSettings[s].triggerHeight = shutterHeight;
                                                            adapter.log.debug('save new trigger height: ' + shutterHeight + '%');
                                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
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
                }
            }, timeoutLivingAuto);
        }
    });
}

module.exports = shutterUpLiving;