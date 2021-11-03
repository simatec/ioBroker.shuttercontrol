'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');                           // shutterState
const checkPendingAlarm = require('./shutterAlarm.js').checkPendingAlarm;    // shutterAlarm

function shutterUpChildren(adapter, upTimeChildren, delayUp, autoChildrenStr, shutterSettings) {

    const driveDelayUpChildren = adapter.config.driveDelayUpChildren * 1000;
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving * 1000;
    const noGoDelay = adapter.config.noGoTime * 1000 * 60;

    if ((upTimeChildren) == undefined) {
        upTimeChildren = adapter.config.W_shutterUpChildrenMax;
    }
    let upTime;

    try {
        upTime = upTimeChildren.split(':');
    } catch (e) {
        adapter.log.debug('Uptime for the childrenarea is not defined ... Please check your config!!');
    }

    /** @type {number | undefined} */
    let timeoutChildrenAuto;

    schedule.cancelJob('shutterUpChildren');
    try {
        const upChildren = schedule.scheduleJob('shutterUpChildren', upTime[1] + ' ' + upTime[0] + ' * * *', function () {

            delayUp = delayUp * driveDelayUpLiving;
            setTimeout(function () {
                // Full Result
                const resultFull = shutterSettings;

                if (resultFull) {
                    // Filter Area Children
                    const /**
                     * @param {{ typeUp: string; }} d
                     */
                        resChildren = resultFull.filter(d => d.typeUp == 'children');
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
                                                        let mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);
                                                        if (typeof state != undefined && state != null) {
                                                            currentValue = ('' + state.val);
                                                        }
                                                        if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyDown' && shutterSettings[s].autoDrive != 'off')) {
                                                            /**
                                                             * @param {any} err
                                                             * @param {{ val: number; }} state
                                                             */
                                                            adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                if (typeof state != undefined && state != null && state.val != shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                                    adapter.log.info('#21 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                                    adapter.setForeignState(shutterSettings[s].name, shutterHeight, false);
                                                                    shutterSettings[s].currentHeight = shutterHeight;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                    adapter.log.debug('shutterUpChildren #1 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                                else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                                    shutterSettings[s].currentHeight = shutterHeight;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                    adapter.log.debug('shutterUpChildren #1 ' + shutterSettings[s].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
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
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                    adapter.log.debug('shutterUpChildren #2 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                                else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                                    shutterSettings[s].currentHeight = shutterHeight;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                    adapter.log.debug('shutterUpChildren #2 ' + shutterSettings[s].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                            });
                                                        } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
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
                                                    adapter.log.info('Children up not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                }
                                            }, driveDelayUpChildren * i, i);
                                        }
                                    });
                                });
                            }
                        }
                    }
                }
                if (autoChildrenStr == true) {
                    setTimeout(function () {
                        // Full Result
                        const resultFull = shutterSettings;
                        // Filter Area children
                        if (resultFull) {
                            const /**
                             * @param {{ typeUp: string; }} d
                             */
                                resChildren = resultFull.filter(d => d.typeUp == 'children-auto');
                            // Filter enabled
                            let /**
                             * @param {{ enabled: boolean; }} d
                             */
                                resEnabled = resChildren.filter(d => d.enabled === true);

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

                                                        // saving current required values to alarmtrigger
                                                        shutterSettings[s].alarmTriggerLevel = shutterHeight;
                                                        shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction; 
                                                        
                                                        }
                                                        if(pendingAlarm == false) {
                                                            let currentValue = '';
                                                            /**
                                                             * @param {any} err
                                                             * @param {{ val: string; }} state
                                                             */
                                                            adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {
                                                                let mustValue = ('' + shutterSettings[s].triggerState);
                                                                let mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);
                                                                if (typeof state != undefined && state != null) {
                                                                    currentValue = ('' + state.val);
                                                                }
                                                                if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyDown' && shutterSettings[s].autoDrive != 'off')) {
                                                                    /**
                                                                     * @param {any} err
                                                                     * @param {{ val: number; }} state
                                                                     */
                                                                    adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                        if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                                            adapter.log.info('#23 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                                            adapter.setForeignState(shutterSettings[s].name, shutterHeight, false);
                                                                            shutterSettings[s].currentHeight = shutterHeight;
                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                            adapter.log.debug('shutterUpChildren #3 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                            return (shutterSettings);
                                                                        }
                                                                        else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                                            shutterSettings[s].currentHeight = shutterHeight;
                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                            adapter.log.debug('shutterUpChildren #3 ' + shutterSettings[s].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
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
                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                            adapter.log.debug('shutterUpChildren #4 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                            return (shutterSettings);
                                                                        }
                                                                        else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                                            shutterSettings[s].currentHeight = shutterHeight;
                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                            adapter.log.debug('shutterUpChildren #4 ' + shutterSettings[s].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                            return (shutterSettings);
                                                                        }
                                                                    });
                                                                } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
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
                                                            adapter.log.info('Children-auto up not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%'); 
                                                        }
                                                    }, driveDelayUpChildren * i, i);                                           
                                                }
                                            });
                                        });
                                    }
                                }
                            }
                        }
                    }, timeoutChildrenAuto);
                }
            }, delayUp);
        });
    } catch (e) {
        adapter.log.debug('error on uptime for childrenarea ... please check your config!!');
    }
}
module.exports = shutterUpChildren;