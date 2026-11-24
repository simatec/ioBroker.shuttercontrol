import { setShutterState, setShutterInfo } from './setShutter'; // set Shutter State
import type { ShutterSettings } from './types';

/**
 * Drives the shutters of the given alarm type to the alarm level, or back to the saved position
 * when the alarm has ended.
 *
 * @param adapter adapter instance
 * @param alarmType 'alarmWind1', 'alarmWind2', 'alarmRain', 'alarmFrost' or 'alarmFire'
 * @param shutterSettings settings of all shutters
 * @returns the shutter settings
 */
export async function shutterAlarm(
    adapter: ioBroker.Adapter,
    alarmType: string,
    shutterSettings: ShutterSettings[],
): Promise<ShutterSettings[] | undefined> {
    adapter.log.debug('start shutterAlarm');

    const alarmWind1Level = adapter.config.alarmWind1Level;
    const alarmWind2Level = adapter.config.alarmWind2Level;
    const alarmRainLevel = adapter.config.alarmRainLevel;
    const alarmFrostLevel = adapter.config.alarmFrostLevel;
    const alarmFireLevel = adapter.config.alarmFireLevel;
    const driveDelayUpAstro = adapter.config.driveDelayUpAstro != 0 ? adapter.config.driveDelayUpAstro * 1000 : 20;
    let resAlarm: ShutterSettings[] | undefined; // Filter Area

    if (shutterSettings) {
        switch (alarmType) {
            case 'alarmWind1':
                resAlarm = shutterSettings.filter((d) => d.enableAlarmWind1 == true);
                break;
            case 'alarmWind2':
                resAlarm = shutterSettings.filter((d) => d.enableAlarmWind2 == true);
                break;
            case 'alarmRain':
                resAlarm = shutterSettings.filter((d) => d.enableAlarmRain == true);
                break;
            case 'alarmFrost':
                resAlarm = shutterSettings.filter((d) => d.enableAlarmFrost == true);
                break;
            case 'alarmFire':
                resAlarm = shutterSettings.filter((d) => d.enableAlarmFire == true);
                break;

        }

        const result = (resAlarm as ShutterSettings[]).filter((d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

        for (const i of result) {
            for (let s = 0; s < shutterSettings.length; s++) {
                if (shutterSettings[s].shutterName == i.shutterName) {
                    const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                    let convertShutter = false;

                    if (parseFloat(String(shutterSettings[s].heightDown)) < parseFloat(String(shutterSettings[s].heightUp))) {
                        convertShutter = false;
                    } else if (parseFloat(String(shutterSettings[s].heightDown)) > parseFloat(String(shutterSettings[s].heightUp))) {
                        convertShutter = true;
                    }

                    const pendingAlarm = await checkPendingAlarm(adapter, shutterSettings[s]);

                    const _alarmWind1 = adapter.config.alarmWind1 != '' ? await adapter.getForeignStateAsync(adapter.config.alarmWind1).catch((e) => adapter.log.warn(e)) : null;
                    const statusAlarmWind1 = _alarmWind1?.val !== null && _alarmWind1?.val !== undefined ? _alarmWind1.val : false;

                    const _alarmWind2 = adapter.config.alarmWind2 != '' ? await adapter.getForeignStateAsync(adapter.config.alarmWind2).catch((e) => adapter.log.warn(e)) : null;
                    const statusAlarmWind2 = _alarmWind2?.val !== null && _alarmWind2?.val !== undefined ? _alarmWind2.val : false;

                    const _alarmRain = adapter.config.alarmRain != '' ? await adapter.getForeignStateAsync(adapter.config.alarmRain).catch((e) => adapter.log.warn(e)) : null;
                    const statusAlarmRain = _alarmRain?.val !== null && _alarmRain?.val !== undefined ? _alarmRain.val : false;

                    const _alarmFrost = adapter.config.alarmFrost != '' ? await adapter.getForeignStateAsync(adapter.config.alarmFrost).catch((e) => adapter.log.warn(e)) : null;
                    const statusAlarmFrost = _alarmFrost?.val !== null && _alarmFrost?.val !== undefined ? _alarmFrost.val : false;

                    const _alarmFire = adapter.config.alarmFire != '' ? await adapter.getForeignStateAsync(adapter.config.alarmFire).catch((e) => adapter.log.warn(e)) : null;
                    const statusAlarmFire = _alarmFire?.val !== null && _alarmFire?.val !== undefined ? _alarmFire.val : false;

                    const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;
                    const currentValue = _triggerState?.val !== null && _triggerState?.val !== undefined ? (`${_triggerState.val}`) : '';

                    const mustValue = shutterSettings[s].triggerState ? (`${shutterSettings[s].triggerState}`) : '';
                    const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? (`${shutterSettings[s].triggerState}`) : shutterSettings[s].triggerStateTilted ? (`${shutterSettings[s].triggerStateTilted}`) : '';

                    switch (alarmType) {
                        // +++++++++++++++++ Alarm Wind 1  +++++++++++++++
                        case 'alarmWind1':
                            if (statusAlarmWind1) {
                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name)
                                    .catch((e) => adapter.log.warn(e));

                                if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != parseFloat(String(alarmWind1Level)) &&
                                    statusAlarmFire == false) {

                                    if (statusAlarmWind2 == false &&
                                        statusAlarmRain == false &&
                                        statusAlarmFrost == false &&
                                        statusAlarmFire == false) {

                                        if (currentValue != '' &&
                                            currentValue != mustValue &&
                                            currentValue != mustValueTilted &&
                                            shutterSettings[s].driveAfterClose == true) {

                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                        } else {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                        }
                                    }
                                    shutterSettings[s].currentHeight = parseFloat(String(alarmWind1Level));
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                    shutterSettings[s].currentAction = 'wind1';
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(alarmWind1Level)), nameDevice, 'Alarm #100');

                                    adapter.log.debug(`shutter alarm wind 1 ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].currentHeight}%`);
                                } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == parseFloat(String(alarmWind1Level)) &&
                                    statusAlarmFire == false) {

                                    if ((statusAlarmWind2 == false &&
                                        statusAlarmRain == false &&
                                        statusAlarmFrost == false &&
                                        statusAlarmFire == false)) {

                                        if (currentValue != '' &&
                                            currentValue != mustValue &&
                                            currentValue != mustValueTilted &&
                                            shutterSettings[s].driveAfterClose == true) {

                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                        } else {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                        }
                                    }
                                    shutterSettings[s].currentHeight = parseFloat(String(alarmWind1Level));
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                    shutterSettings[s].currentAction = 'wind1';
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                    adapter.log.debug(`shutter alarm wind 1 ${shutterSettings[s].shutterName} already at: ${shutterSettings[s].currentHeight}% - setting current action: ${shutterSettings[s].currentAction}`);
                                }
                            } else if (!statusAlarmWind1) {
                                if (pendingAlarm == false && statusAlarmFrost == false) {
                                    if (!hasAlarmTriggerLevel(shutterSettings[s])) {
                                        // no position was saved before the alarm (e.g. shutter added while the alarm was active) - nothing to drive back to
                                        adapter.log.debug(`Alarm Wind 1 ended for ${shutterSettings[s].shutterName}: no saved position - shutter stays where it is`);
                                    } else if (currentValue === mustValue ||
                                        currentValue === mustValueTilted ||
                                        shutterSettings[s].triggerID == '') {

                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name)
                                            .catch((e) => adapter.log.warn(e));

                                        if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != parseFloat(String(shutterSettings[s].alarmTriggerLevel))) {

                                            shutterSettings[s].currentHeight = parseFloat(String(shutterSettings[s].alarmTriggerLevel));
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                            shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(shutterSettings[s].alarmTriggerLevel)), nameDevice, 'Alarm Wind 1 ended');

                                            adapter.log.debug(`shutter alarm wind 1 endet and no other alarm is pending ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].currentHeight}%`);
                                        } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == parseFloat(String(shutterSettings[s].alarmTriggerLevel))) {

                                            shutterSettings[s].currentHeight = parseFloat(String(shutterSettings[s].alarmTriggerLevel));
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                            shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                            adapter.log.debug(`shutter alarm wind 1 endet and no other alarm is pending ${shutterSettings[s].shutterName} already at: ${shutterSettings[s].currentHeight}% - setting current action: ${shutterSettings[s].currentAction}`);
                                        }
                                    } else if (currentValue != '' &&
                                        currentValue != mustValue &&
                                        currentValue != mustValueTilted &&
                                        shutterSettings[s].driveAfterClose == true) {

                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name)
                                            .catch((e) => adapter.log.warn(e));

                                        if (_shutterState?.val !== null && _shutterState?.val !== undefined) {
                                            shutterSettings[s].triggerHeight = parseFloat(String(shutterSettings[s].alarmTriggerLevel));
                                            shutterSettings[s].triggerAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].currentHeight = shutterSettings[s].triggerDrive;
                                            shutterSettings[s].currentAction = 'triggered';

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(shutterSettings[s].currentHeight)), nameDevice, '#Shutter alarm wind1 end');

                                            adapter.log.debug(`save new trigger action: ${shutterSettings[s].triggerAction}`);
                                            adapter.log.debug(`save new trigger height: ${shutterSettings[s].triggerHeight}%`);
                                        }
                                    }
                                } else {
                                    adapter.log.info(`Alarm Wind 1 endet for ID: ${shutterSettings[s].shutterName} driving to next highest alarm priority`);

                                    if (statusAlarmFire == false) {
                                        if (statusAlarmFrost == true) {
                                            if (shutterSettings[s].alarmTriggerAction == 'down') {
                                                shutterSettings[s].currentAction = 'frost';
                                                shutterSettings[s].currentHeight = alarmFrostLevel;
                                            } else {
                                                shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                                shutterSettings[s].currentHeight = shutterSettings[s].alarmTriggerLevel;
                                            }
                                        }
                                        if (statusAlarmWind2 == true) {
                                            shutterSettings[s].currentHeight = alarmWind2Level;
                                            shutterSettings[s].currentAction = 'wind2';
                                        }
                                        if (statusAlarmRain == true) {
                                            shutterSettings[s].currentHeight = alarmRainLevel;
                                            shutterSettings[s].currentAction = 'rain';
                                        }

                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(shutterSettings[s].currentHeight)), nameDevice, '#Shutter alarm wind1 end');

                                        adapter.log.debug(`shutter alarm ${shutterSettings[s].currentAction} ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].currentHeight}%`);
                                    }
                                }
                            }
                            await adapter.delay(driveDelayUpAstro);
                            break;

                        // +++++++++++++++++ Alarm Wind 2  +++++++++++++++
                        case 'alarmWind2':
                            if (statusAlarmWind2) {
                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name)
                                    .catch((e) => adapter.log.warn(e));

                                if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != parseFloat(String(alarmWind2Level)) &&
                                    statusAlarmFire == false) {

                                    if (statusAlarmWind1 == false &&
                                        statusAlarmRain == false &&
                                        statusAlarmFrost == false &&
                                        statusAlarmFire == false) {

                                        if (currentValue != '' &&
                                            currentValue != mustValue &&
                                            currentValue != mustValueTilted &&
                                            shutterSettings[s].driveAfterClose == true) {

                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                        } else {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                        }
                                    }
                                    shutterSettings[s].currentHeight = parseFloat(String(alarmWind2Level));
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                    shutterSettings[s].currentAction = 'wind2';
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(alarmWind2Level)), nameDevice, '#Shutter alarm wind2');

                                    adapter.log.debug(`shutter alarm wind 2 ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].currentHeight}%`);
                                } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == parseFloat(String(alarmWind2Level))) {

                                    if (statusAlarmRain == false &&
                                        statusAlarmFrost == false &&
                                        statusAlarmFire == false) {

                                        if (currentValue != '' &&
                                            currentValue != mustValue &&
                                            currentValue != mustValueTilted &&
                                            shutterSettings[s].driveAfterClose == true) {

                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                        } else {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                        }
                                    }
                                    shutterSettings[s].currentHeight = parseFloat(String(alarmWind2Level));
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                    shutterSettings[s].currentAction = 'wind2';
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                    adapter.log.debug(`shutter alarm wind 2 ${shutterSettings[s].shutterName} already at: ${shutterSettings[s].currentHeight}% - setting current action: ${shutterSettings[s].currentAction}`);
                                }
                            } else if (statusAlarmWind2 == false) {
                                if (pendingAlarm == false && statusAlarmFrost == false) {
                                    if (!hasAlarmTriggerLevel(shutterSettings[s])) {
                                        // no position was saved before the alarm (e.g. shutter added while the alarm was active) - nothing to drive back to
                                        adapter.log.debug(`Alarm Wind 2 ended for ${shutterSettings[s].shutterName}: no saved position - shutter stays where it is`);
                                    } else if (currentValue === mustValue ||
                                        currentValue === mustValueTilted ||
                                        shutterSettings[s].triggerID == '') {

                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name)
                                            .catch((e) => adapter.log.warn(e));

                                        if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != parseFloat(String(shutterSettings[s].alarmTriggerLevel)) &&
                                            statusAlarmFire == false) {

                                            shutterSettings[s].currentHeight = parseFloat(String(shutterSettings[s].alarmTriggerLevel));
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                            shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(shutterSettings[s].alarmTriggerLevel)), nameDevice, 'Alarm Wind 2 end');

                                            adapter.log.debug(`shutter alarm wind 2 endet and no other alarm is pending ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].currentHeight}%`);
                                        } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == parseFloat(String(shutterSettings[s].alarmTriggerLevel))) {

                                            shutterSettings[s].currentHeight = parseFloat(String(shutterSettings[s].alarmTriggerLevel));
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                            shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                            adapter.log.debug(`shutter alarm wind 2 endet and no other alarm is pending ${shutterSettings[s].shutterName} already at: ${shutterSettings[s].currentHeight}% - setting current action: ${shutterSettings[s].currentAction}`);
                                        }
                                    } else if (currentValue != '' &&
                                        currentValue != mustValue &&
                                        currentValue != mustValueTilted &&
                                        shutterSettings[s].driveAfterClose == true) {

                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name)
                                            .catch((e) => adapter.log.warn(e));

                                        if (_shutterState?.val !== null && _shutterState?.val !== undefined) {
                                            shutterSettings[s].triggerHeight = parseFloat(String(shutterSettings[s].alarmTriggerLevel));
                                            shutterSettings[s].triggerAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].currentHeight = shutterSettings[s].triggerDrive;
                                            shutterSettings[s].currentAction = 'triggered';

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(shutterSettings[s].currentHeight)), nameDevice, '#Shutter alarm wind 2 end');

                                            adapter.log.debug(`save new trigger height: ${shutterSettings[s].triggerHeight}%`);
                                            adapter.log.debug(`save new trigger action: ${shutterSettings[s].triggerAction}`);
                                        }
                                    }
                                } else {
                                    adapter.log.info(`Alarm Wind 2 endet for ID: ${shutterSettings[s].shutterName} driving to next highest alarm priority`);
                                    if (statusAlarmFire == false) {
                                        if (statusAlarmFrost == true) {
                                            if (shutterSettings[s].alarmTriggerAction == 'down') {
                                                shutterSettings[s].currentAction = 'frost';
                                                shutterSettings[s].currentHeight = alarmFrostLevel;
                                            } else {
                                                shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                                shutterSettings[s].currentHeight = shutterSettings[s].alarmTriggerLevel;
                                            }
                                        }
                                        if (statusAlarmWind1 == true) {
                                            shutterSettings[s].currentHeight = alarmWind1Level;
                                            shutterSettings[s].currentAction = 'wind1';
                                        }
                                        if (statusAlarmRain == true) {
                                            shutterSettings[s].currentHeight = alarmRainLevel;
                                            shutterSettings[s].currentAction = 'rain';
                                        }

                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(shutterSettings[s].currentHeight)), nameDevice, '#Shutter alarm wind 2 end');

                                        adapter.log.debug(`shutter alarm ${shutterSettings[s].currentAction} ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].currentHeight}%`);
                                    }
                                }
                            }
                            await adapter.delay(driveDelayUpAstro);
                            break;

                        // +++++++++++++++++ Alarm Rain  +++++++++++++++
                        case 'alarmRain':
                            if (statusAlarmRain == true) {
                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name)
                                    .catch((e) => adapter.log.warn(e));

                                if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != parseFloat(String(alarmRainLevel)) &&
                                    statusAlarmFire == false) {

                                    if (statusAlarmWind1 == false &&
                                        statusAlarmWind2 == false &&
                                        statusAlarmFrost == false &&
                                        statusAlarmFire == false) {

                                        if (currentValue != '' &&
                                            currentValue != mustValue &&
                                            currentValue != mustValueTilted &&
                                            shutterSettings[s].driveAfterClose == true) {

                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                        } else {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                        }
                                    }
                                    shutterSettings[s].currentHeight = parseFloat(String(alarmRainLevel));
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                    shutterSettings[s].currentAction = 'rain';
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(alarmRainLevel)), nameDevice, '#Shutter alarm Rain');

                                    adapter.log.debug(`shutter alarm rain ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].currentHeight}%`);
                                } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == parseFloat(String(alarmRainLevel)) &&
                                    statusAlarmFire == false) {

                                    if (statusAlarmWind1 == false &&
                                        statusAlarmWind2 == false &&
                                        statusAlarmFrost == false &&
                                        statusAlarmFire == false) {

                                        if (currentValue != '' &&
                                            currentValue != mustValue &&
                                            currentValue != mustValueTilted &&
                                            shutterSettings[s].driveAfterClose == true) {

                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                        } else {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                        }
                                    }
                                    shutterSettings[s].currentHeight = parseFloat(String(alarmRainLevel));
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                    shutterSettings[s].currentAction = 'rain';
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                    adapter.log.debug(`shutter alarm rain ${shutterSettings[s].shutterName} already at: ${shutterSettings[s].currentHeight}% - setting current action: ${shutterSettings[s].currentAction}`);
                                }
                            } else if (statusAlarmRain == false) {
                                if (pendingAlarm == false && statusAlarmFrost == false) {
                                    if (!hasAlarmTriggerLevel(shutterSettings[s])) {
                                        // no position was saved before the alarm (e.g. shutter added while the alarm was active) - nothing to drive back to
                                        adapter.log.debug(`Alarm rain ended for ${shutterSettings[s].shutterName}: no saved position - shutter stays where it is`);
                                    } else if (currentValue === mustValue ||
                                        currentValue === mustValueTilted ||
                                        shutterSettings[s].triggerID == '') {

                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name)
                                            .catch((e) => adapter.log.warn(e));

                                        if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != parseFloat(String(shutterSettings[s].alarmTriggerLevel))) {

                                            shutterSettings[s].currentHeight = parseFloat(String(shutterSettings[s].alarmTriggerLevel));
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                            shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(shutterSettings[s].alarmTriggerLevel)), nameDevice, 'Alarm rain end');

                                            adapter.log.debug(`shutter alarm rain endet and no other alarm is pending ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].currentHeight}%`);
                                        } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == parseFloat(String(shutterSettings[s].alarmTriggerLevel))) {

                                            shutterSettings[s].currentHeight = parseFloat(String(shutterSettings[s].alarmTriggerLevel));
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                            shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                            adapter.log.debug(`shutter alarm rain endet and no other alarm is pending ${shutterSettings[s].shutterName} already at: ${shutterSettings[s].currentHeight}% - setting current action: ${shutterSettings[s].currentAction}`);
                                        }
                                    } else if (currentValue != '' &&
                                        currentValue != mustValue &&
                                        currentValue != mustValueTilted &&
                                        shutterSettings[s].driveAfterClose == true) {

                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name)
                                            .catch((e) => adapter.log.warn(e));

                                        if (_shutterState?.val !== null && _shutterState?.val !== undefined) {
                                            shutterSettings[s].triggerHeight = parseFloat(String(shutterSettings[s].alarmTriggerLevel));
                                            shutterSettings[s].triggerAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].currentHeight = shutterSettings[s].triggerDrive;
                                            shutterSettings[s].currentAction = 'triggered';

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(shutterSettings[s].currentHeight)), nameDevice, '#Shutter alarm rain end');

                                            adapter.log.debug(`save new trigger action: ${shutterSettings[s].triggerAction}`);
                                            adapter.log.debug(`save new trigger height: ${shutterSettings[s].triggerHeight}%`);
                                        }
                                    }
                                } else {
                                    adapter.log.info(`Alarm Rain endet for ID: ${shutterSettings[s].shutterName} driving to next highest alarm priority`);

                                    if (statusAlarmFire == false) {
                                        if (statusAlarmFrost == true) {
                                            if (shutterSettings[s].alarmTriggerAction == 'down') {
                                                shutterSettings[s].currentAction = 'frost';
                                                shutterSettings[s].currentHeight = alarmFrostLevel;
                                            } else {
                                                shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                                shutterSettings[s].currentHeight = shutterSettings[s].alarmTriggerLevel;
                                            }
                                        }
                                        if (statusAlarmWind1 == true) {
                                            shutterSettings[s].currentHeight = alarmWind1Level;
                                            shutterSettings[s].currentAction = 'wind1';
                                        }
                                        if (statusAlarmWind2 == true) {
                                            shutterSettings[s].currentHeight = alarmWind2Level;
                                            shutterSettings[s].currentAction = 'wind2';
                                        }

                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(shutterSettings[s].currentHeight)), nameDevice, '#Shutter alarm rain end');

                                        adapter.log.debug(`shutter alarm ${shutterSettings[s].currentAction} ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].currentHeight}%`);
                                    }
                                }
                            }
                            await adapter.delay(driveDelayUpAstro);
                            break;

                        // +++++++++++++++++ Alarm Frost  +++++++++++++++
                        case 'alarmFrost':
                            if (statusAlarmFrost == true) {
                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                if (_shutterState?.val !== null &&
                                    _shutterState?.val !== undefined &&
                                    Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != parseFloat(String(alarmFrostLevel)) &&
                                    statusAlarmFire == false) {

                                    if (currentValue != '' &&
                                        currentValue != mustValue &&
                                        currentValue != mustValueTilted &&
                                        shutterSettings[s].driveAfterClose == true) {

                                        if (statusAlarmWind1 == false &&
                                            statusAlarmWind2 == false &&
                                            statusAlarmRain == false &&
                                            statusAlarmFire == false) {

                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                        }
                                        if (((shutterSettings[s].triggerHeight as number) < parseFloat(String(alarmFrostLevel)) &&
                                            convertShutter == false) ||
                                            ((shutterSettings[s].triggerHeight as number) > parseFloat(String(alarmFrostLevel)) &&
                                                convertShutter == true)) {

                                            shutterSettings[s].triggerHeight = parseFloat(String(alarmFrostLevel));
                                            shutterSettings[s].triggerAction = 'frost';
                                        }
                                    } else if (_shutterState?.val !== null && _shutterState?.val !== undefined && _shutterState?.val == shutterSettings[s].heightDown &&
                                        (currentValue === mustValue ||
                                            currentValue === mustValueTilted ||
                                            currentValue == '')) {

                                        if (statusAlarmWind1 == false &&
                                            statusAlarmWind2 == false &&
                                            statusAlarmRain == false &&
                                            statusAlarmFire == false) {

                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                        }
                                        if ((Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound < parseFloat(String(alarmFrostLevel)) &&
                                            convertShutter == false) ||
                                            (Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound > parseFloat(String(alarmFrostLevel)) &&
                                                convertShutter == true)) {

                                            shutterSettings[s].currentHeight = parseFloat(String(alarmFrostLevel));
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                            shutterSettings[s].currentAction = 'frost';
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(alarmFrostLevel)), nameDevice, '#Shutter alarm frost');

                                            adapter.log.debug(`shutter alarm frost ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].currentHeight}%`);
                                        }
                                    }

                                } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == parseFloat(String(alarmFrostLevel)) &&
                                    statusAlarmFire == false) {

                                    if (currentValue != '' &&
                                        currentValue != mustValue &&
                                        currentValue != mustValueTilted &&
                                        shutterSettings[s].driveAfterClose == true) {

                                        if (statusAlarmWind1 == false &&
                                            statusAlarmWind2 == false &&
                                            statusAlarmRain == false &&
                                            statusAlarmFire == false) {

                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                        }
                                    } else if (currentValue === mustValue ||
                                        currentValue === mustValueTilted ||
                                        currentValue == '') {

                                        if (statusAlarmWind1 == false &&
                                            statusAlarmWind2 == false &&
                                            statusAlarmRain == false &&
                                            statusAlarmFire == false) {

                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                        }
                                    }
                                    shutterSettings[s].currentHeight = parseFloat(String(alarmFrostLevel));
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                    shutterSettings[s].currentAction = 'frost';
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                    adapter.log.debug(`shutter alarm frost${shutterSettings[s].shutterName} already at: ${shutterSettings[s].currentHeight}% - setting current action: ${shutterSettings[s].currentAction}`);
                                }
                            } else if (statusAlarmFrost == false) {
                                if (pendingAlarm == false) {
                                    if (!hasAlarmTriggerLevel(shutterSettings[s])) {
                                        // no position was saved before the alarm (e.g. shutter added while the alarm was active) - nothing to drive back to
                                        adapter.log.debug(`Alarm frost ended for ${shutterSettings[s].shutterName}: no saved position - shutter stays where it is`);
                                    } else if (currentValue === mustValue ||
                                        currentValue === mustValueTilted ||
                                        shutterSettings[s].triggerID == '') {

                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name)
                                            .catch((e) => adapter.log.warn(e));

                                        if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != parseFloat(String(shutterSettings[s].alarmTriggerLevel))) {

                                            shutterSettings[s].currentHeight = parseFloat(String(shutterSettings[s].alarmTriggerLevel));
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                            shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(shutterSettings[s].alarmTriggerLevel)), nameDevice, 'Alarm frost ended');

                                            adapter.log.debug(`shutter alarm frost endet and no other alarm is pending ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].currentHeight}%`);
                                        } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                            Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == parseFloat(String(shutterSettings[s].alarmTriggerLevel))) {

                                            shutterSettings[s].currentHeight = parseFloat(String(shutterSettings[s].alarmTriggerLevel));
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                            shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                            adapter.log.debug(`shutter alarm frost endet and no other alarm is pending ${shutterSettings[s].shutterName} already at: ${shutterSettings[s].currentHeight}% - setting current action: ${shutterSettings[s].currentAction}`);
                                        }
                                    } else if (currentValue != '' &&
                                        currentValue != mustValue &&
                                        currentValue != mustValueTilted &&
                                        shutterSettings[s].driveAfterClose == true) {

                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name)
                                            .catch((e) => adapter.log.warn(e));

                                        if (_shutterState?.val !== null && _shutterState?.val !== undefined) {
                                            shutterSettings[s].triggerHeight = parseFloat(String(shutterSettings[s].alarmTriggerLevel));
                                            shutterSettings[s].triggerAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].currentHeight = shutterSettings[s].triggerDrive;
                                            shutterSettings[s].currentAction = 'triggered';

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(shutterSettings[s].currentHeight)), nameDevice, '#Shutter alarm frost end');

                                            adapter.log.debug(`save new trigger action: ${shutterSettings[s].triggerAction}`);
                                            adapter.log.debug(`save new trigger height: ${shutterSettings[s].triggerHeight}%`);
                                        }
                                    }
                                } else {
                                    adapter.log.info(`Alarm frost endet for ID: ${shutterSettings[s].shutterName} driving to next highest alarm priority`);
                                    if (statusAlarmFire == false) {
                                        if (statusAlarmWind1 == true) {
                                            shutterSettings[s].currentHeight = alarmWind1Level;
                                            shutterSettings[s].currentAction = 'wind1';
                                        }
                                        if (statusAlarmWind2 == true) {
                                            shutterSettings[s].currentHeight = alarmWind2Level;
                                            shutterSettings[s].currentAction = 'wind2';
                                        }
                                        if (statusAlarmRain == true) {
                                            shutterSettings[s].currentHeight = alarmRainLevel;
                                            shutterSettings[s].currentAction = 'rain';
                                        }

                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(shutterSettings[s].currentHeight)), nameDevice, '#Shutter alarm frost end');

                                        adapter.log.debug(`shutter alarm ${shutterSettings[s].currentAction} ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].currentHeight}%`);
                                    }
                                }
                            }
                            await adapter.delay(driveDelayUpAstro);
                            break;

                        // +++++++++++++++++ Alarm Fire  +++++++++++++++
                        case 'alarmFire':
                            if (statusAlarmFire == true) {
                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name)
                                    .catch((e) => adapter.log.warn(e));

                                if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != parseFloat(String(alarmFireLevel))) {

                                    if (statusAlarmWind1 == false &&
                                        statusAlarmWind2 == false &&
                                        statusAlarmRain == false &&
                                        statusAlarmFrost == false) {

                                        shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                        shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                    }
                                    shutterSettings[s].currentHeight = parseFloat(String(alarmFireLevel));
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                    shutterSettings[s].currentAction = 'fire';
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(alarmFireLevel)), nameDevice, '#Shutter alarm fire');

                                    adapter.log.debug(`shutter alarm fire ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].currentHeight}%`);
                                } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round(parseFloat(String(_shutterState.val)) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == parseFloat(String(alarmFireLevel))) {

                                    if (statusAlarmWind1 == false &&
                                        statusAlarmWind2 == false &&
                                        statusAlarmRain == false &&
                                        statusAlarmFrost == false) {

                                        shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                        shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                    }
                                    shutterSettings[s].currentHeight = parseFloat(String(alarmFireLevel));
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                    shutterSettings[s].currentAction = 'fire';
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                    adapter.log.debug(`shutter alarm fire ${shutterSettings[s].shutterName} already at: ${shutterSettings[s].currentHeight}% - setting current action: ${shutterSettings[s].currentAction}`);
                                }
                            } else if (statusAlarmFire == false) {
                                adapter.log.info(`Alarm fire endet for ID: ${shutterSettings[s].shutterName} fire alarm is not driving back! - please init shutters with button "open all"`);
                            }
                            await adapter.delay(driveDelayUpAstro);
                            break;
                    }
                }
            }
        }
        return (shutterSettings);
    }
}

