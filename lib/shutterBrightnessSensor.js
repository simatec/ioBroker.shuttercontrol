'use strict';

const shutterState = require('./shutterState.js');                           // shutterState
const checkPendingAlarm = require('./shutterAlarm.js').checkPendingAlarm;    // shutterAlarm
const checkFrostAlarm = require('./shutterAlarm.js').checkFrostAlarm;      // shutterAlarm - check frost alarm


// @ts-ignore
function getDate(d) {
    d = d || new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

// @ts-ignore
function shutterBrightnessSensor(adapter, brightnessValue, shutterSettings) {

    const shutterDownBrightness = adapter.config.lightsensorDown;
    const shutterUpBrightness = adapter.config.lightsensorUp;
    const driveDelayAstro = adapter.config.driveDelayUpAstro * 1000;
    const currentHour = new Date().getHours();

    if (currentHour > 12 && brightnessValue < shutterDownBrightness) {
        // Full Result
        const resultFull = shutterSettings;

        if (resultFull) {
            // Filter Area Living
            const /**
         * @param {{ typeDown: string; }} d
         */
                // @ts-ignore
                resLiving = resultFull.filter(d => d.typeDown == 'lightsensor');
            // Filter enabled
            let /**
         * @param {{ enabled: boolean; }} d
         */
                // @ts-ignore
                resEnabled = resLiving.filter(d => d.enabled === true);

            let result = resEnabled;

            for (const i in result) {
                for (const s in shutterSettings) {
                    if (shutterSettings[s].shutterName == result[i].shutterName) {
                        let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                        let pendingAlarm = false;
                        checkPendingAlarm(adapter, shutterSettings[s], function(resAlarmPending) {
                            pendingAlarm = resAlarmPending;

                            let statusAlarmFrost = false;
                            checkFrostAlarm(adapter, shutterSettings[s], function(resAlarmFrost) {
                                statusAlarmFrost = resAlarmFrost;

                                /**
                                 * @param {any} err
                                 * @param {boolean} state
                                 */

                                let targetLevel2Set = 0;
                                let downAction = 'down';

                                if (getDate() < adapter.config.betweenPositionTime) {
                                    // between Position Level
                                    targetLevel2Set = shutterSettings[s].betweenPosition == true ? parseFloat(shutterSettings[s].betweenPositionLevel) : parseFloat(shutterSettings[s].heightDown);
                                    downAction = shutterSettings[s].betweenPosition == true ? 'middle' : 'down';
                                } else {
                                    targetLevel2Set = parseFloat(shutterSettings[s].heightDown);
                                    downAction = 'down';
                                }

                                // save current required position to alarmtrigger before overwriting
                                shutterSettings[s].alarmTriggerLevel = targetLevel2Set;
                                shutterSettings[s].alarmTriggerAction = downAction; 

                                // overwrite target position and downAction if frost alarm is set.
                                if (statusAlarmFrost == true && shutterSettings[s].enableAlarmFrost == true) {
                                    targetLevel2Set = parseFloat(adapter.config.alarmFrostLevel);
                                    downAction = 'frost';
                                } 

                                // @ts-ignore
                                adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                                    if (state && state === true || state && state.val === true) {
                                        if (shutterSettings[s].currentAction != 'triggered' || shutterSettings[s].currentAction != 'down') {
                                            if(pendingAlarm == false) {
                                                setTimeout(function () {
                                                    let currentValue = '';
                                                    /**
                                                     * @param {any} err
                                                     * @param {{ val: string; }} state
                                                     */
                                                    // @ts-ignore
                                                    adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {
                                                        let mustValue = ('' + shutterSettings[s].triggerState);
                                                        if (typeof state != undefined && state != null) {
                                                            currentValue = ('' + state.val);
                                                        }
                                                        if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyUp' && shutterSettings[s].autoDrive != 'off')) {
                                                            /**
                                                             * @param {any} err
                                                             * @param {{ val: any; }} state
                                                             */
                                                            // @ts-ignore
                                                            adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                                    adapter.log.info('Lightsensor #8 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                                                    adapter.setForeignState(shutterSettings[s].name, targetLevel2Set, false);
                                                                    shutterSettings[s].currentHeight = targetLevel2Set;
                                                                    shutterSettings[s].currentAction = downAction;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                    adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                                else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                                    shutterSettings[s].currentHeight = targetLevel2Set;
                                                                    shutterSettings[s].currentAction = downAction;
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                    adapter.log.debug('Lightsensor down ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                            });
                                                        } else if (shutterSettings[s].triggerID == '') {
                                                            /**
                                                             * @param {any} err
                                                             * @param {{ val: any; }} state
                                                             */
                                                            // @ts-ignore
                                                            adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                                    adapter.log.info('Lightsensor #9 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                                                    adapter.setForeignState(shutterSettings[s].name, targetLevel2Set, false);
                                                                    shutterSettings[s].currentHeight = targetLevel2Set;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                                    shutterSettings[s].currentAction = downAction;
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                    adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                                else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                                    shutterSettings[s].currentHeight = targetLevel2Set;
                                                                    shutterSettings[s].currentAction = downAction;
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                    adapter.log.debug('Lightsensor down ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                            });
                                                        } else if (currentValue != mustValue && shutterSettings[s].driveAfterClose == true) {
                                                            /**
                                                             * @param {any} err
                                                             * @param {{ val: number; }} state
                                                             */
                                                            // @ts-ignore
                                                            adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                                    adapter.log.info('Lightsensor #7 Will close ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                                    shutterSettings[s].triggerHeight = targetLevel2Set;
                                                                    adapter.log.debug('save new trigger height: ' + targetLevel2Set + '%');
                                                                    shutterSettings[s].triggerAction = downAction;
                                                                    adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                    return (shutterSettings);
                                                                }
                                                            });
                                                        }
                                                    });

                                                // @ts-ignore
                                                }, driveDelayAstro * i, i);                                        
                                            } else {
                                                adapter.log.info('Brighness down not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                            }
                                        }
                                    }
                                });
                            });
                        });
                    }
                }
            }
        }
    } else if (currentHour <= 12 && brightnessValue > shutterUpBrightness) {
        // Full Result
        const resultFull = shutterSettings;

        if (resultFull) {
            // Filter Area Living
            const /**
            * @param {{ typeUp: string; }} d
            */
                // @ts-ignore
                resLiving = resultFull.filter(d => d.typeUp == 'lightsensor');
            // Filter enabled
            let /**
            * @param {{ enabled: boolean; }} d
            */
                // @ts-ignore
                resEnabled = resLiving.filter(d => d.enabled === true);

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
                            // @ts-ignore
                            adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                                if (state && state === true || state && state.val === true) {
                                    if (pendingAlarm == false) {
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

                                            let currentValue = '';
                                            /**
                                             * @param {any} err
                                             * @param {{ val: string; }} state
                                             */
                                            // @ts-ignore
                                            adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {
                                                let mustValue = ('' + shutterSettings[s].triggerState);
                                                if (typeof state != undefined && state != null) {
                                                    currentValue = ('' + state.val);
                                                }
                                                if (pendingAlarm == false) {
                                                    if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyDown' && shutterSettings[s].autoDrive != 'off')) {
                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: number; }} state
                                                         */
                                                        // @ts-ignore
                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                            if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                                adapter.log.info('Lightsensor #5 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                                adapter.setForeignState(shutterSettings[s].name, shutterHeight, false);
                                                                shutterSettings[s].currentHeight = shutterHeight;
                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                return (shutterSettings);
                                                            }
                                                            else if (typeof state != undefined && state != null && state.val == shutterHeight) {
                                                                shutterSettings[s].currentHeight = shutterHeight;
                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                adapter.log.debug('Lightsensor up ' + shutterSettings[s].shutterName + ' already up at: ' + shutterSettings[s].heightUp + '% - setting current action: ' + shutterSettings[s].currentAction);
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
                                                                adapter.log.info('Lightsensor #6 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                                adapter.setForeignState(shutterSettings[s].name, shutterHeight, false);
                                                                shutterSettings[s].currentHeight = shutterHeight;
                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                return (shutterSettings);
                                                            }
                                                            else if (typeof state != undefined && state != null && state.val == shutterHeight) {
                                                                shutterSettings[s].currentHeight = shutterHeight;
                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                adapter.log.debug('Lightsensor up ' + shutterSettings[s].shutterName + ' already up at: ' + shutterSettings[s].heightUp + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                return (shutterSettings);
                                                            }
                                                        });
                                                    } else if (currentValue != mustValue && shutterSettings[s].driveAfterClose == true) {
                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: number; }} state
                                                         */
                                                        // @ts-ignore
                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                            if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                                adapter.log.info('Lightsensor #7 Will open ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%' + ' after the window has been closed ');
                                                                shutterSettings[s].triggerHeight = shutterHeight;
                                                                adapter.log.debug('save new trigger height: ' + shutterHeight + '%');
                                                                shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                return (shutterSettings);
                                                            }
                                                        });
                                                    }
                                                }
                                            });
                                        // @ts-ignore
                                        }, driveDelayAstro * i, i);
                                    } else {
                                        adapter.log.info('Brighness up not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%'); 
                                    }
                                }
                            });
                        });
                    }
                }
            }
        }
    }
}
module.exports = shutterBrightnessSensor;