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
        setTimeout(function () {
            if (shutterSettings[i].triggerChange == 'onlyUp' || shutterSettings[i].triggerChange == 'upDown' || (shutterSettings[i].triggerChange == 'off' && shutterSettings[i].autoDrive != 'off' && shutterSettings[i].driveAfterClose == true)) {
                let nameDevice = shutterSettings[i].shutterName.replace(/[.;, ]/g, '_');
                /**
                 * @param {any} err
                 * @param {boolean} state
                 */
                adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                    if (state && state === true || state && state.val === true) {

                        /** @type {boolean} */
                        let convertShutter;

                        if (parseInt(shutterSettings[i].heightDown) < parseInt(shutterSettings[i].heightUp)) {
                            convertShutter = false;
                            adapter.log.debug(shutterSettings[i].shutterName + ' - shutter conversion is:' + convertShutter);
                        } else if (parseInt(shutterSettings[i].heightDown) > parseInt(shutterSettings[i].heightUp)) {
                            convertShutter = true;
                            adapter.log.debug(shutterSettings[i].shutterName + ' - shutter conversion is:' + convertShutter);
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
                            if (currentValue != mustValue) {

                                /**
                                 * @param {any} err
                                 * @param {{ val: number; }} state
                                 */
                                adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                    if (state && state.val) {
                                        adapter.log.debug(shutterSettings[i].shutterName + ' - shutter current state.val is:' + state.val);
                                    }
                                    adapter.log.debug(shutterSettings[i].shutterName + ' - shutter trigger drive-up is:' + shutterSettings[i].triggerDrive);
                                    adapter.log.debug(shutterSettings[i].shutterName + ' - shutter trigger change is:' + shutterSettings[i].triggerChange);

                                    if (typeof state != undefined && state != null && parseFloat(state.val) != shutterSettings[i].triggerDrive && shutterSettings[i].triggerChange != 'off' && ((parseFloat(state.val) < shutterSettings[i].triggerDrive && convertShutter == false) || (parseFloat(state.val) > shutterSettings[i].triggerDrive && convertShutter == true))) {
                                        shutterSettings[i].triggerHeight = parseFloat(state.val);
                                        adapter.log.debug('#1 save trigger height: ' + shutterSettings[i].triggerHeight + '% for device ' + shutterSettings[i].shutterName);
                                        shutterSettings[i].triggerAction = shutterSettings[i].currentAction;
                                        adapter.log.debug('#1 save trigger action: ' + shutterSettings[i].triggerAction + ' for device ' + shutterSettings[i].shutterName);
                                        adapter.log.info('#1 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].triggerDrive + '%');

                                        setTimeout(function () {
                                            /**
                                            * @param {any} err
                                            * @param {{ val: string; }} state
                                            */
                                            adapter.getForeignState(shutterSettings[i].triggerID, (err, state) => {
                                                let mustValue = ('' + shutterSettings[i].triggerState);
                                                if (typeof state != undefined && state != null) {
                                                    currentValue = ('' + state.val);
                                                }
                                                if (currentValue != mustValue) {
                                                    adapter.log.debug(shutterSettings[i].shutterName + ' - window is still open -> driving now to :' + parseFloat(shutterSettings[i].triggerDrive));
                                                    adapter.setForeignState(shutterSettings[i].name, parseFloat(shutterSettings[i].triggerDrive), false);
                                                    shutterSettings[i].currentHeight = shutterSettings[i].triggerDrive;
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                    shutterSettings[i].currentAction = 'triggered';
                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                    shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                    return (shutterSettings);
                                                }
                                            });
                                        }, shutterSettings[i].trigDelyUp * 1000, i);

                                    } else if (typeof state != undefined && state != null) {
                                        shutterSettings[i].triggerHeight = parseFloat(state.val);
                                        adapter.log.debug('#2 save trigger height: ' + shutterSettings[i].triggerHeight + '% for device: ' + shutterSettings[i].shutterName);
                                        shutterSettings[i].triggerAction = shutterSettings[i].currentAction;
                                        adapter.log.debug('#2 save trigger action: ' + shutterSettings[i].triggerAction + ' for device: ' + shutterSettings[i].shutterName);
                                        shutterSettings[i].currentAction = 'triggered';
                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                        shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                        return (shutterSettings);
                                    }

                                });
                            }
                        });
                    }
                });
            }
            if (shutterSettings[i].triggerChange == 'onlyDown' || shutterSettings[i].triggerChange == 'upDown') {
                let nameDevice = shutterSettings[i].shutterName.replace(/[.;, ]/g, '_');
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
                        adapter.getForeignState(shutterSettings[i].triggerID, (err, state) => {

                            if (typeof state != undefined && state != null) {
                                let currentValue = ('' + state.val);
                                let mustValue = ('' + shutterSettings[i].triggerState);
                                if (currentValue === mustValue) {
                                    /**
                                     * @param {any} err
                                     * @param {{ val: any; }} state
                                     */
                                    adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                        if (state && state.val) {
                                            adapter.log.debug(shutterSettings[i].shutterName + ' - shutter current state.val is:' + state.val);
                                        }
                                        adapter.log.debug(shutterSettings[i].shutterName + ' - shutter current Height is:' + shutterSettings[i].currentHeight);
                                        adapter.log.debug(shutterSettings[i].shutterName + ' - shutter trigger Height is:' + shutterSettings[i].triggerHeight);
                                        adapter.log.debug(shutterSettings[i].shutterName + ' - shutter trigger Action is:' + shutterSettings[i].triggerAction);
                                        adapter.log.debug(shutterSettings[i].shutterName + ' - shutter trigger Change is:' + shutterSettings[i].triggerChange);
                                        adapter.log.debug(shutterSettings[i].shutterName + ' - shutter trigger Action is:' + shutterSettings[i].triggerDrive);

                                        if (typeof state != undefined && state != null && shutterSettings[i].triggerHeight != null && shutterSettings[i].triggerAction != null && parseFloat(state.val) != shutterSettings[i].triggerHeight && parseFloat(state.val) == shutterSettings[i].triggerDrive && shutterSettings[i].currentHeight == shutterSettings[i].triggerDrive && shutterSettings[i].triggerChange != 'off') {
                                            if (shutterSettings[i].triggerAction == '') {
                                                adapter.log.debug('Waring! - not allowed empty values detected - close your window and initialize your shutters with button up! - triggerAction: ' + shutterSettings[i].triggerAction + ' at device: ' + shutterSettings[i].shutterName);
                                            }
                                            setTimeout(function () {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[i].triggerID, (err, state) => {
                                                    if (typeof state != undefined && state != null) {
                                                        let currentValue = ('' + state.val);
                                                        let mustValue = ('' + shutterSettings[i].triggerState);
                                                        if (currentValue === mustValue) {
                                                            adapter.log.info('Window is still closed -> drive to last height: ' + shutterSettings[i].triggerHeight + '% for device: ' + shutterSettings[i].shutterName);
                                                            adapter.setForeignState(shutterSettings[i].name, parseFloat(shutterSettings[i].triggerHeight), false);
                                                            shutterSettings[i].currentHeight = shutterSettings[i].triggerHeight;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                            adapter.log.debug('save back trigger action: ' + shutterSettings[i].triggerAction + ' for device: ' + shutterSettings[i].shutterName);
                                                            shutterSettings[i].currentAction = shutterSettings[i].triggerAction;
                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].triggerAction, ack: true });
                                                            shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                            return (shutterSettings);
                                                        }
                                                    }
                                                });
                                            }, shutterSettings[i].trigDelyDown * 1000, i);

                                        } else if (typeof state != undefined && state != null && shutterSettings[i].triggerHeight != null && parseFloat(state.val) == shutterSettings[i].triggerHeight && shutterSettings[i].triggerChange != 'off') {
                                            if (shutterSettings[i].triggerAction == '') {
                                                adapter.log.debug('Waring! - not allowed empty values detected - close your window and initialize your shutters with button up! - triggerAction: ' + shutterSettings[i].triggerAction + ' at device: ' + shutterSettings[i].shutterName);
                                            }
                                            adapter.log.debug('shutter trigger released ' + shutterSettings[i].shutterName + ' already in place: ' + shutterSettings[i].triggerHeight + '%');
                                            shutterSettings[i].currentHeight = shutterSettings[i].triggerHeight;
                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                            adapter.log.debug('save back trigger action: ' + shutterSettings[i].triggerAction + ' for device ' + shutterSettings[i].shutterName);
                                            shutterSettings[i].currentAction = shutterSettings[i].triggerAction;
                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                            shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                            return (shutterSettings);
                                        } else if (typeof state == undefined || state == null || shutterSettings[i].triggerHeight == null) {
                                            adapter.log.debug('Nothing sent - triggerHeight undefined!! triggerHeigth: ' + shutterSettings[i].triggerHeight);
                                        }

                                    });
                                }
                            }
                        });
                    }
                });
            }
            if (shutterSettings[i].triggerChange == 'off' && shutterSettings[i].autoDrive != 'off' && shutterSettings[i].driveAfterClose == true) {
                let nameDevice = shutterSettings[i].shutterName.replace(/[.;, ]/g, '_');
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
                        adapter.getForeignState(shutterSettings[i].triggerID, (err, state) => {

                            if (typeof state != undefined && state != null) {
                                let currentValue = ('' + state.val);
                                let mustValue = ('' + shutterSettings[i].triggerState);
                                if (currentValue === mustValue) {
                                    /**
                                     * @param {any} err
                                     * @param {{ val: any; }} state
                                     */
                                    adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                        if (state && state.val) {
                                            adapter.log.debug(shutterSettings[i].shutterName + ' - shutter current state.val is:' + state.val);
                                        }
                                        adapter.log.debug(shutterSettings[i].shutterName + ' - shutter trigger Height is:' + shutterSettings[i].triggerHeight);
                                        adapter.log.debug(shutterSettings[i].shutterName + ' - shutter height down is:' + shutterSettings[i].heightDown);

                                        if (typeof state != undefined && state != null && shutterSettings[i].triggerHeight != null && parseFloat(state.val) != shutterSettings[i].triggerHeight && parseFloat(state.val) != shutterSettings[i].heightDown) {
                                            if (shutterSettings[i].triggerAction == '') {
                                                adapter.log.debug('Waring! - not allowed empty values detected - close your window and initialize your shutters with button up! - triggerAction: ' + shutterSettings[i].triggerAction + ' at device: ' + shutterSettings[i].shutterName);
                                            }
                                            setTimeout(function () {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[i].triggerID, (err, state) => {

                                                    if (typeof state != undefined && state != null) {
                                                        let currentValue = ('' + state.val);
                                                        let mustValue = ('' + shutterSettings[i].triggerState);
                                                        if (currentValue === mustValue) {
                                                            adapter.log.info('Window was closed -> change to last requested height: ' + shutterSettings[i].triggerHeight + '% for device ' + shutterSettings[i].shutterName);
                                                            adapter.setForeignState(shutterSettings[i].name, parseFloat(shutterSettings[i].triggerHeight), false);
                                                            shutterSettings[i].currentHeight = shutterSettings[i].triggerHeight;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                            adapter.log.debug('save back trigger action: ' + shutterSettings[i].triggerAction + ' for device ' + shutterSettings[i].shutterName);
                                                            shutterSettings[i].currentAction = shutterSettings[i].triggerAction;
                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].triggerAction, ack: true });
                                                            shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                            return (shutterSettings);
                                                        }
                                                    }
                                                });
                                            }, shutterSettings[i].trigDelyDown * 1000, i);

                                        } else if (typeof state != undefined && state != null && shutterSettings[i].triggerHeight != null && parseFloat(state.val) == shutterSettings[i].triggerHeight) {
                                            if (shutterSettings[i].triggerAction == '') {
                                                adapter.log.debug('Waring! - not allowed empty values detected - close your window and initialize your shutters with button up! - triggerAction: ' + shutterSettings[i].triggerAction + ' at device: ' + shutterSettings[i].shutterName);
                                            }
                                            adapter.log.debug('shutter trigger released ' + shutterSettings[i].shutterName + ' already in place: ' + shutterSettings[i].triggerHeight + '%');
                                            shutterSettings[i].currentHeight = shutterSettings[i].triggerHeight;
                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                            adapter.log.debug('save back trigger action: ' + shutterSettings[i].triggerAction + ' for device ' + shutterSettings[i].shutterName);
                                            shutterSettings[i].currentAction = shutterSettings[i].triggerAction;
                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                            shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                            return (shutterSettings);
                                        } else if (typeof state == undefined || state == null || shutterSettings[i].triggerHeight == null) {
                                            adapter.log.debug('Nothing sent - triggerHeight undefined!! triggerHeigth: ' + shutterSettings[i].triggerHeight);
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
module.exports = triggerChange;
