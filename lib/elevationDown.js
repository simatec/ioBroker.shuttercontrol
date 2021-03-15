'use strict';

const shutterState = require('./shutterState.js');         // shutterState
const sunProtect = require('./sunProtect.js');         // sunProtect


function elevationDown(adapter, elevation, azimuth, shutterSettings) {
    // Full Result
    const resultFull = shutterSettings;

    if (resultFull) {
        const driveDelayUpAstro = adapter.config.driveDelayUpAstro * 1000;
        // Filter Area Living
        const /**
             * @param {{ typeDown: string; }} d
             */
            resLiving = resultFull.filter(d => d.typeDown == 'elevation');
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
            let targetLevel2Set = shutterSettings[i].betweenPosition == true ? shutterSettings[i].betweenPositionLevel : shutterSettings[i].heightDown;

            adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                if (state && state === true || state && state.val === true) {
                    let elevationEnd = (shutterSettings[i].elevation - 1);
                    if (elevation <= shutterSettings[i].elevation && elevation >= elevationEnd && shutterSettings[i].currentAction != 'down' && azimuth > 180) {
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
                                            adapter.log.info('#3 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + targetLevel2Set + '%');
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
                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                            shutterSettings[i].currentAction = 'down';
                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                            adapter.log.debug('elevation down ' + shutterSettings[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[i].currentAction);
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
                                            adapter.log.info('#4 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + targetLevel2Set + '%');
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
                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                            shutterSettings[i].currentAction = 'down';
                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                            adapter.log.debug('elevation down ' + shutterSettings[i].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[i].currentAction);
                                            shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                            return (shutterSettings);
                                        }
                                    });
                                } else if (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyUp' && shutterSettings[i].driveAfterClose == true) {
                                    /**
                                     * @param {any} err
                                     * @param {{ val: any; }} state
                                     */
                                    adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                        if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                            adapter.log.info('#5 Will close ID: ' + shutterSettings[i].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
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
                }
            });
        }
    }
    setTimeout(function () {
        if (elevation <= adapter.config.sunProtEndElevation) {
            sunProtect(adapter, elevation, azimuth, shutterSettings);
        }
    }, 120000);
}
module.exports = elevationDown;