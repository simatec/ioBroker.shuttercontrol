import { shutterState } from './shutterState';
import { setShutterState, setShutterInfo } from './setShutter';
import type { ShutterSettings } from './types';

/**
 * Reacts to a change of a window trigger state
 *
 * @param resTriggerChange object id of the changed trigger
 * @param adapter adapter instance
 * @param shutterSettings all shutter settings
 */
export async function triggerChange(resTriggerChange: string, adapter: ioBroker.Adapter, shutterSettings: ShutterSettings[]): Promise<ShutterSettings[] | undefined> {
    if (shutterSettings) {
        const arrayChangeTrigger = shutterSettings.filter((d) => d.triggerID == resTriggerChange); // Filter changed Trigger
        const result = arrayChangeTrigger.filter((d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

        for (let i = 0; i < result.length; i++) {
            for (let s = 0; s < shutterSettings.length; s++) {
                if (shutterSettings[s].shutterName == result[i].shutterName) {
                    if (shutterSettings[s].triggerChange == 'onlyUp' ||
                        shutterSettings[s].triggerChange == 'upDown' ||
                        (shutterSettings[s].triggerChange == 'off' && shutterSettings[s].driveAfterClose == true)) {

                        const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                        const _autoUpState = await adapter.getStateAsync(`shutters.autoUp.${nameDevice}`).catch((e) => adapter.log.warn(e));

                        if (shutterSettings[s]?.ignoreTriggerAutoState === true || _autoUpState?.val === true) {
                            const convertShutter = parseInt(String(shutterSettings[s].heightDown)) < parseInt(String(shutterSettings[s].heightUp)) ? false : true;
                            adapter.log.debug(`${shutterSettings[s].shutterName} - shutter conversion is: ${convertShutter}`);

                            const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;

                            const mustValue = (`${shutterSettings[s].triggerState}`);
                            const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? (`${shutterSettings[s].triggerState}`) : (`${shutterSettings[s].triggerStateTilted}`);
                            let currentValue = _triggerState?.val !== null && _triggerState?.val !== undefined ? (`${_triggerState.val}`) : '';

                            if (currentValue != mustValue) {
                                const setTriggerHeight = currentValue == mustValueTilted ? parseFloat(String(shutterSettings[s].triggerDriveTildet)) : parseFloat(String(shutterSettings[s].triggerDrive));

                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                if (_shutterState?.val !== null && _shutterState?.val !== undefined) {
                                    adapter.log.debug(`${shutterSettings[s].shutterName} - shutter current state.val is: ${Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound}%`);
                                }
                                adapter.log.debug(`${shutterSettings[s].shutterName} - shutter trigger drive-up is: ${setTriggerHeight}%`);
                                adapter.log.debug(`${shutterSettings[s].shutterName} - shutter trigger change is: ${shutterSettings[s].triggerChange}`);

                                if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != setTriggerHeight &&
                                    shutterSettings[s].triggerChange != 'off' &&
                                    ((parseFloat(String(shutterSettings[s].triggerDriveTildet)) == setTriggerHeight &&
                                        Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != setTriggerHeight &&
                                        shutterSettings[s].currentAction == 'triggered') ||
                                        (Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound < setTriggerHeight &&
                                            convertShutter == false) ||
                                        (Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound > setTriggerHeight &&
                                            convertShutter == true))) {

                                    await adapter.delay(shutterSettings[s].trigDelyUp ? Number(shutterSettings[s].trigDelyUp) * 1000 : 10);

                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentAction != 'triggered' ? Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound : shutterSettings[s].triggerHeight;
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction != 'triggered' ? shutterSettings[s].currentAction : shutterSettings[s].triggerAction;

                                    adapter.log.debug(`#1 save trigger height: ${shutterSettings[s].triggerHeight}% for device ${shutterSettings[s].shutterName}`);
                                    adapter.log.debug(`#1 save trigger action: ${shutterSettings[s].triggerAction} for device ${shutterSettings[s].shutterName}`);
                                    adapter.log.info(`#1 Set ID: ${shutterSettings[s].shutterName} value: ${setTriggerHeight}%`);

                                    const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;

                                    const mustValue = (`${shutterSettings[s].triggerState}`);
                                    currentValue = _triggerState?.val !== null && _triggerState?.val !== undefined ? (`${_triggerState.val}`) : '';

                                    if (currentValue != mustValue) {
                                        shutterSettings[s].currentHeight = setTriggerHeight;
                                        shutterSettings[s].currentAction = 'triggered';

                                        adapter.log.debug(`#1 current height: ${shutterSettings[s].currentHeight}% for device ${shutterSettings[s].shutterName}`);
                                        adapter.log.debug(`#1 current action: ${shutterSettings[s].currentAction} for device ${shutterSettings[s].shutterName}`);

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], setTriggerHeight, nameDevice, 'triggered #1')
                                            .catch((e) => adapter.log.warn(`#triggerChange 1: ${e}`));

                                        adapter.log.debug(`${shutterSettings[s].shutterName} - window is still open -> driving now to: ${setTriggerHeight}%`);
                                    }

                                } else if (_shutterState?.val !== null && _shutterState?.val !== undefined) {
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentAction != 'triggered' ? Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound : shutterSettings[s].triggerHeight;
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction != 'triggered' ? shutterSettings[s].currentAction : shutterSettings[s].triggerAction;

                                    adapter.log.debug(`#2 save trigger action: ${(shutterSettings[s].currentAction != 'triggered' ? shutterSettings[s].currentAction : shutterSettings[s].triggerAction)} for device: ${shutterSettings[s].shutterName}`);
                                    adapter.log.debug(`#2 save trigger height: ${shutterSettings[s].triggerHeight}% for device: ${shutterSettings[s].shutterName}`);

                                    await shutterState(shutterSettings[s].name, adapter, shutterSettings, false);
                                }
                            }
                        }
                    }
                    if (shutterSettings[s].triggerChange == 'onlyDown' ||
                        shutterSettings[s].triggerChange == 'upDown') {

                        const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                        const _autoDownState = await adapter.getStateAsync(`shutters.autoDown.${nameDevice}`).catch((e) => adapter.log.warn(e));

                        if (shutterSettings[s]?.ignoreTriggerAutoState === true || _autoDownState?.val === true) {
                            const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;

                            if (_triggerState?.val !== null && _triggerState?.val !== undefined) {
                                const currentValue = (`${_triggerState.val}`);
                                const mustValue = (`${shutterSettings[s].triggerState}`);

                                if (currentValue === mustValue) {
                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                    if (_shutterState?.val !== null && _shutterState?.val !== undefined) {
                                        adapter.log.debug(`${shutterSettings[s].shutterName} - shutter current state.val is: ${Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound}%`);
                                    }
                                    adapter.log.debug(`${shutterSettings[s].shutterName} - shutter current Height is: ${shutterSettings[s].currentHeight}%`);
                                    adapter.log.debug(`${shutterSettings[s].shutterName} - shutter trigger Height is: ${shutterSettings[s].triggerHeight}%`);
                                    adapter.log.debug(`${shutterSettings[s].shutterName} - shutter trigger Action is: ${shutterSettings[s].triggerAction}`);
                                    adapter.log.debug(`${shutterSettings[s].shutterName} - shutter trigger Change is: ${shutterSettings[s].triggerChange}`);

                                    if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                        shutterSettings[s].triggerHeight != null &&
                                        shutterSettings[s].triggerAction != null &&
                                        Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterSettings[s].triggerHeight &&
                                        Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == parseFloat(String(shutterSettings[s].currentHeight)) &&
                                        (shutterSettings[s].triggerChange) != 'off') {

                                        await adapter.delay(shutterSettings[s].trigDelyDown ? Number(shutterSettings[s].trigDelyDown) * 1000 : 10);

                                        if (shutterSettings[s].triggerAction == '') {
                                            adapter.log.debug(`Warning! - not allowed empty values detected - close your window and initialize your shutters with button up! - triggerAction: ${shutterSettings[s].triggerAction} at device: ${shutterSettings[s].shutterName}`);
                                        }
                                        const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;

                                        if (_triggerState?.val !== null && _triggerState?.val !== undefined) {
                                            const currentValue = (`${_triggerState.val}`);
                                            const mustValue = (`${shutterSettings[s].triggerState}`);

                                            if (currentValue === mustValue) {
                                                shutterSettings[s].currentHeight = shutterSettings[s].triggerHeight;
                                                shutterSettings[s].currentAction = shutterSettings[s].triggerAction;

                                                await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(shutterSettings[s].triggerHeight)), nameDevice, 'Window is still closed -> drive to last height:')
                                                    .catch((e) => adapter.log.warn(`#triggerChange 2: ${e}`));

                                                adapter.log.debug(`save back trigger action: ${shutterSettings[s].triggerAction} for device: ${shutterSettings[s].shutterName}`);
                                            }
                                        }

                                    } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                        shutterSettings[s].triggerHeight != null &&
                                        Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterSettings[s].triggerHeight &&
                                        (shutterSettings[s].triggerChange) != 'off') {

                                        if (shutterSettings[s].triggerAction == '') {
                                            adapter.log.debug(`Warning! - not allowed empty values detected - close your window and initialize your shutters with button up! - triggerAction: ${shutterSettings[s].triggerAction} at device: ${shutterSettings[s].shutterName}`);
                                        }
                                        shutterSettings[s].currentHeight = shutterSettings[s].triggerHeight;
                                        shutterSettings[s].currentAction = shutterSettings[s].triggerAction;

                                        await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                        adapter.log.debug(`#1 shutter trigger released ${shutterSettings[s].shutterName} already in place: ${shutterSettings[s].triggerHeight}%`);
                                        adapter.log.debug(`save back trigger action: ${shutterSettings[s].triggerAction} for device ${shutterSettings[s].shutterName}`);
                                    } else if (!_shutterState?.val !== null && _shutterState?.val !== undefined || shutterSettings[s].triggerHeight == null) {
                                        adapter.log.debug(`Nothing sent - triggerHeight undefined!! triggerHeigth: ${shutterSettings[s].triggerHeight}%`);
                                    }
                                }
                            }
                        }
                    }
                    if (shutterSettings[s].triggerChange == 'off' &&
                        shutterSettings[s].driveAfterClose == true) {

                        const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                        const _autoDownState = await adapter.getStateAsync(`shutters.autoDown.${nameDevice}`).catch((e) => adapter.log.warn(e));

                        if (shutterSettings[s]?.ignoreTriggerAutoState === true || _autoDownState?.val === true) {
                            const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;

                            if (_triggerState?.val !== null && _triggerState?.val !== undefined) {
                                const currentValue = (`${_triggerState.val}`);
                                const mustValue = (`${shutterSettings[s].triggerState}`);
                                const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? (`${shutterSettings[s].triggerState}`) : (`${shutterSettings[s].triggerStateTilted}`);

                                if (currentValue === mustValue ||
                                    currentValue === mustValueTilted) {

                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));
                                    if (_shutterState?.val !== null && _shutterState?.val !== undefined) {
                                        adapter.log.debug(`${shutterSettings[s].shutterName} - shutter current state.val is: ${Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound}%`);
                                    }
                                    adapter.log.debug(`${shutterSettings[s].shutterName} - shutter trigger Height is: ${shutterSettings[s].triggerHeight}%`);
                                    adapter.log.debug(`${shutterSettings[s].shutterName} - shutter height down is: ${shutterSettings[s].heightDown}%`);

                                    if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                        shutterSettings[s].triggerHeight != null &&
                                        Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterSettings[s].triggerHeight &&
                                        Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterSettings[s].heightDown) {

                                        await adapter.delay(shutterSettings[s].trigDelyDown ? Number(shutterSettings[s].trigDelyDown) * 1000 : 10);

                                        if (shutterSettings[s].triggerAction == '') {
                                            adapter.log.debug(`Warning! - not allowed empty values detected - close your window and initialize your shutters with button up! - triggerAction: ${shutterSettings[s].triggerAction} at device: ${shutterSettings[s].shutterName}`);
                                        }

                                        const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;

                                        if (_triggerState?.val !== null && _triggerState?.val !== undefined) {
                                            const currentValue = (`${_triggerState.val}`);
                                            const mustValue = (`${shutterSettings[s].triggerState}`);

                                            if (currentValue === mustValue) {
                                                shutterSettings[s].currentHeight = shutterSettings[s].triggerHeight;
                                                shutterSettings[s].currentAction = shutterSettings[s].triggerAction;

                                                await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(shutterSettings[s].triggerHeight)), nameDevice, 'Window was closed -> change to last requested height:')
                                                    .catch((e) => adapter.log.warn(`#triggerChange 2: ${e}`));

                                                adapter.log.debug(`save back trigger action: ${shutterSettings[s].triggerAction} for device ${shutterSettings[s].shutterName}`);
                                            }
                                        }
                                    } else if (_shutterState?.val !== null && _shutterState?.val !== undefined && shutterSettings[s].triggerHeight != null &&
                                        Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterSettings[s].triggerHeight) {

                                        if (shutterSettings[s].triggerAction == '') {
                                            adapter.log.debug(`Warning! - not allowed empty values detected - close your window and initialize your shutters with button up! - triggerAction: ${shutterSettings[s].triggerAction} at device: ${shutterSettings[s].shutterName}`);
                                        }
                                        shutterSettings[s].currentHeight = shutterSettings[s].triggerHeight;
                                        shutterSettings[s].currentAction = shutterSettings[s].triggerAction;

                                        await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                        adapter.log.debug(`#2 shutter trigger released ${shutterSettings[s].shutterName} already in place: ${shutterSettings[s].triggerHeight}%`);
                                        adapter.log.debug(`save back trigger action: ${shutterSettings[s].triggerAction} for device ${shutterSettings[s].shutterName}`);
                                    } else if (!_shutterState?.val !== null && _shutterState?.val !== undefined || shutterSettings[s].triggerHeight == null) {
                                        adapter.log.debug(`Nothing sent - triggerHeight undefined!! triggerHeigth: ${shutterSettings[s].triggerHeight}%`);
                                    }
                                }
                            }
                        }
                    }
                    await adapter.delay(1000);
                }
            }
        }
        return (shutterSettings);
    }
}

