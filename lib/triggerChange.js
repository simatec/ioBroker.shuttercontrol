'use strict';

const shutterState = require('./shutterState.js');         // shutterState

function triggerChange(resTriggerChange, adapter) {

    const resultID = adapter.config.events;
    // Filter changed Trigger
    const /**
         * @param {{ triggerID: any; }} d
         */
        arrayChangeTrigger = resultID.filter(d => d.triggerID == resTriggerChange);

    for (const i in arrayChangeTrigger) {
        setTimeout(function () {
            if (arrayChangeTrigger[i].triggerChange == 'onlyUp' || arrayChangeTrigger[i].triggerChange == 'upDown') {
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
                        } else if (parseInt(arrayChangeTrigger[i].heightDown) > parseInt(arrayChangeTrigger[i].heightUp)) {
                            convertShutter = true;
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
                                    //if (typeof state != undefined && state != null && state.val != arrayChangeTrigger[i].triggerDrive && state.val < arrayChangeTrigger[i].triggerDrive) {
                                    if (typeof state != undefined && state != null && state.val != arrayChangeTrigger[i].triggerDrive && ((state.val < arrayChangeTrigger[i].triggerDrive && convertShutter == false) || (state.val > arrayChangeTrigger[i].triggerDrive && convertShutter == true))) {
                                        arrayChangeTrigger[i].triggerHeight = (state.val);
                                        adapter.log.debug('save trigger height: ' + arrayChangeTrigger[i].triggerHeight + '%');
                                        adapter.log.info('#1 Set ID: ' + arrayChangeTrigger[i].shutterName + ' value: ' + arrayChangeTrigger[i].triggerDrive + '%');
                                        adapter.setForeignState(arrayChangeTrigger[i].name, parseFloat(arrayChangeTrigger[i].triggerDrive), false);
                                        arrayChangeTrigger[i].currentHeight = arrayChangeTrigger[i].triggerDrive;
                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: arrayChangeTrigger[i].currentHeight, ack: true });
                                        shutterState(arrayChangeTrigger[i].name, adapter);
                                    } else {
                                        arrayChangeTrigger[i].triggerHeight = (state.val);
                                        adapter.log.debug('save trigger height: ' + arrayChangeTrigger[i].triggerHeight + '%');
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
                                        if (typeof state != undefined && state != null && state.val != arrayChangeTrigger[i].triggerHeight && state.val == arrayChangeTrigger[i].triggerDrive && arrayChangeTrigger[i].currentHeight == arrayChangeTrigger[i].triggerDrive) {
                                            adapter.log.debug('change to last height: ' + arrayChangeTrigger[i].triggerHeight + '%');
                                            adapter.log.info('#2 Set ID: ' + arrayChangeTrigger[i].shutterName + ' value: ' + arrayChangeTrigger[i].triggerHeight + '%');
                                            adapter.setForeignState(arrayChangeTrigger[i].name, parseFloat(arrayChangeTrigger[i].triggerHeight), false);
                                            arrayChangeTrigger[i].currentHeight = arrayChangeTrigger[i].triggerHeight;
                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: arrayChangeTrigger[i].currentHeight, ack: true });
                                            shutterState(arrayChangeTrigger[i].name, adapter);
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
