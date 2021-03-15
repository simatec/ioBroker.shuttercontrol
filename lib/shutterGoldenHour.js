'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');         // shutterState

function shutterGoldenHour(adapter, goldenHourEnd, goldenHour, shutterSettings) {

    const driveDelayUpAstro = adapter.config.driveDelayUpAstro * 1000;

    if (goldenHourEnd) {

        let upTime = goldenHourEnd.split(':');

        schedule.cancelJob('shutterUpGoldenHourEnd');

        const upGoldenHour = schedule.scheduleJob('shutterUpGoldenHourEnd', upTime[1] + ' ' + upTime[0] + ' * * *', function () {
            // Full Result
            const resultFull = shutterSettings;

            if (resultFull) {
                // Filter Area Living
                const /**
                     * @param {{ typeUp: string; }} d
                     */
                    resLiving = resultFull.filter(d => d.typeUp == 'goldenhour End');
                // Filter enabled
                let /**
                     * @param {{ enabled: boolean; }} d
                     */
                    resEnabled = resLiving.filter(d => d.enabled === true);

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
                                                adapter.log.info('#5 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterHeight + '%');
                                                adapter.setForeignState(shutterSettings[i].name, shutterHeight, false);
                                                shutterSettings[i].currentHeight = shutterHeight;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                adapter.log.debug('save current height: ' + shutterSettings[i].currentHeight + '%' + ' from ' + shutterSettings[i].shutterName);
                                                shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                return (shutterSettings);
                                            }
                                            else if (typeof state != undefined && state != null && state.val == shutterHeight) {
                                                shutterSettings[i].currentHeight = shutterHeight;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                adapter.log.debug('GoldenHour up ' + shutterSettings[i].shutterName + ' already up at: ' + shutterSettings[i].heightUp + '% - setting current action: ' + shutterSettings[i].currentAction);
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
                                                adapter.log.info('#6 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterHeight + '%');
                                                adapter.setForeignState(shutterSettings[i].name, shutterHeight, false);
                                                shutterSettings[i].currentHeight = shutterHeight;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                adapter.log.debug('save current height: ' + shutterSettings[i].currentHeight + '%' + ' from ' + shutterSettings[i].shutterName);
                                                shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                return (shutterSettings);
                                            }
                                            else if (typeof state != undefined && state != null && state.val == shutterHeight) {
                                                shutterSettings[i].currentHeight = shutterHeight;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                adapter.log.debug('GoldenHour up ' + shutterSettings[i].shutterName + ' already up at: ' + shutterSettings[i].heightUp + '% - setting current action: ' + shutterSettings[i].currentAction);
                                                shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                return (shutterSettings);
                                            }
                                        });
                                    } else if (currentValue != mustValue && shutterSettings[i].autoDrive == 'onlyDown' && shutterSettings[i].driveAfterClose == true) {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: number; }} state
                                         */
                                        adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                adapter.log.info('#7 Will open ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterHeight + '%' + ' after the window has been closed ');
                                                shutterSettings[i].triggerHeight = shutterHeight;
                                                adapter.log.debug('save new trigger height: ' + shutterHeight + '%');
                                                shutterSettings[i].triggerAction = shutterSettings[i].currentAction;
                                                adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
                                                return (shutterSettings);
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

    if (goldenHour) {

        let upTime = goldenHour.split(':');

        schedule.cancelJob('shutterDownGoldenHour');

        const downGoldenHour = schedule.scheduleJob('shutterDownGoldenHour', upTime[1] + ' ' + upTime[0] + ' * * *', function () {
            // Full Result
            const resultFull = shutterSettings;

            if (resultFull) {
                // Filter Area Living
                const /**
                     * @param {{ typeDown: string; }} d
                     */
                    resLiving = resultFull.filter(d => d.typeDown == 'goldenhour');
                // Filter enabled
                let /**
                     * @param {{ enabled: boolean; }} d
                     */
                    resEnabled = resLiving.filter(d => d.enabled === true);

                let result = resEnabled;

                for (const i in result) {
                    let nameDevice = shutterSettings[i].shutterName.replace(/[.;, ]/g, '_');
                    /**
                     * @param {any} err
                     * @param {boolean} state
                     */

                    // between Position Level
                    const targetLevel2Set = shutterSettings[i].betweenPosition == true ? shutterSettings[i].betweenPositionLevel : shutterSettings[i].heightDown;

                    adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {
                            setTimeout(function () {
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
                                    if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyUp' && shutterSettings[i].autoDrive != 'off')) {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: any; }} state
                                         */
                                        adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                adapter.log.info('#8 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                adapter.setForeignState(shutterSettings[i].name, parseFloat(targetLevel2Set), false);
                                                shutterSettings[i].currentHeight = targetLevel2Set;
                                                shutterSettings[i].currentAction = 'down';
                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                adapter.log.debug('save current height: ' + shutterSettings[i].currentHeight + '%' + ' from ' + shutterSettings[i].shutterName);
                                                shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                return (shutterSettings);
                                            }
                                            else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                shutterSettings[i].currentHeight = targetLevel2Set;
                                                shutterSettings[i].currentAction = 'down';
                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                adapter.log.debug('GoldenHour down ' + shutterSettings[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[i].currentAction);
                                                shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                return (shutterSettings);
                                            }
                                        });
                                    } else if (shutterSettings[i].triggerID == '') {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: any; }} state
                                         */
                                        adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                adapter.log.info('#9 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                adapter.setForeignState(shutterSettings[i].name, parseFloat(targetLevel2Set), false);
                                                shutterSettings[i].currentHeight = targetLevel2Set;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                shutterSettings[i].currentAction = 'down';
                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                adapter.log.debug('save current height: ' + shutterSettings[i].currentHeight + '%' + ' from ' + shutterSettings[i].shutterName);
                                                shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                return (shutterSettings);
                                            }
                                            else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                shutterSettings[i].currentHeight = targetLevel2Set;
                                                shutterSettings[i].currentAction = 'down';
                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                adapter.log.debug('GoldenHour down ' + shutterSettings[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[i].currentAction);
                                                shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                return (shutterSettings);
                                            }
                                        });
                                    } else if (currentValue != mustValue && shutterSettings[i].autoDrive == 'onlyUp' && shutterSettings[i].driveAfterClose == true) {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: number; }} state
                                         */
                                        adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                adapter.log.info('#7 Will close ID: ' + shutterSettings[i].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                shutterSettings[i].triggerHeight = targetLevel2Set;
                                                adapter.log.debug('save new trigger height: ' + targetLevel2Set + '%');
                                                shutterSettings[i].triggerAction = 'down';
                                                adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
                                                return (shutterSettings);
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
}
module.exports = shutterGoldenHour;