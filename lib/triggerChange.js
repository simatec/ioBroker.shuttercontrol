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
            if (arrayChangeTrigger[i].triggerChange == 'onlyUp' || arrayChangeTrigger[i].triggerChange == 'upDown' || (arrayChangeTrigger[i].triggerChange == 'off' && arrayChangeTrigger[i].autoDrive != 'off' && arrayChangeTrigger[i].driveAfterClose == true)) {
                let nameDevice = arrayChangeTrigger[i].shutterName.replace(/[.;, ]/g, '_');
                /**
                 * @param {any} err
                 * @param {boolean} state
                 */
                adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                    if (state && state === true || state && state.val === true) {

                        /** @type {boolean} */
                        let convertShutter;

                        if (parseInt(arrayChangeTrigger[i].heightDown) < parseInt(arrayChangeTrigger[i].heightUp)) {
                            convertShutter = false;
                            adapter.log.debug(arrayChangeTrigger[i].shutterName + ' - shutter conversion is:' + convertShutter);
                        } else if (parseInt(arrayChangeTrigger[i].heightDown) > parseInt(arrayChangeTrigger[i].heightUp)) {
                            convertShutter = true;
                            adapter.log.debug(arrayChangeTrigger[i].shutterName + ' - shutter conversion is:' + convertShutter);
                        }
                        let currentValue = '';
                        /**
                         * @param {any} err
                         * @param {{ val: string; }} state
                         */
                        adapter.getForeignState(arrayChangeTrigger[i].triggerID, (err, state) => {
                            let mustValue = ('' + arrayChangeTrigger[i].triggerState);
                            if (typeof state != undefined && state != null) {
                                currentValue = ('' + state.val);
                            }
                            if (currentValue != mustValue) {

                                /**
                                 * @param {any} err
                                 * @param {{ val: number; }} state
                                 */
                                adapter.getForeignState(arrayChangeTrigger[i].name, (err, state) => {
                                    if (state && state.val) {
                                        adapter.log.debug(arrayChangeTrigger[i].shutterName + ' - shutter current state.val is:' + state.val);
                                    }
                                    adapter.log.debug(arrayChangeTrigger[i].shutterName + ' - shutter trigger drive-up is:' + arrayChangeTrigger[i].triggerDrive);
                                    adapter.log.debug(arrayChangeTrigger[i].shutterName + ' - shutter trigger change is:' + arrayChangeTrigger[i].triggerChange);

                                    if (typeof state != undefined && state != null && parseFloat(state.val) != arrayChangeTrigger[i].triggerDrive && arrayChangeTrigger[i].triggerChange != 'off' && ((parseFloat(state.val) < arrayChangeTrigger[i].triggerDrive && convertShutter == false) || (parseFloat(state.val) > arrayChangeTrigger[i].triggerDrive && convertShutter == true))) {
                                        shutterSettings[i].triggerHeight = parseFloat(state.val);
                                        adapter.log.debug('#1 save trigger height: ' + arrayChangeTrigger[i].triggerHeight + '% for device ' + arrayChangeTrigger[i].shutterName);
                                        shutterSettings[i].triggerAction = shutterSettings[i].currentAction;
                                        adapter.log.debug('#1 save trigger action: ' + arrayChangeTrigger[i].triggerAction + ' for device ' + arrayChangeTrigger[i].shutterName);
                                        adapter.log.info('#1 Set ID: ' + arrayChangeTrigger[i].shutterName + ' value: ' + arrayChangeTrigger[i].triggerDrive + '%');

                                        setTimeout(function () {
                                            /**
                                            * @param {any} err
                                            * @param {{ val: string; }} state
                                            */
                                            adapter.getForeignState(arrayChangeTrigger[i].triggerID, (err, state) => {
                                                let mustValue = ('' + arrayChangeTrigger[i].triggerState);
                                                if (typeof state != undefined && state != null) {
                                                    currentValue = ('' + state.val);
                                                }
                                                if (currentValue != mustValue) {
                                                    adapter.log.debug(arrayChangeTrigger[i].shutterName + ' - window is still open -> driving now to :' + parseFloat(arrayChangeTrigger[i].triggerDrive));
                                                    adapter.setForeignState(arrayChangeTrigger[i].name, parseFloat(arrayChangeTrigger[i].triggerDrive), false);
                                                    shutterSettings[i].currentHeight = arrayChangeTrigger[i].triggerDrive;
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: arrayChangeTrigger[i].currentHeight, ack: true });
                                                    shutterSettings[i].currentAction = 'triggered';
                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: arrayChangeTrigger[i].currentAction, ack: true });
                                                    shutterState(arrayChangeTrigger[i].name, adapter, shutterSettings);
                                                    return (shutterSettings);
                                                }
                                            });
                                        }, arrayChangeTrigger[i].trigDelyUp * 1000, i);

                                    } else if (typeof state != undefined && state != null) {
                                        shutterSettings[i].triggerHeight = parseFloat(state.val);
                                        adapter.log.debug('#2 save trigger height: ' + arrayChangeTrigger[i].triggerHeight + '% for device: ' + arrayChangeTrigger[i].shutterName);
                                        shutterSettings[i].triggerAction = shutterSettings[i].currentAction;
                                        adapter.log.debug('#2 save trigger action: ' + arrayChangeTrigger[i].triggerAction + ' for device: ' + arrayChangeTrigger[i].shutterName);
                                        shutterSettings[i].currentAction = 'triggered';
                                        adapter.setState('shutters.autoState.' + nameDevice, { val: arrayChangeTrigger[i].currentAction, ack: true });
                                        shutterState(arrayChangeTrigger[i].name, adapter, shutterSettings);
                                        return (shutterSettings);
                                    }

                                });
                            }
                        });
                    }
                });
            }
            if (arrayChangeTrigger[i].triggerChange == 'onlyDown' || arrayChangeTrigger[i].triggerChange == 'upDown') {
                let nameDevice = arrayChangeTrigger[i].shutterName.replace(/[.;, ]/g, '_');
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
                        adapter.getForeignState(arrayChangeTrigger[i].triggerID, (err, state) => {

                            if (typeof state != undefined && state != null) {
                                let currentValue = ('' + state.val);
                                let mustValue = ('' + arrayChangeTrigger[i].triggerState);
                                if (currentValue === mustValue) {
                                    /**
                                     * @param {any} err
                                     * @param {{ val: any; }} state
                                     */
                                    adapter.getForeignState(arrayChangeTrigger[i].name, (err, state) => {
                                        if (state && state.val) {
                                            adapter.log.debug(arrayChangeTrigger[i].shutterName + ' - shutter current state.val is:' + state.val);
                                        }
                                        adapter.log.debug(arrayChangeTrigger[i].shutterName + ' - shutter current Height is:' + arrayChangeTrigger[i].currentHeight);
                                        adapter.log.debug(arrayChangeTrigger[i].shutterName + ' - shutter trigger Height is:' + arrayChangeTrigger[i].triggerHeight);
                                        adapter.log.debug(arrayChangeTrigger[i].shutterName + ' - shutter trigger Action is:' + arrayChangeTrigger[i].triggerAction);
                                        adapter.log.debug(arrayChangeTrigger[i].shutterName + ' - shutter trigger Change is:' + arrayChangeTrigger[i].triggerChange);
                                        adapter.log.debug(arrayChangeTrigger[i].shutterName + ' - shutter trigger Action is:' + arrayChangeTrigger[i].triggerDrive);

                                        if (typeof state != undefined && state != null && arrayChangeTrigger[i].triggerHeight != null && arrayChangeTrigger[i].triggerAction != null && parseFloat(state.val) != arrayChangeTrigger[i].triggerHeight && parseFloat(state.val) == arrayChangeTrigger[i].triggerDrive && arrayChangeTrigger[i].currentHeight == arrayChangeTrigger[i].triggerDrive && arrayChangeTrigger[i].triggerChange != 'off') {
                                            if (arrayChangeTrigger[i].triggerAction == '') {
                                                adapter.log.debug('Waring! - not allowed empty values detected - close your window and initialize your shutters with button up! - triggerAction: ' + arrayChangeTrigger[i].triggerAction + ' at device: ' + arrayChangeTrigger[i].shutterName);
                                            }
                                            setTimeout(function () {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(arrayChangeTrigger[i].triggerID, (err, state) => {
                                                    if (typeof state != undefined && state != null) {
                                                        let currentValue = ('' + state.val);
                                                        let mustValue = ('' + arrayChangeTrigger[i].triggerState);
                                                        if (currentValue === mustValue) {
                                                            adapter.log.info('Window is still closed -> drive to last height: ' + arrayChangeTrigger[i].triggerHeight + '% for device: ' + arrayChangeTrigger[i].shutterName);
                                                            adapter.setForeignState(arrayChangeTrigger[i].name, parseFloat(shutterSettings[i].triggerHeight), false);
                                                            shutterSettings[i].currentHeight = shutterSettings[i].triggerHeight;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: arrayChangeTrigger[i].currentHeight, ack: true });
                                                            adapter.log.debug('save back trigger action: ' + arrayChangeTrigger[i].triggerAction + ' for device: ' + arrayChangeTrigger[i].shutterName);
                                                            shutterSettings[i].currentAction = shutterSettings[i].triggerAction;
                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].triggerAction, ack: true });
                                                            shutterState(arrayChangeTrigger[i].name, adapter, shutterSettings);
                                                            return (shutterSettings);
                                                        }
                                                    }
                                                });
                                            }, arrayChangeTrigger[i].trigDelyDown * 1000, i);

                                        } else if (typeof state != undefined && state != null && arrayChangeTrigger[i].triggerHeight != null && parseFloat(state.val) == arrayChangeTrigger[i].triggerHeight && arrayChangeTrigger[i].triggerChange != 'off') {
                                            if (arrayChangeTrigger[i].triggerAction == '') {
                                                adapter.log.debug('Waring! - not allowed empty values detected - close your window and initialize your shutters with button up! - triggerAction: ' + arrayChangeTrigger[i].triggerAction + ' at device: ' + arrayChangeTrigger[i].shutterName);
                                            }
                                            adapter.log.debug('shutter trigger released ' + arrayChangeTrigger[i].shutterName + ' already in place: ' + arrayChangeTrigger[i].triggerHeight + '%');
                                            shutterSettings[i].currentHeight = shutterSettings[i].triggerHeight;
                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                            adapter.log.debug('save back trigger action: ' + arrayChangeTrigger[i].triggerAction + ' for device ' + arrayChangeTrigger[i].shutterName);
                                            shutterSettings[i].currentAction = shutterSettings[i].triggerAction;
                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                            shutterState(arrayChangeTrigger[i].name, adapter, shutterSettings);
                                            return (shutterSettings);
                                        } else if (typeof state == undefined || state == null || arrayChangeTrigger[i].triggerHeight == null) {
                                            adapter.log.debug('Nothing sent - triggerHeight undefined!! triggerHeigth: ' + arrayChangeTrigger[i].triggerHeight);
                                        }

                                    });
                                }
                            }
                        });
                    }
                });
            }
            if (arrayChangeTrigger[i].triggerChange == 'off' && arrayChangeTrigger[i].autoDrive != 'off' && arrayChangeTrigger[i].driveAfterClose == true) {
                let nameDevice = arrayChangeTrigger[i].shutterName.replace(/[.;, ]/g, '_');
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
                        adapter.getForeignState(arrayChangeTrigger[i].triggerID, (err, state) => {

                            if (typeof state != undefined && state != null) {
                                let currentValue = ('' + state.val);
                                let mustValue = ('' + arrayChangeTrigger[i].triggerState);
                                if (currentValue === mustValue) {
                                    /**
                                     * @param {any} err
                                     * @param {{ val: any; }} state
                                     */
                                    adapter.getForeignState(arrayChangeTrigger[i].name, (err, state) => {
                                        if (state && state.val) {
                                            adapter.log.debug(arrayChangeTrigger[i].shutterName + ' - shutter current state.val is:' + state.val);
                                        }
                                        adapter.log.debug(arrayChangeTrigger[i].shutterName + ' - shutter trigger Height is:' + arrayChangeTrigger[i].triggerHeight);
                                        adapter.log.debug(arrayChangeTrigger[i].shutterName + ' - shutter height down is:' + arrayChangeTrigger[i].heightDown);

                                        if (typeof state != undefined && state != null && arrayChangeTrigger[i].triggerHeight != null && parseFloat(state.val) != arrayChangeTrigger[i].triggerHeight && parseFloat(state.val) != arrayChangeTrigger[i].heightDown) {
                                            if (arrayChangeTrigger[i].triggerAction == '') {
                                                adapter.log.debug('Waring! - not allowed empty values detected - close your window and initialize your shutters with button up! - triggerAction: ' + arrayChangeTrigger[i].triggerAction + ' at device: ' + arrayChangeTrigger[i].shutterName);
                                            }
                                            setTimeout(function () {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(arrayChangeTrigger[i].triggerID, (err, state) => {

                                                    if (typeof state != undefined && state != null) {
                                                        let currentValue = ('' + state.val);
                                                        let mustValue = ('' + arrayChangeTrigger[i].triggerState);
                                                        if (currentValue === mustValue) {
                                                            adapter.log.info('Window was closed -> change to last requested height: ' + arrayChangeTrigger[i].triggerHeight + '% for device ' + arrayChangeTrigger[i].shutterName);
                                                            adapter.setForeignState(arrayChangeTrigger[i].name, parseFloat(shutterSettings[i].triggerHeight), false);
                                                            shutterSettings[i].currentHeight = shutterSettings[i].triggerHeight;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                            adapter.log.debug('save back trigger action: ' + arrayChangeTrigger[i].triggerAction + ' for device ' + arrayChangeTrigger[i].shutterName);
                                                            shutterSettings[i].currentAction = shutterSettings[i].triggerAction;
                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].triggerAction, ack: true });
                                                            shutterState(arrayChangeTrigger[i].name, adapter, shutterSettings);
                                                            return (shutterSettings);
                                                        }
                                                    }
                                                });
                                            }, arrayChangeTrigger[i].trigDelyDown * 1000, i);

                                        } else if (typeof state != undefined && state != null && arrayChangeTrigger[i].triggerHeight != null && parseFloat(state.val) == arrayChangeTrigger[i].triggerHeight) {
                                            if (arrayChangeTrigger[i].triggerAction == '') {
                                                adapter.log.debug('Waring! - not allowed empty values detected - close your window and initialize your shutters with button up! - triggerAction: ' + arrayChangeTrigger[i].triggerAction + ' at device: ' + arrayChangeTrigger[i].shutterName);
                                            }
                                            adapter.log.debug('shutter trigger released ' + arrayChangeTrigger[i].shutterName + ' already in place: ' + arrayChangeTrigger[i].triggerHeight + '%');
                                            shutterSettings[i].currentHeight = shutterSettings[i].triggerHeight;
                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                            adapter.log.debug('save back trigger action: ' + arrayChangeTrigger[i].triggerAction + ' for device ' + arrayChangeTrigger[i].shutterName);
                                            shutterSettings[i].currentAction = shutterSettings[i].triggerAction;
                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                            shutterState(arrayChangeTrigger[i].name, adapter, shutterSettings);
                                            return (shutterSettings);
                                        } else if (typeof state == undefined || state == null || arrayChangeTrigger[i].triggerHeight == null) {
                                            adapter.log.debug('Nothing sent - triggerHeight undefined!! triggerHeigth: ' + arrayChangeTrigger[i].triggerHeight);
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
