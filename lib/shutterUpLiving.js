'use strict';

// @ts-ignore
const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');                           // shutterState
const checkPendingAlarm = require('./shutterAlarm.js').checkPendingAlarm;    // shutterAlarm

// @ts-ignore
function shutterUpLiving(adapter, upTimeLiving, autoLivingStr, shutterSettings) {

    const driveDelayUpLiving = adapter.config.driveDelayUpLiving != 0 ? adapter.config.driveDelayUpLiving * 1000 : 2000;
    const noGoDelay = adapter.config.noGoTime * 1000 * 60;

    upTimeLiving = upTimeLiving == undefined ? adapter.config.W_shutterUpLivingMax : upTimeLiving;

    let upTime = upTimeLiving.split(':');
    /** @type {number | undefined} */
    let timeoutLivingAuto;

    schedule.cancelJob('shutterUpLiving');

    // @ts-ignore
    const upLiving = schedule.scheduleJob('shutterUpLiving', upTime[1] + ' ' + upTime[0] + ' * * *', function () {
        // Full Result
        const resultFull = shutterSettings;

        if (resultFull) {
            // Filter Area Living
            const /**
                 * @param {{ typeUp: string; }} d
                 */
                // @ts-ignore
                resLiving = resultFull.filter(d => d.typeUp == 'living');
            // Filter enabled
            let /**
                 * @param {{ enabled: boolean; }} d
                 */
                // @ts-ignore
                resEnabled = resLiving.filter(d => d.enabled === true);

            let result = resEnabled;
            let number = 0;

            // @ts-ignore
            for (const i in result) {
                number++;
            }

            timeoutLivingAuto = number * driveDelayUpLiving;

            for (const i in result) {
                for (const s in shutterSettings) {
                    if (shutterSettings[s].shutterName == result[i].shutterName) {
                        let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                        let pendingAlarm = false;
                        // @ts-ignore
                        checkPendingAlarm(adapter, shutterSettings[s], function (resAlarmPending) {
                            pendingAlarm = resAlarmPending;

                            /**
                             * @param {any} err
                             * @param {boolean} state
                             */
                            // @ts-ignore
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

                                        if (pendingAlarm == false) {
                                            let currentValue = '';
                                            /**
                                             * @param {any} err
                                             * @param {{ val: string; }} state
                                             */
                                            // @ts-ignore
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
                                                    // @ts-ignore
                                                    adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                        if (typeof state != undefined && state != null && state.val != shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                            adapter.log.info('#13 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                            adapter.setForeignState(shutterSettings[s].name, shutterHeight, false);
                                                            shutterSettings[s].currentHeight = shutterHeight;
                                                            shutterSettings[s].lastAutoAction = 'up_LivingTime';
                                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                            adapter.log.debug('shutterUpLiving #1 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                            return (shutterSettings);
                                                        }
                                                        else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                            shutterSettings[s].currentHeight = shutterHeight;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
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
                                                    // @ts-ignore
                                                    adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                        if (typeof state != undefined && state != null && state.val != shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                            adapter.log.info('#14 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                            adapter.setForeignState(shutterSettings[s].name, shutterHeight, false);
                                                            shutterSettings[s].currentHeight = shutterHeight;
                                                            shutterSettings[s].lastAutoAction = 'up_LivingTime';
                                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                            adapter.log.debug('shutterUpLiving #2 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                            return (shutterSettings);
                                                        }
                                                        else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                            shutterSettings[s].currentHeight = shutterHeight;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                            adapter.log.debug('shutterUpLiving #2 ' + shutterSettings[s].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                            return (shutterSettings);
                                                        }
                                                    });
                                                } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                                    /**
                                                     * @param {any} err
                                                     * @param {{ val: any; }} state
                                                     */
                                                    // @ts-ignore
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
                                        } else {
                                            adapter.log.info('Living up not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                        }
                                        // @ts-ignore
                                    }, driveDelayUpLiving * i, i);
                                }
                            });
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
                        // @ts-ignore
                        resLivingAuto = resultFull.filter(d => d.typeUp == 'living-auto');
                    // Filter enabled
                    let /**
                         * @param {{ enabled: boolean; }} d
                         */
                        // @ts-ignore
                        resEnabled = resLivingAuto.filter(d => d.enabled === true);

                    let result = resEnabled;

                    for (const i in result) {
                        for (const s in shutterSettings) {
                            if (shutterSettings[s].shutterName == result[i].shutterName) {
                                let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                                let pendingAlarm = false;
                                // @ts-ignore
                                checkPendingAlarm(adapter, shutterSettings[s], function (resAlarmPending) {
                                    pendingAlarm = resAlarmPending;

                                    /**
                                     * @param {any} err
                                     * @param {boolean} state
                                     */
                                    // @ts-ignore
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

                                                if (pendingAlarm == false) {
                                                    let currentValue = '';
                                                    /**
                                                     * @param {any} err
                                                     * @param {{ val: string; }} state
                                                     */
                                                    // @ts-ignore
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
                                                            // @ts-ignore
                                                            adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                                    adapter.log.info('#16 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                                    adapter.setForeignState(shutterSettings[s].name, shutterHeight, false);
                                                                    shutterSettings[s].currentHeight = shutterHeight;
                                                                    shutterSettings[s].lastAutoAction = 'up_LivingTime';
                                                                    adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                    adapter.log.debug('shutterUpLiving #3 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                                else if (typeof state != undefined && state != null && state.val == shutterHeight) {
                                                                    shutterSettings[s].currentHeight = shutterHeight;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
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
                                                            // @ts-ignore
                                                            adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                                    adapter.log.info('#17 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                                    adapter.setForeignState(shutterSettings[s].name, shutterHeight, false);
                                                                    shutterSettings[s].currentHeight = shutterHeight;
                                                                    shutterSettings[s].lastAutoAction = 'up_LivingTime';
                                                                    adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                    adapter.log.debug('shutterUpLiving #4 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                                else if (typeof state != undefined && state != null && state.val == shutterHeight) {
                                                                    shutterSettings[s].currentHeight = shutterHeight;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                    adapter.log.debug('shutterUpLiving #4 ' + shutterSettings[s].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                            });
                                                        } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                                            /**
                                                             * @param {any} err
                                                             * @param {{ val: any; }} state
                                                             */
                                                            // @ts-ignore
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
                                                } else {
                                                    adapter.log.info('Living-auto up not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                }
                                                // @ts-ignore
                                            }, driveDelayUpLiving * i, i);
                                        }
                                    });
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