'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');                          // shutterState
const checkPendingAlarm = require('./shutterAlarm.js').checkPendingAlarm;   // shutterAlarm
const checkFrostAlarm = require('./shutterAlarm.js').checkFrostAlarm;      // shutterAlarm - check frost alarm

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
                    for (const s in shutterSettings) {
                        if (shutterSettings[s].shutterName == result[i].shutterName) {
                            let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                            let pendingAlarm = false;
                            checkPendingAlarm(adapter, shutterSettings[s], function(resAlarmPending) {
                                pendingAlarm = resAlarmPending;

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
                                            } else {
                                                shutterHeight = parseFloat(shutterSettings[s].heightUp);
                                                shutterSettings[s].currentAction = 'up';
                                            }
                                                
                                            // saving current required values to alarmtrigger
                                            shutterSettings[s].alarmTriggerLevel = shutterHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction; 

                                            if(pendingAlarm == false) {
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
                                                                adapter.log.info('#21 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                                adapter.setForeignState(shutterSettings[s].name, shutterHeight, false);
                                                                shutterSettings[s].currentHeight = shutterHeight;
                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                adapter.log.debug('shutterUpSleep #1 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                return (shutterSettings);
                                                            }
                                                            else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                                shutterSettings[s].currentHeight = shutterHeight;
                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                adapter.log.debug('shutterUpSleep #1 ' + shutterSettings[s].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
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
                                                                adapter.log.info('#22 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                                adapter.setForeignState(shutterSettings[s].name, shutterHeight, false);
                                                                shutterSettings[s].currentHeight = shutterHeight;
                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                adapter.log.debug('shutterUpSleep #2 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                return (shutterSettings);
                                                            }
                                                            else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                                shutterSettings[s].currentHeight = shutterHeight;
                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                adapter.log.debug('shutterUpSleep #2 ' + shutterSettings[s].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                return (shutterSettings);
                                                            }
                                                        });
                                                    } else if (currentValue != mustValue && shutterSettings[s].driveAfterClose == true) {
                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: any; }} state
                                                         */
                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                            if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                                adapter.log.info('#23 Will open ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%' + ' after the window has been closed ');
                                                                shutterSettings[s].triggerHeight = shutterHeight;
                                                                adapter.log.debug('save new trigger height: ' + shutterHeight + '%');
                                                                shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                return (shutterSettings);
                                                            }
                                                        });
                                                    }
                                                });
                                            } else {
                                                adapter.log.info('Sleep up not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                            }
                                        }, driveDelayUpSleep * i, i);
                                    }
                                });
                            });
                        }
                    }
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
                            for (const s in shutterSettings) {
                                if (shutterSettings[s].shutterName == result[i].shutterName) {
                                    let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                                    let pendingAlarm = false;
                                    checkPendingAlarm(adapter, shutterSettings[s], function(resAlarmPending) {
                                        pendingAlarm = resAlarmPending;

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
                                                    } else {
                                                        shutterHeight = parseFloat(shutterSettings[s].heightUp);
                                                        shutterSettings[s].currentAction = 'up';
                                                    }

                                                    // saving current required values to alarmtrigger
                                                    shutterSettings[s].alarmTriggerLevel = shutterHeight;
                                                    shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction; 

                                                    if(pendingAlarm == false) {
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
                                                                        adapter.log.info('#23 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                                        adapter.setForeignState(shutterSettings[s].name, shutterHeight, false);
                                                                        shutterSettings[s].currentHeight = shutterHeight;
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        adapter.log.debug('shutterUpSleep #3 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                        return (shutterSettings);
                                                                    }
                                                                    else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                                        shutterSettings[s].currentHeight = shutterHeight;
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        adapter.log.debug('shutterUpSleep #3 ' + shutterSettings[s].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
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
                                                                        adapter.log.info('#24 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                                        adapter.setForeignState(shutterSettings[s].name, shutterHeight, false);
                                                                        shutterSettings[s].currentHeight = shutterHeight;
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        adapter.log.debug('shutterUpSleep #4 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                        return (shutterSettings);
                                                                    }
                                                                    else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                                        shutterSettings[s].currentHeight = shutterHeight;
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        adapter.log.debug('shutterUpSleep #4 ' + shutterSettings[s].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                        return (shutterSettings);
                                                                    }
                                                                });
                                                            } else if (currentValue != mustValue && shutterSettings[s].driveAfterClose == true) {
                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: any; }} state
                                                                 */
                                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                                        adapter.log.info('#25 Will close ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%' + ' after the window has been closed ');
                                                                        shutterSettings[s].triggerHeight = shutterHeight;
                                                                        adapter.log.debug('save new trigger height: ' + shutterHeight + '%');
                                                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                        adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                        return (shutterSettings);
                                                                    }
                                                                });
                                                            }
                                                        });
                                                    } else {
                                                        adapter.log.info('Sleep-auto up not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                    }
                                                }, driveDelayUpSleep * i, i);
                                            }
                                        });
                                    });
                                }
                            }
                        }
                    }
                }, timeoutSleepAuto);
            }
        }, delayUp);
    });
}
module.exports = shutterUpSleep;