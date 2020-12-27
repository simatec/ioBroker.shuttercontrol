'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');         // shutterState

const CheckInSummerNotDown = require('./isSummerTime.js').CheckInSummerNotDown;
const GetXmasLevel = require('./isSummerTime.js').GetXmasLevel;

function shutterSunriseSunset(adapter, sunriseStr, sunsetStr) {

    const driveDelayUpAstro = adapter.config.driveDelayUpAstro * 1000;

    if (sunriseStr) {

        let upTime = sunriseStr.split(':');

        schedule.cancelJob('shutterUpSunrise');

        const upSunrise = schedule.scheduleJob('shutterUpSunrise', upTime[1] + ' ' + upTime[0] + ' * * *', function () {
            // Full Result
            const resultFull = adapter.config.events;

            if (resultFull) {
                // Filter Area Living
                const /**
                     * @param {{ typeUp: string; }} d
                     */
                    resLiving = resultFull.filter(d => d.typeUp == 'sunrise');
                // Filter enabled
                let /**
                     * @param {{ enabled: boolean; }} d
                     */
                    resEnabled = resLiving.filter(d => d.enabled === true);

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
                                                adapter.log.info('#9 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                                adapter.setForeignState(result[i].name, shutterHeight, false);
                                                result[i].currentHeight = shutterHeight;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                shutterState(result[i].name, adapter);
                                            }
                                            else if (typeof state != undefined && state != null && state.val == shutterHeight) {
                                                result[i].currentHeight = shutterHeight;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                adapter.log.debug('Sunrise up ' + result[i].shutterName + ' already up at: ' + result[i].heightUp + '% - setting current action: ' + result[i].currentAction);
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
                                                adapter.log.info('#10 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                                adapter.setForeignState(result[i].name, shutterHeight, false);
                                                result[i].currentHeight = shutterHeight;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                shutterState(result[i].name, adapter);
                                            }
                                            else if (typeof state != undefined && state != null && state.val == shutterHeight) {
                                                result[i].currentHeight = shutterHeight;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                adapter.log.debug('Sunrise up ' + result[i].shutterName + ' already up at: ' + result[i].heightUp + '% - setting current action: ' + result[i].currentAction);
                                                shutterState(result[i].name, adapter);
                                            }
                                        });
                                    } else if (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].driveAfterClose == true) {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: number; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                adapter.log.info('#11 Will open ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%' + ' after the window has been closed ');
                                                result[i].triggerHeight = shutterHeight;
                                                adapter.log.debug('save new trigger height: ' + shutterHeight + '%');
                                                result[i].triggerAction = result[i].currentAction;
                                                adapter.log.debug('save new trigger action: ' + result[i].triggerAction);
                                            }

                                        });
                                    }
                                });
                            }, driveDelayUpAstro * i, i);
                        }
                    });
                }
            }
        });
    }

    if (sunsetStr) {

        const upTime = sunsetStr.split(':');

        schedule.cancelJob('shutterDownSunset');

        const downSunset = schedule.scheduleJob('shutterDownSunset', upTime[1] + ' ' + upTime[0] + ' * * *', function () {
            // Full Result
            const resultFull = adapter.config.events;

            if (resultFull) {
                // Filter Area Living
                const /**
                     * @param {{ typeDown: string; }} d
                     */
                    resLiving = resultFull.filter(d => d.typeDown == 'sunset');
                // Filter enabled
                let /**
                     * @param {{ enabled: boolean; }} d
                     */
                    resEnabled = resLiving.filter(d => d.enabled === true);

                const result = resEnabled;

                for (const i in result) {

                    const inSummerNotDown = CheckInSummerNotDown(adapter, result[i]);

                    const XmasLevel = GetXmasLevel(adapter, result[i]);

                    // between Position Level
                    let targetLevel2Set = result[i].betweenPosition == true ? result[i].betweenPositionLevel : result[i].heightDown;

                    //entweder xmas level oder standard down level
                    targetLevel2Set = XmasLevel > -1 ? XmasLevel : targetLevel2Set;

                    if (!inSummerNotDown) {

                        const nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
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
                                        const mustValue = ('' + result[i].triggerState);
                                        if (typeof state != undefined && state != null) {
                                            currentValue = ('' + state.val);
                                        }
                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp' && result[i].autoDrive != 'off')) {
                                            /**
                                             * @param {any} err
                                             * @param {{ val: any; }} state
                                             */
                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                    adapter.log.info('#12 Set ID: ' + result[i].name + ' ' + result[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                    adapter.setForeignState(result[i].name, parseFloat(targetLevel2Set), false);
                                                    result[i].currentHeight = targetLevel2Set;
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                    result[i].currentAction = 'down';
                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                    shutterState(result[i].name, adapter);
                                                }
                                                else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                    result[i].currentHeight = targetLevel2Set;
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                    result[i].currentAction = 'down';
                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                    adapter.log.debug('Sunset down ' + result[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + result[i].currentAction);
                                                    shutterState(result[i].name, adapter);
                                                }
                                            });
                                        } else if (result[i].triggerID == '') {
                                            /**
                                             * @param {any} err
                                             * @param {{ val: any; }} state
                                             */
                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                    adapter.log.info('#13 Set ID: ' + result[i].name + ' ' + result[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                    adapter.setForeignState(result[i].name, parseFloat(targetLevel2Set), false);
                                                    result[i].currentHeight = targetLevel2Set;
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                    result[i].currentAction = 'down';
                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                    shutterState(result[i].name, adapter);
                                                }
                                                else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                    result[i].currentHeight = targetLevel2Set;
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                    result[i].currentAction = 'down';
                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                    adapter.log.debug('Sunset down ' + result[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + result[i].currentAction);
                                                    shutterState(result[i].name, adapter);
                                                }
                                            });
                                        } else if (currentValue != mustValue && result[i].autoDrive == 'onlyUp' && result[i].driveAfterClose == true) {
                                            /**
                                             * @param {any} err
                                             * @param {{ val: number; }} state
                                             */
                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                    adapter.log.info('#14 Will close ID: ' + result[i].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                    result[i].triggerHeight = targetLevel2Set;
                                                    adapter.log.debug('save new trigger height: ' + targetLevel2Set + '%');
                                                    result[i].triggerAction = 'down';
                                                    adapter.log.debug('save new trigger action: ' + result[i].triggerAction);
                                                }
                                            });
                                        }
                                    });
                                }, driveDelayUpAstro * i, i);
                            }
                        });
                    }
                }
            }
        });
    }
}
module.exports = shutterSunriseSunset;