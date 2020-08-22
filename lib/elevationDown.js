'use strict';

const shutterState = require('./shutterState.js');         // shutterState
const sunProtect = require('./sunProtect.js');         // sunProtect


function elevationDown(adapter, elevation, azimuth) {
    // Full Result
    const resultFull = adapter.config.events;

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
            let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
            /**
             * @param {any} err
             * @param {boolean} state
             */
            adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                if (state && state === true || state && state.val === true) {
                    let elevationEnd = (result[i].elevation - 1);
                    if (elevation <= result[i].elevation && elevation >= elevationEnd && result[i].currentAction != 'down' && azimuth > 180) {
                        setTimeout(function () {
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
                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp' && result[i].autoDrive != 'off')) {
                                    /**
                                     * @param {any} err
                                     * @param {{ val: any; }} state
                                     */
                                    adapter.getForeignState(result[i].name, (err, state) => {
                                        if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                                            adapter.log.info('#3 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                            result[i].currentHeight = result[i].heightDown;
                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                            result[i].currentAction = 'down';
                                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                            adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                            shutterState(result[i].name, adapter);
                                        }
										else if (typeof state != undefined && state != null && state.val == result[i].heightDown) {
                                            result[i].currentHeight = result[i].heightDown;
                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                            result[i].currentAction = 'down';
                                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                            adapter.log.debug('elevation down ' + result[i].shutterName + ' already down at: ' + result[i].heightDown + '% - setting current action: ' + result[i].currentAction);
                                            shutterState(result[i].name, adapter);
										}
                                    });
                                } else if (result[i].triggerID == '') {
                                    /**
                                     * @param {any} err
                                     * @param {{ val: any; }} state
                                     */
                                    adapter.getForeignState(result[i].name, (err, state) => {
                                        if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                                            adapter.log.info('#4 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                            result[i].currentHeight = result[i].heightDown;
                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                            result[i].currentAction = 'down';
                                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                            adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                            shutterState(result[i].name, adapter);
                                        }
										else if (typeof state != undefined && state != null && state.val == result[i].heightDown) {
                                            result[i].currentHeight = result[i].heightDown;
                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                            result[i].currentAction = 'down';
                                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                            adapter.log.debug('elevation down ' + result[i].shutterName + ' already down at: ' + result[i].heightDown + '% - setting current action: ' + result[i].currentAction);
                                            shutterState(result[i].name, adapter);
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
            sunProtect(adapter, elevation, azimuth);
        }
    }, 120000);
}
module.exports = elevationDown;