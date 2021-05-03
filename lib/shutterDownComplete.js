'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');         // shutterState

const CheckInSummerNotDown = require('./isSummerTime.js').CheckInSummerNotDown;
const GetXmasLevel = require('./isSummerTime.js').GetXmasLevel;

function shutterDownComplete(adapter, delayDown, shutterSettings) {

    try {
        const driveDelayDownLiving = adapter.config.driveDelayDownLiving * 1000;

        const downTimeComplete = adapter.config.betweenPositionTime.split(':');

        adapter.log.debug('complete down at ' + adapter.config.betweenPositionTime);

        schedule.cancelJob('shutterDownComplete');

        const downComplete = schedule.scheduleJob('shutterDownComplete', downTimeComplete[1] + ' ' + downTimeComplete[0] + ' * * *', function () {
            delayDown = delayDown * driveDelayDownLiving;

            // Full Result
            const resultFull = shutterSettings;

            if (resultFull) {
                // Filter Area Living
                const /**
                     * @param {{ typeDown: string; }} d
                     */
                    resLiving = resultFull.filter(d => d.betweenPosition == true);
                // Filter enabled
                let /**
                     * @param {{ enabled: boolean; }} d
                     */
                    resEnabled = resLiving.filter(d => d.enabled === true);

                const result = resEnabled;

                for (const i in result) {
                    for (const s in shutterSettings) {
                        if (shutterSettings[s].shutterName == result[i].shutterName && shutterSettings[s].currentAction == 'middle') {
                            const inSummerNotDown = CheckInSummerNotDown(adapter, shutterSettings[s]);

                            const XmasLevel = GetXmasLevel(adapter, shutterSettings[s]);

                            //entweder xmas level oder standard down level
                            const targetLevel2Set = XmasLevel > -1 ? XmasLevel : shutterSettings[s].heightDown;

                            if (!inSummerNotDown) {

                                const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
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
                                            adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {
                                                const mustValue = ('' + shutterSettings[s].triggerState);
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
                                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                                            adapter.log.info('#12 Set ID: ' + shutterSettings[s].name + ' ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                                            adapter.setForeignState(shutterSettings[s].name, parseFloat(targetLevel2Set), false);
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                            shutterSettings[s].currentAction = 'down';
                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                            return (shutterSettings);
                                                        }
                                                        else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                            shutterSettings[s].currentAction = 'down';
                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                            adapter.log.debug('Complete down ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
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
                                                            adapter.log.info('#13 Set ID: ' + shutterSettings[s].name + ' ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                                            adapter.setForeignState(shutterSettings[s].name, parseFloat(targetLevel2Set), false);
                                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                            shutterSettings[s].currentAction = 'down';
                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                            return (shutterSettings);
                                                        }
                                                        else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                            shutterSettings[s].currentAction = 'down';
                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                            adapter.log.debug('Complete down ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
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
                                                            adapter.log.info('#14 Will close ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                                            shutterSettings[s].triggerHeight = targetLevel2Set;
                                                            adapter.log.debug('save new trigger height: ' + targetLevel2Set + '%');
                                                            shutterSettings[s].triggerAction = 'down';
                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                            return (shutterSettings);
                                                        }
                                                    });
                                                }
                                            });
                                        }, delayDown);
                                    }
                                });
                            }
                        }
                    }
                }
            }
        });
    }
    catch (e) {
        adapter.log.error('exception catch shutterDownComplete [' + e + ']');
    }
}
module.exports = shutterDownComplete;