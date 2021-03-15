'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');         // shutterState

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
                                                    adapter.log.debug('shutterUpChildren #1 ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterHeight + '%');
                                                    shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                    return (shutterSettings);
                                                }
                                                else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                    shutterSettings[i].currentHeight = shutterHeight;
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                    adapter.log.debug('shutterUpChildren #1 ' + shutterSettings[i].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[i].currentAction);
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
                                                    adapter.log.debug('shutterUpChildren #2 ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterHeight + '%');
                                                    shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                    return (shutterSettings);
                                                }
                                                else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                    shutterSettings[i].currentHeight = shutterHeight;
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                    adapter.log.debug('shutterUpChildren #2 ' + shutterSettings[i].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[i].currentAction);
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
                                }, driveDelayUpChildren * i, i);
                            }
                        });
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
                                                            adapter.log.debug('shutterUpChildren #3 ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterHeight + '%');
                                                            shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                            return (shutterSettings);
                                                        }
                                                        else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                            shutterSettings[i].currentHeight = shutterHeight;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                            adapter.log.debug('shutterUpChildren #3 ' + shutterSettings[i].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[i].currentAction);
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
                                                            adapter.log.debug('shutterUpChildren #4 ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterHeight + '%');
                                                            shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                            return (shutterSettings);
                                                        }
                                                        else if (typeof state != undefined && state != null && state.val == shutterHeight && Date.now() >= (state.lc + noGoDelay)) {
                                                            shutterSettings[i].currentHeight = shutterHeight;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                            adapter.log.debug('shutterUpChildren #4 ' + shutterSettings[i].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[i].currentAction);
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
                                        }, driveDelayUpChildren * i, i);
                                    }
                                });
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