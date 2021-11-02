'use strict';

const shutterState = require('./shutterState.js');         // shutterState

function triggerChange(resTriggerChange, adapter, shutterSettings) {

    const resultID = shutterSettings;

    // Filter changed Trigger
    const /**
         * @param {{ triggerID: any; }} d
         */
        arrayChangeTrigger = resultID.filter(d => d.triggerID == resTriggerChange);

    for (const i in arrayChangeTrigger) {
        for (const s in shutterSettings) {
            if (shutterSettings[s].shutterName == arrayChangeTrigger[i].shutterName) {
                setTimeout(function () {
                    if (shutterSettings[s].triggerChange == 'onlyUp' || shutterSettings[s].triggerChange == 'upDown' || (shutterSettings[s].triggerChange == 'off' && shutterSettings[s].driveAfterClose == true)) {
                        let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                        /**
                         * @param {any} err
                         * @param {boolean} state
                         */
                        adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                            if (state && state === true || state && state.val === true) {

                                /** @type {boolean} */
                                let convertShutter;

                                if (parseInt(shutterSettings[s].heightDown) < parseInt(shutterSettings[s].heightUp)) {
                                    convertShutter = false;
                                    adapter.log.debug(shutterSettings[s].shutterName + ' - shutter conversion is:' + convertShutter);
                                } else if (parseInt(shutterSettings[s].heightDown) > parseInt(shutterSettings[s].heightUp)) {
                                    convertShutter = true;
                                    adapter.log.debug(shutterSettings[s].shutterName + ' - shutter conversion is:' + convertShutter);
                                }
                                let currentValue = '';
                                /**
                                 * @param {any} err
                                 * @param {{ val: string; }} state
                                 */
                                adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {
                                    let mustValue = ('' + shutterSettings[s].triggerState);
                                    let mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);
                                    if (typeof state != undefined && state != null) {
                                        currentValue = ('' + state.val);
                                    }
                                    if (currentValue != mustValue) {

                                        const setTriggerHeight = currentValue == mustValueTilted ? parseFloat(shutterSettings[s].triggerDriveTildet) : parseFloat(shutterSettings[s].triggerDrive);

                                        /**
                                         * @param {any} err
                                         * @param {{ val: number; }} state
                                         */
                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                            if (state && state.val) {
                                                adapter.log.debug(shutterSettings[s].shutterName + ' - shutter current state.val is:' + state.val);
                                            }
                                            adapter.log.debug(shutterSettings[s].shutterName + ' - shutter trigger drive-up is:' + setTriggerHeight);
                                            adapter.log.debug(shutterSettings[s].shutterName + ' - shutter trigger change is:' + shutterSettings[s].triggerChange);

                                            if (typeof state != undefined && state != null && parseFloat(state.val) != setTriggerHeight && shutterSettings[s].triggerChange != 'off' && ((parseFloat(state.val) < parseFloat(shutterSettings[s].triggerDrive) && convertShutter == false) || (parseFloat(state.val) > parseFloat(shutterSettings[s].triggerDrive) && convertShutter == true))) {
                                                shutterSettings[s].triggerHeight = shutterSettings[s].currentAction != 'triggered' ? parseFloat(state.val) : shutterSettings[s].triggerHeight;
                                                adapter.log.debug('#1 save trigger height: ' + shutterSettings[s].triggerHeight + '% for device ' + shutterSettings[s].shutterName);
                                                shutterSettings[s].triggerAction = shutterSettings[s].currentAction != 'triggered' ? shutterSettings[s].currentAction : shutterSettings[s].triggerAction;
                                                adapter.log.debug('#1 save trigger action: ' + shutterSettings[s].triggerAction + ' for device ' + shutterSettings[s].shutterName);
                                                adapter.log.info('#1 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + setTriggerHeight + '%');

                                                setTimeout(function () {
                                                    /**
                                                    * @param {any} err
                                                    * @param {{ val: string; }} state
                                                    */
                                                    adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {
                                                        let mustValue = ('' + shutterSettings[s].triggerState);
                                                        let mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                                        if (typeof state != undefined && state != null) {
                                                            currentValue = ('' + state.val);
                                                        }
                                                        if (currentValue != mustValue) {
                                                            adapter.log.debug(shutterSettings[s].shutterName + ' - window is still open -> driving now to :' + setTriggerHeight);
                                                            adapter.setForeignState(shutterSettings[s].name, setTriggerHeight, false);
                                                            shutterSettings[s].currentHeight = setTriggerHeight;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                            shutterSettings[s].currentAction = 'triggered';
                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                            return (shutterSettings);
                                                        }
                                                    });
                                                }, shutterSettings[s].trigDelyUp * 1000, i);

                                            } else if (typeof state != undefined && state != null) {
                                                shutterSettings[s].triggerHeight = shutterSettings[s].currentAction != 'triggered' ? parseFloat(state.val) : shutterSettings[s].triggerHeight;
                                                adapter.log.debug('#2 save trigger height: ' + shutterSettings[s].triggerHeight + '% for device: ' + shutterSettings[s].shutterName);
                                                shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                adapter.log.debug('#2 save trigger action: ' + shutterSettings[s].triggerAction + ' for device: ' + shutterSettings[s].shutterName);
                                                shutterSettings[s].currentAction = 'triggered';
                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                return (shutterSettings);
                                            }

                                        });
                                    }
                                });
                            }
                        });
                    }
                    if (shutterSettings[s].triggerChange == 'onlyDown' || shutterSettings[s].triggerChange == 'upDown') {
                        let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                        /**
                         * @param {any} err
                         * @param {boolean} state
                         */
                        adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                            if (state && state === true || state && state.val === true) {
                                /**
                                 * @param {any} err
                                 * @param {{ val: string; }} state
                                 */
                                adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {

                                    if (typeof state != undefined && state != null) {
                                        let currentValue = ('' + state.val);
                                        let mustValue = ('' + shutterSettings[s].triggerState);
                                        let mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                        if (currentValue === mustValue) {
                                            const setTriggerHeight = currentValue == mustValueTilted ? parseFloat(shutterSettings[s].triggerDriveTildet) : parseFloat(shutterSettings[s].triggerDrive);
                                            /**
                                             * @param {any} err
                                             * @param {{ val: any; }} state
                                             */
                                            adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                if (state && state.val) {
                                                    adapter.log.debug(shutterSettings[s].shutterName + ' - shutter current state.val is:' + state.val);
                                                }
                                                adapter.log.debug(shutterSettings[s].shutterName + ' - shutter current Height is:' + shutterSettings[s].currentHeight);
                                                adapter.log.debug(shutterSettings[s].shutterName + ' - shutter trigger Height is:' + shutterSettings[s].triggerHeight);
                                                adapter.log.debug(shutterSettings[s].shutterName + ' - shutter trigger Action is:' + shutterSettings[s].triggerAction);
                                                adapter.log.debug(shutterSettings[s].shutterName + ' - shutter trigger Change is:' + shutterSettings[s].triggerChange);
                                                adapter.log.debug(shutterSettings[s].shutterName + ' - shutter trigger Action is:' + setTriggerHeight);

                                                if (typeof state != undefined && state != null && shutterSettings[s].triggerHeight != null && shutterSettings[s].triggerAction != null && parseFloat(state.val) != shutterSettings[s].triggerHeight && parseFloat(state.val) == setTriggerHeight && (shutterSettings[s].currentHeight == shutterSettings[s].triggerDrive || shutterSettings[s].currentHeight == shutterSettings[s].triggerDriveTildet) && shutterSettings[s].triggerChange != 'off') {
                                                    if (shutterSettings[s].triggerAction == '') {
                                                        adapter.log.debug('Waring! - not allowed empty values detected - close your window and initialize your shutters with button up! - triggerAction: ' + shutterSettings[s].triggerAction + ' at device: ' + shutterSettings[s].shutterName);
                                                    }
                                                    setTimeout(function () {
                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: string; }} state
                                                         */
                                                        adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                let currentValue = ('' + state.val);
                                                                let mustValue = ('' + shutterSettings[s].triggerState);
                                                                let mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                                                if (currentValue === mustValue) {
                                                                    adapter.log.info('Window is still closed -> drive to last height: ' + shutterSettings[s].triggerHeight + '% for device: ' + shutterSettings[s].shutterName);
                                                                    adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].triggerHeight), false);
                                                                    shutterSettings[s].currentHeight = shutterSettings[s].triggerHeight;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                    adapter.log.debug('save back trigger action: ' + shutterSettings[s].triggerAction + ' for device: ' + shutterSettings[s].shutterName);
                                                                    shutterSettings[s].currentAction = shutterSettings[s].triggerAction;
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].triggerAction, ack: true });
                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                            }
                                                        });
                                                    }, shutterSettings[s].trigDelyDown * 1000, i);

                                                } else if (typeof state != undefined && state != null && shutterSettings[s].triggerHeight != null && parseFloat(state.val) == shutterSettings[s].triggerHeight && shutterSettings[s].triggerChange != 'off') {
                                                    if (shutterSettings[s].triggerAction == '') {
                                                        adapter.log.debug('Waring! - not allowed empty values detected - close your window and initialize your shutters with button up! - triggerAction: ' + shutterSettings[s].triggerAction + ' at device: ' + shutterSettings[s].shutterName);
                                                    }
                                                    adapter.log.debug('#1 shutter trigger released ' + shutterSettings[s].shutterName + ' already in place: ' + shutterSettings[s].triggerHeight + '%');
                                                    shutterSettings[s].currentHeight = shutterSettings[s].triggerHeight;
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                    adapter.log.debug('save back trigger action: ' + shutterSettings[s].triggerAction + ' for device ' + shutterSettings[s].shutterName);
                                                    shutterSettings[s].currentAction = shutterSettings[s].triggerAction;
                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                    return (shutterSettings);
                                                } else if (typeof state == undefined || state == null || shutterSettings[s].triggerHeight == null) {
                                                    adapter.log.debug('Nothing sent - triggerHeight undefined!! triggerHeigth: ' + shutterSettings[s].triggerHeight);
                                                }

                                            });
                                        }
                                    }
                                });
                            }
                        });
                    }
                    if (shutterSettings[s].triggerChange == 'off' && shutterSettings[s].driveAfterClose == true) {
                        let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                        /**
                         * @param {any} err
                         * @param {boolean} state
                         */
                        adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                            if (state && state === true || state && state.val === true) {
                                /**
                                 * @param {any} err
                                 * @param {{ val: string; }} state
                                 */
                                adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {

                                    if (typeof state != undefined && state != null) {
                                        let currentValue = ('' + state.val);
                                        let mustValue = ('' + shutterSettings[s].triggerState);
                                        let mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);
                                        if (currentValue === mustValue) {
                                            /**
                                             * @param {any} err
                                             * @param {{ val: any; }} state
                                             */
                                            adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                if (state && state.val) {
                                                    adapter.log.debug(shutterSettings[s].shutterName + ' - shutter current state.val is:' + state.val);
                                                }
                                                adapter.log.debug(shutterSettings[s].shutterName + ' - shutter trigger Height is:' + shutterSettings[s].triggerHeight);
                                                adapter.log.debug(shutterSettings[s].shutterName + ' - shutter height down is:' + shutterSettings[s].heightDown);

                                                if (typeof state != undefined && state != null && shutterSettings[s].triggerHeight != null && parseFloat(state.val) != shutterSettings[s].triggerHeight && parseFloat(state.val) != shutterSettings[s].heightDown) {
                                                    if (shutterSettings[s].triggerAction == '') {
                                                        adapter.log.debug('Waring! - not allowed empty values detected - close your window and initialize your shutters with button up! - triggerAction: ' + shutterSettings[s].triggerAction + ' at device: ' + shutterSettings[s].shutterName);
                                                    }
                                                    setTimeout(function () {
                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: string; }} state
                                                         */
                                                        adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {

                                                            if (typeof state != undefined && state != null) {
                                                                let currentValue = ('' + state.val);
                                                                let mustValue = ('' + shutterSettings[s].triggerState);
                                                                let mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);
                                                                if (currentValue === mustValue) {
                                                                    adapter.log.info('Window was closed -> change to last requested height: ' + shutterSettings[s].triggerHeight + '% for device ' + shutterSettings[s].shutterName);
                                                                    adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].triggerHeight), false);
                                                                    shutterSettings[s].currentHeight = shutterSettings[s].triggerHeight;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                    adapter.log.debug('save back trigger action: ' + shutterSettings[s].triggerAction + ' for device ' + shutterSettings[s].shutterName);
                                                                    shutterSettings[s].currentAction = shutterSettings[s].triggerAction;
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].triggerAction, ack: true });
                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                            }
                                                        });
                                                    }, shutterSettings[s].trigDelyDown * 1000, i);

                                                } else if (typeof state != undefined && state != null && shutterSettings[s].triggerHeight != null && parseFloat(state.val) == shutterSettings[s].triggerHeight) {
                                                    if (shutterSettings[s].triggerAction == '') {
                                                        adapter.log.debug('Waring! - not allowed empty values detected - close your window and initialize your shutters with button up! - triggerAction: ' + shutterSettings[s].triggerAction + ' at device: ' + shutterSettings[s].shutterName);
                                                    }
                                                    adapter.log.debug('#2 shutter trigger released ' + shutterSettings[s].shutterName + ' already in place: ' + shutterSettings[s].triggerHeight + '%');
                                                    shutterSettings[s].currentHeight = shutterSettings[s].triggerHeight;
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                    adapter.log.debug('save back trigger action: ' + shutterSettings[s].triggerAction + ' for device ' + shutterSettings[s].shutterName);
                                                    shutterSettings[s].currentAction = shutterSettings[s].triggerAction;
                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                    return (shutterSettings);
                                                } else if (typeof state == undefined || state == null || shutterSettings[s].triggerHeight == null) {
                                                    adapter.log.debug('Nothing sent - triggerHeight undefined!! triggerHeigth: ' + shutterSettings[s].triggerHeight);
                                                }
                                            });
                                        }
                                    }
                                });
                            }
                        });
                    }
                }, 1000 * i, i);
            }
        }
    }
}
module.exports = triggerChange;
