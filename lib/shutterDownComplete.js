'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');         // shutterState

const CheckInSummerNotDown = require('./isSummerTime.js').CheckInSummerNotDown;
const GetXmasLevel = require('./isSummerTime.js').GetXmasLevel;

function shutterDownComplete(adapter, delayDown) {

    try {
        const driveDelayDownLiving = adapter.config.driveDelayDownLiving * 1000;

        const downTimeComplete = adapter.config.betweenPositionTime.split(':');

        adapter.log.debug('complete down at ' + adapter.config.betweenPositionTime);

        schedule.cancelJob('shutterDownComplete');

        const downComplete = schedule.scheduleJob('shutterDownComplete', downTimeComplete[1] + ' ' + downTimeComplete[0] + ' * * *', function () {
            delayDown = delayDown * driveDelayDownLiving;

            // Full Result
            const resultFull = adapter.config.events;

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

                    const inSummerNotDown = CheckInSummerNotDown(adapter, result[i]);

                    const XmasLevel = GetXmasLevel(adapter, result[i]);

                    //entweder xmas level oder standard down level
                    const targetLevel2Set = XmasLevel > -1 ? XmasLevel : result[i].heightDown;

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
                                                    result[i].currentHeight = targetLevel2Set;
                                                    adapter.log.info('#12 Set ID: ' + result[i].name + ' ' + result[i].shutterName + ' value: ' + targetLevel2Set + '%');
                                                    adapter.setForeignState(result[i].name, parseFloat(targetLevel2Set), false);
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
                                                    adapter.log.debug('Complete down ' + result[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + result[i].currentAction);
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
                                                    adapter.log.debug('Complete down ' + result[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + result[i].currentAction);
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
                                }, delayDown);
                            }
                        });
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