// checks if an alarm is currently pending with exeption of frost alarm

/**
 * Checks if an alarm is currently pending for the shutter (frost alarm excluded).
 *
 * @param adapter adapter instance
 * @param Shutter settings of the shutter
 * @returns true when an alarm is pending
 */
export async function checkPendingAlarm(adapter: ioBroker.Adapter, Shutter: ShutterSettings): Promise<boolean> {
    if (Shutter.enableAlarmWind1 == true ||
        Shutter.enableAlarmWind2 == true ||
        Shutter.enableAlarmRain == true ||
        Shutter.enableAlarmFire == true ||
        Shutter.enableAlarmFrost == true) {

        adapter.log.debug('Start pendingAlarm to check whether an alarm is currently pending (except in the event of frost)');
    }


    let resAlarmPending = false;

    const _statusAlarmWind1 = adapter.config.alarmWind1 != '' ? await adapter.getForeignStateAsync(adapter.config.alarmWind1)
        .catch((e) => adapter.log.warn(`check pending alarm is not possible: ${e}`)) : null;
    const statusAlarmWind1 = _statusAlarmWind1 !== null && _statusAlarmWind1?.val !== undefined ? _statusAlarmWind1.val : false;

    const _statusAlarmWind2 = adapter.config.alarmWind2 != '' ? await adapter.getForeignStateAsync(adapter.config.alarmWind2)
        .catch((e) => adapter.log.warn(`check pending alarm is not possible: ${e}`)) : null;
    const statusAlarmWind2 = _statusAlarmWind2 !== null && _statusAlarmWind2?.val !== undefined ? _statusAlarmWind2.val : false;

    const _statusAlarmRain = adapter.config.alarmRain != '' ? await adapter.getForeignStateAsync(adapter.config.alarmRain)
        .catch((e) => adapter.log.warn(`check pending alarm is not possible: ${e}`)) : null;
    const statusAlarmRain = _statusAlarmRain !== null && _statusAlarmRain?.val !== undefined ? _statusAlarmRain.val : false;

    const _statusAlarmFire = adapter.config.alarmFire != '' ? await adapter.getForeignStateAsync(adapter.config.alarmFire)
        .catch((e) => adapter.log.warn(`check pending alarm is not possible: ${e}`)) : null;
    const statusAlarmFire = _statusAlarmFire !== null && _statusAlarmFire?.val !== undefined ? _statusAlarmFire.val : false;

    // check if alarm ist pending for the given shutter and return true if yes
    if ((statusAlarmWind1 == true &&
        Shutter.enableAlarmWind1 == true) ||
        (statusAlarmWind2 == true &&
            Shutter.enableAlarmWind2 == true) ||
        (statusAlarmRain == true &&
            Shutter.enableAlarmRain == true) ||
        (statusAlarmFire == true &&
            Shutter.enableAlarmFire == true) ||
        (Shutter.currentAction == 'fire')) {

        resAlarmPending = true;
    }

    if (Shutter.enableAlarmWind1 == true ||
        Shutter.enableAlarmWind2 == true ||
        Shutter.enableAlarmRain == true ||
        Shutter.enableAlarmFire == true ||
        Shutter.enableAlarmFrost == true) {

        adapter.log.debug(`status alarm pending for ${Shutter.name}: ${resAlarmPending}`);
    }
    return resAlarmPending;
}

