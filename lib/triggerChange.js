'use strict';

const shutterState = require('./shutterState.js');                                  // shutterState
const setShutterState = require('./setShutter.js').setShutterState;                 // set Shutter State
const setShutterInfo = require('./setShutter.js').setShutterInfo;                   // set Shutter State

let timerSleep = 0;

async function sleep(ms) {
    return new Promise(async (resolve) => {
        // @ts-ignore
        timerSleep = setTimeout(async () => resolve(), ms);
    });
}

async function triggerChange(resTriggerChange, adapter, shutterSettings) {
    if (shutterSettings) {
        const arrayChangeTrigger = shutterSettings.filter((/** @type {{ triggerID: any; }} */ d) => d.triggerID == resTriggerChange); // Filter changed Trigger

        for (const i in arrayChangeTrigger) {
            for (const s in shutterSettings) {
                if (shutterSettings[s].shutterName == arrayChangeTrigger[i].shutterName) {
                    if (shutterSettings[s].triggerChange == 'onlyUp' || shutterSettings[s].triggerChange == 'upDown' || (shutterSettings[s].triggerChange == 'off' && shutterSettings[s].driveAfterClose == true)) {
                        const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                        const _autoUpState = await adapter.getStateAsync(`shutters.autoUp.${nameDevice}`).catch((e) => adapter.log.warn(e));

                        if (_autoUpState && _autoUpState === true || _autoUpState && _autoUpState.val === true) {
                            let convertShutter = false;

                            if (parseInt(shutterSettings[s].heightDown) < parseInt(shutterSettings[s].heightUp)) {
                                convertShutter = false;
                                adapter.log.debug(shutterSettings[s].shutterName + ' - shutter conversion is:' + convertShutter);
                            } else if (parseInt(shutterSettings[s].heightDown) > parseInt(shutterSettings[s].heightUp)) {
                                convertShutter = true;
                                adapter.log.debug(shutterSettings[s].shutterName + ' - shutter conversion is:' + convertShutter);
                            }

                            let currentValue = '';

                            const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;

                            const mustValue = ('' + shutterSettings[s].triggerState);
                            const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                            if (typeof _triggerState != undefined && _triggerState != null) {
                                currentValue = ('' + _triggerState.val);
                            }
                            if (currentValue != mustValue) {
                                const setTriggerHeight = currentValue == mustValueTilted ? parseFloat(shutterSettings[s].triggerDriveTildet) : parseFloat(shutterSettings[s].triggerDrive);

                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                if (_shutterState && _shutterState.val) {
                                    adapter.log.debug(shutterSettings[s].shutterName + ' - shutter current state.val is:' +  Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound);
                                }
                                adapter.log.debug(shutterSettings[s].shutterName + ' - shutter trigger drive-up is:' + setTriggerHeight);
                                adapter.log.debug(shutterSettings[s].shutterName + ' - shutter trigger change is:' + shutterSettings[s].triggerChange);

                                if (typeof _shutterState != undefined && _shutterState != null &&  Math.round(parseFloat(_shutterState.val) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != setTriggerHeight && shutterSettings[s].triggerChange != 'off' && ((parseFloat(shutterSettings[s].triggerDriveTildet) == setTriggerHeight &&  Math.round(parseFloat(_shutterState.val) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != setTriggerHeight && shutterSettings[s].currentAction == 'triggered') || ( Math.round(parseFloat(_shutterState.val) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound < setTriggerHeight && convertShutter == false) || ( Math.round(parseFloat(_shutterState.val) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound > setTriggerHeight && convertShutter == true))) {
                                    await sleep(shutterSettings[s].trigDelyUp ? shutterSettings[s].trigDelyUp * 1000 : 10);

                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentAction != 'triggered' ?  Math.round(parseFloat(_shutterState.val) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound : shutterSettings[s].triggerHeight;
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction != 'triggered' ? shutterSettings[s].currentAction : shutterSettings[s].triggerAction;

                                    adapter.log.debug('#1 save trigger height: ' + shutterSettings[s].triggerHeight + '% for device ' + shutterSettings[s].shutterName);
                                    adapter.log.debug('#1 save trigger action: ' + shutterSettings[s].triggerAction + ' for device ' + shutterSettings[s].shutterName);
                                    adapter.log.info('#1 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + setTriggerHeight + '%');

                                    const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;

                                    const mustValue = ('' + shutterSettings[s].triggerState);
                                    if (typeof _triggerState != undefined && _triggerState != null) {
                                        currentValue = ('' + _triggerState.val);
                                    }

                                    if (currentValue != mustValue) {
                                        shutterSettings[s].currentHeight = setTriggerHeight;
                                        shutterSettings[s].currentAction = 'triggered';

                                        adapter.log.debug('#1 current height: ' + shutterSettings[s].currentHeight + '% for device ' + shutterSettings[s].shutterName);
                                        adapter.log.debug('#1 current action: ' + shutterSettings[s].currentAction + ' for device ' + shutterSettings[s].shutterName);

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], setTriggerHeight, nameDevice, 'triggered #1')
                                            .catch((e) => adapter.log.warn(`#triggerChange 1: ${e}`));

                                        adapter.log.debug(shutterSettings[s].shutterName + ' - window is still open -> driving now to :' + setTriggerHeight);
                                    }

                                } else if (typeof _shutterState != undefined && _shutterState != null) {
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentAction != 'triggered' ?  Math.round(parseFloat(_shutterState.val) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound : shutterSettings[s].triggerHeight;
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction != 'triggered' ? shutterSettings[s].currentAction : shutterSettings[s].triggerAction;

                                    adapter.log.debug('#2 save trigger action: ' + (shutterSettings[s].currentAction != 'triggered' ? shutterSettings[s].currentAction : shutterSettings[s].triggerAction) + ' for device: ' + shutterSettings[s].shutterName);
                                    adapter.log.debug('#2 save trigger height: ' + shutterSettings[s].triggerHeight + '% for device: ' + shutterSettings[s].shutterName);

                                    await shutterState(shutterSettings[s].name, adapter, shutterSettings, false);
                                }
                            }
                        }
                    }
                    if (shutterSettings[s].triggerChange == 'onlyDown' || shutterSettings[s].triggerChange == 'upDown') {
                        const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                        const _autoDownState = await adapter.getStateAsync(`shutters.autoDown.${nameDevice}`).catch((e) => adapter.log.warn(e));

                        if (_autoDownState && _autoDownState === true || _autoDownState && _autoDownState.val === true) {
                            const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;

                            if (typeof _triggerState != undefined && _triggerState != null) {
                                let currentValue = ('' + _triggerState.val);

                                const mustValue = ('' + shutterSettings[s].triggerState);
                                //const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                if (currentValue === mustValue) {
                                    //const setTriggerHeight = currentValue == mustValueTilted ? parseFloat(shutterSettings[s].triggerDriveTildet) : parseFloat(shutterSettings[s].triggerDrive);
                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                    if (_shutterState && _shutterState.val) {
                                        adapter.log.debug(shutterSettings[s].shutterName + ' - shutter current state.val is:' +  Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound);
                                    }
                                    adapter.log.debug(shutterSettings[s].shutterName + ' - shutter current Height is:' + shutterSettings[s].currentHeight);
                                    adapter.log.debug(shutterSettings[s].shutterName + ' - shutter trigger Height is:' + shutterSettings[s].triggerHeight);
                                    adapter.log.debug(shutterSettings[s].shutterName + ' - shutter trigger Action is:' + shutterSettings[s].triggerAction);
                                    adapter.log.debug(shutterSettings[s].shutterName + ' - shutter trigger Change is:' + shutterSettings[s].triggerChange);

                                    if (typeof _shutterState != undefined && _shutterState != null && shutterSettings[s].triggerHeight != null && shutterSettings[s].triggerAction != null &&  Math.round(parseFloat(_shutterState.val) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterSettings[s].triggerHeight &&  Math.round(parseFloat(_shutterState.val) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].triggerChange != 'off') {
                                        await sleep(shutterSettings[s].trigDelyDown ? shutterSettings[s].trigDelyDown * 1000 : 10);

                                        if (shutterSettings[s].triggerAction == '') {
                                            adapter.log.debug('Warning! - not allowed empty values detected - close your window and initialize your shutters with button up! - triggerAction: ' + shutterSettings[s].triggerAction + ' at device: ' + shutterSettings[s].shutterName);
                                        }
                                        const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;

                                        if (typeof _triggerState != undefined && _triggerState != null) {
                                            const currentValue = ('' + _triggerState.val);
                                            const mustValue = ('' + shutterSettings[s].triggerState);
                                            //const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                            if (currentValue === mustValue) {
                                                shutterSettings[s].currentHeight = shutterSettings[s].triggerHeight;
                                                shutterSettings[s].currentAction = shutterSettings[s].triggerAction;

                                                await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].triggerHeight), nameDevice, 'Window is still closed -> drive to last height:')
                                                    .catch((e) => adapter.log.warn(`#triggerChange 2: ${e}`));

                                                adapter.log.debug('save back trigger action: ' + shutterSettings[s].triggerAction + ' for device: ' + shutterSettings[s].shutterName);
                                            }
                                        }

                                    } else if (typeof _shutterState != undefined && _shutterState != null && shutterSettings[s].triggerHeight != null &&  Math.round(parseFloat(_shutterState.val) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterSettings[s].triggerHeight && shutterSettings[s].triggerChange != 'off') {
                                        if (shutterSettings[s].triggerAction == '') {
                                            adapter.log.debug('Warning! - not allowed empty values detected - close your window and initialize your shutters with button up! - triggerAction: ' + shutterSettings[s].triggerAction + ' at device: ' + shutterSettings[s].shutterName);
                                        }
                                        shutterSettings[s].currentHeight = shutterSettings[s].triggerHeight;
                                        shutterSettings[s].currentAction = shutterSettings[s].triggerAction;

                                        await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                        adapter.log.debug('#1 shutter trigger released ' + shutterSettings[s].shutterName + ' already in place: ' + shutterSettings[s].triggerHeight + '%');
                                        adapter.log.debug('save back trigger action: ' + shutterSettings[s].triggerAction + ' for device ' + shutterSettings[s].shutterName);
                                    } else if (typeof _shutterState == undefined || _shutterState == null || shutterSettings[s].triggerHeight == null) {
                                        adapter.log.debug('Nothing sent - triggerHeight undefined!! triggerHeigth: ' + shutterSettings[s].triggerHeight);
                                    }
                                }
                            }
                        }
                    }
                    if (shutterSettings[s].triggerChange == 'off' && shutterSettings[s].driveAfterClose == true) {
                        const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                        const _autoDownState = await adapter.getStateAsync(`shutters.autoDown.${nameDevice}`).catch((e) => adapter.log.warn(e));

                        if (_autoDownState && _autoDownState === true || _autoDownState && _autoDownState.val === true) {
                            const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;

                            if (typeof _triggerState != undefined && _triggerState != null) {
                                const currentValue = ('' + _triggerState.val);
                                const mustValue = ('' + shutterSettings[s].triggerState);
                                const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                if (currentValue === mustValue || currentValue === mustValueTilted) {
                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));
                                    if (_shutterState && _shutterState.val) {
                                        adapter.log.debug(shutterSettings[s].shutterName + ' - shutter current state.val is:' +  Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound);
                                    }
                                    adapter.log.debug(shutterSettings[s].shutterName + ' - shutter trigger Height is:' + shutterSettings[s].triggerHeight);
                                    adapter.log.debug(shutterSettings[s].shutterName + ' - shutter height down is:' + shutterSettings[s].heightDown);

                                    if (typeof _shutterState != undefined && _shutterState != null && shutterSettings[s].triggerHeight != null &&  Math.round(parseFloat(_shutterState.val) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterSettings[s].triggerHeight &&  Math.round(parseFloat(_shutterState.val) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterSettings[s].heightDown) {
                                        await sleep(shutterSettings[s].trigDelyDown ? shutterSettings[s].trigDelyDown * 1000 : 10);

                                        if (shutterSettings[s].triggerAction == '') {
                                            adapter.log.debug('Warning! - not allowed empty values detected - close your window and initialize your shutters with button up! - triggerAction: ' + shutterSettings[s].triggerAction + ' at device: ' + shutterSettings[s].shutterName);
                                        }

                                        const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;

                                        if (typeof _triggerState != undefined && _triggerState != null) {
                                            const currentValue = ('' + _triggerState.val);
                                            const mustValue = ('' + shutterSettings[s].triggerState);
                                            //const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                            if (currentValue === mustValue) {
                                                shutterSettings[s].currentHeight = shutterSettings[s].triggerHeight;
                                                shutterSettings[s].currentAction = shutterSettings[s].triggerAction;

                                                await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].triggerHeight), nameDevice, 'Window was closed -> change to last requested height:')
                                                    .catch((e) => adapter.log.warn(`#triggerChange 2: ${e}`));

                                                adapter.log.debug('save back trigger action: ' + shutterSettings[s].triggerAction + ' for device ' + shutterSettings[s].shutterName);
                                            }
                                        }
                                    } else if (typeof _shutterState != undefined && _shutterState != null && shutterSettings[s].triggerHeight != null &&  Math.round(parseFloat(_shutterState.val) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterSettings[s].triggerHeight) {
                                        if (shutterSettings[s].triggerAction == '') {
                                            adapter.log.debug('Warning! - not allowed empty values detected - close your window and initialize your shutters with button up! - triggerAction: ' + shutterSettings[s].triggerAction + ' at device: ' + shutterSettings[s].shutterName);
                                        }
                                        shutterSettings[s].currentHeight = shutterSettings[s].triggerHeight;
                                        shutterSettings[s].currentAction = shutterSettings[s].triggerAction;

                                        await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                        adapter.log.debug('#2 shutter trigger released ' + shutterSettings[s].shutterName + ' already in place: ' + shutterSettings[s].triggerHeight + '%');
                                        adapter.log.debug('save back trigger action: ' + shutterSettings[s].triggerAction + ' for device ' + shutterSettings[s].shutterName);
                                    } else if (typeof _shutterState == undefined || _shutterState == null || shutterSettings[s].triggerHeight == null) {
                                        adapter.log.debug('Nothing sent - triggerHeight undefined!! triggerHeigth: ' + shutterSettings[s].triggerHeight);
                                    }
                                }
                            }
                        }
                    }
                    await sleep(1000);
                }
            }
        }
        clearTimeout(timerSleep);
        return (shutterSettings);
    }
}

module.exports = triggerChange;
