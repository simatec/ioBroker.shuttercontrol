'use strict';

const shutterState = require('./shutterState.js');         // shutterState
const sunProtect = require('./sunProtect.js');         // sunProtect

function getDate(d) {
    d = d || new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

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
            for (const s in shutterSettings) {
                if (shutterSettings[s].shutterName == result[i].shutterName) {
                    let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

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
                            let elevationEnd = (shutterSettings[s].elevation - 1);
                            if (elevation <= shutterSettings[s].elevation && elevation >= elevationEnd && shutterSettings[s].currentAction != 'down' && azimuth > 180) {
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
                                                    adapter.log.info('#3 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
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
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                    shutterSettings[s].currentAction = downAction;
                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                    adapter.log.debug('elevation down ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
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
                                                    adapter.log.info('#4 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
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
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                                    shutterSettings[s].currentAction = downAction;
                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                    adapter.log.debug('elevation down ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                    return (shutterSettings);
                                                }
                                            });
                                        } else if (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyUp' && shutterSettings[s].driveAfterClose == true) {
                                            /**
                                             * @param {any} err
                                             * @param {{ val: any; }} state
                                             */
                                            adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                                    adapter.log.info('#5 Will close ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
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
                        }
                    });
                }
            }
        }
    }
    setTimeout(function () {
        if (elevation <= adapter.config.sunProtEndElevation) {
            sunProtect(adapter, elevation, azimuth, shutterSettings);
        }
    }, 120000);
}
module.exports = elevationDown;