// checks if frost alarm is currently true

/**
 * Checks if the frost alarm is currently active.
 *
 * @param adapter adapter instance
 * @param Shutter settings of the shutter
 * @returns value of the frost alarm state, false when it has no value
 */
export async function checkFrostAlarm(adapter: ioBroker.Adapter, Shutter: ShutterSettings): Promise<ioBroker.StateValue> {
    if (Shutter.enableAlarmWind1 == true ||
        Shutter.enableAlarmWind2 == true ||
        Shutter.enableAlarmRain == true ||
        Shutter.enableAlarmFire == true ||
        Shutter.enableAlarmFrost == true) {

        adapter.log.debug('start checking frost alarm');
    }

    const _resAlarmFrost = adapter.config.alarmFrost != '' ? await adapter.getForeignStateAsync(adapter.config.alarmFrost).catch((e) => adapter.log.warn(`check frost alarm is not possible: ${e}`)) : null;
    const resAlarmFrost = _resAlarmFrost?.val !== null && _resAlarmFrost?.val !== undefined ? _resAlarmFrost.val : false;

    if (Shutter.enableAlarmWind1 == true ||
        Shutter.enableAlarmWind2 == true ||
        Shutter.enableAlarmRain == true ||
        Shutter.enableAlarmFire == true ||
        Shutter.enableAlarmFrost == true) {

        adapter.log.debug(`status frost alarm for ${Shutter.name}: ${resAlarmFrost}`);
    }
    return resAlarmFrost;
}

/**
 * Checks whether an alarm state has really changed its value.
 *
 * A state that is only refreshed with the same value gets a new timestamp (ts) but keeps the
 * time of its last change (lc). Such a refresh must not be handled as a new alarm or as the end
 * of an alarm - otherwise every refresh of "false" drives the shutters back to the saved
 * position.
 *
 * @param state state from the stateChange event
 * @returns true when the value has changed (or the change time is unknown)
 */
export function isAlarmStateChanged(state: ioBroker.State | null | undefined): boolean {
    if (!state) {
        return false;
    }
    return state.lc === undefined || state.ts === state.lc;
}

/**
 * Checks whether a usable position was saved before the alarm started.
 *
 * @param shutter settings of the shutter
 * @returns true when alarmTriggerLevel is a number
 */
export function hasAlarmTriggerLevel(shutter: Pick<ShutterSettings, 'alarmTriggerLevel'>): boolean {
    return Number.isFinite(parseFloat(String(shutter.alarmTriggerLevel)));
}
