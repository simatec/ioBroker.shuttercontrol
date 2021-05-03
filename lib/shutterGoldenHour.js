'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');         // shutterState

function getDate(d) {
    d = d || new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

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
                                                        adapter.log.info('#5 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                        adapter.setForeignState(shutterSettings[s].name, shutterHeight, false);
                                                        shutterSettings[s].currentHeight = shutterHeight;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                        adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                        return (shutterSettings);
                                                    }
                                                    else if (typeof state != undefined && state != null && state.val == shutterHeight) {
                                                        shutterSettings[s].currentHeight = shutterHeight;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                        adapter.log.debug('GoldenHour up ' + shutterSettings[s].shutterName + ' already up at: ' + shutterSettings[s].heightUp + '% - setting current action: ' + shutterSettings[s].currentAction);
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
                                                        adapter.log.info('#6 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                                                        adapter.setForeignState(shutterSettings[s].name, shutterHeight, false);
                                                        shutterSettings[s].currentHeight = shutterHeight;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                        adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                        return (shutterSettings);
                                                    }
                                                    else if (typeof state != undefined && state != null && state.val == shutterHeight) {
                                                        shutterSettings[s].currentHeight = shutterHeight;
                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                        adapter.log.debug('GoldenHour up ' + shutterSettings[s].shutterName + ' already up at: ' + shutterSettings[s].heightUp + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                        return (shutterSettings);
                                                    }
                                                });
                                            } else if (currentValue != mustValue && shutterSettings[s].autoDrive == 'onlyDown' && shutterSettings[s].driveAfterClose == true) {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: number; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                        adapter.log.info('#7 Will open ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%' + ' after the window has been closed ');
                                                        shutterSettings[s].triggerHeight = shutterHeight;
                                                        adapter.log.debug('save new trigger height: ' + shutterHeight + '%');
                                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                        adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
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
                    for (const s in shutterSettings) {
                        if (shutterSettings[s].shutterName == result[i].shutterName) {
                            let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
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

                            adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                                if (state && state === true || state && state.val === true) {
                                    setTimeout(function () {
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
                                            if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyUp' && shutterSettings[s].autoDrive != 'off')) {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: any; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                        adapter.log.info('#8 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                                        adapter.setForeignState(shutterSettings[s].name, targetLevel2Set, false);
                                                        shutterSettings[s].currentHeight = targetLevel2Set;
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
                                                        adapter.log.debug('GoldenHour down ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                        return (shutterSettings);
                                                    }
                                                });
                                            } else if (shutterSettings[s].triggerID == '') {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: any; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                        adapter.log.info('#9 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
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
                                                        adapter.log.debug('GoldenHour down ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                        return (shutterSettings);
                                                    }
                                                });
                                            } else if (currentValue != mustValue && shutterSettings[s].autoDrive == 'onlyUp' && shutterSettings[s].driveAfterClose == true) {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: number; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                        adapter.log.info('#7 Will close ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                        shutterSettings[s].triggerHeight = targetLevel2Set;
                                                        adapter.log.debug('save new trigger height: ' + targetLevel2Set + '%');
                                                        shutterSettings[s].triggerAction = downAction;
                                                        adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
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
                }
            }
        });
    }
}
module.exports = shutterGoldenHour;