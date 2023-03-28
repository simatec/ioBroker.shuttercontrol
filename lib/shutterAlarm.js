'use strict';

const setShutterState = require('./setShutter.js').setShutterState;             // set Shutter State
const setShutterInfo = require('./setShutter.js').setShutterInfo;               // set Shutter State

let timerSleep = 0;

async function sleep(ms) {
    return new Promise(async (resolve) => {
        // @ts-ignore
        timerSleep = setTimeout(async () => resolve(), ms);
    });
}

// @ts-ignore
async function shutterAlarm(adapter, alarmType, shutterSettings) {
    adapter.log.debug('start shutterAlarm');

    const alarmWind1Level = adapter.config.alarmWind1Level;
    const alarmWind2Level = adapter.config.alarmWind2Level;
    const alarmRainLevel = adapter.config.alarmRainLevel;
    const alarmFrostLevel = adapter.config.alarmFrostLevel;
    const alarmFireLevel = adapter.config.alarmFireLevel;

    const driveDelayUpAstro = adapter.config.driveDelayUpAstro !== 0 ? adapter.config.driveDelayUpAstro * 1000 : 20;

    let statusAlarmWind1 = false;
    let statusAlarmWind2 = false;
    let statusAlarmRain = false;
    let statusAlarmFrost = false;
    let statusAlarmFire = false;
    let currentValue = '';          // window trigger value
    let mustValue = '';             // Window trigger referenz value
    let mustValueTilted = ''        // Window trigger referenz value Tilted

    let resAlarm; // Filter Area

    if (shutterSettings) {
        switch (alarmType) {
            case 'alarmWind1':
                resAlarm = shutterSettings.filter((/** @type {{ enableAlarmWind1: boolean; }} */ d) => d.enableAlarmWind1 === true);
                break;
            case 'alarmWind2':
                resAlarm = shutterSettings.filter((/** @type {{ enableAlarmWind2: boolean; }} */ d) => d.enableAlarmWind2 === true);
                break;
            case 'alarmRain':
                resAlarm = shutterSettings.filter((/** @type {{ enableAlarmRain: boolean; }} */ d) => d.enableAlarmRain === true);
                break;
            case 'alarmFrost':
                resAlarm = shutterSettings.filter((/** @type {{ enableAlarmFrost: boolean; }} */ d) => d.enableAlarmFrost === true);
                break;
            case 'alarmFire':
                resAlarm = shutterSettings.filter((/** @type {{ enableAlarmFire: boolean; }} */ d) => d.enableAlarmFire === true);
                break;

        }

        const result = resAlarm.filter((/** @type {{ enabled: boolean; }} */ d) => d.enabled === true); // Filter enabled

        for (const i in result) {
            for (const s in shutterSettings) {
                if (shutterSettings[s].shutterName === result[i].shutterName) {
                    const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                    let convertShutter = false;

                    if (parseFloat(shutterSettings[s].heightDown) < parseFloat(shutterSettings[s].heightUp)) {
                        convertShutter = false;
                    } else if (parseFloat(shutterSettings[s].heightDown) > parseFloat(shutterSettings[s].heightUp)) {
                        convertShutter = true;
                    }

                    const pendingAlarm = await checkPendingAlarm(adapter, shutterSettings[s]);

                    const _alarmWind1 = adapter.config.alarmWind1 !== '' ? await adapter.getForeignStateAsync(adapter.config.alarmWind1).catch((e) => adapter.log.warn(e)) : null;
                    if (typeof _alarmWind1 !== undefined && _alarmWind1 !== null) {
                        statusAlarmWind1 = _alarmWind1.val;
                    }

                    const _alarmWind2 = adapter.config.alarmWind2 !== '' ? await adapter.getForeignStateAsync(adapter.config.alarmWind2).catch((e) => adapter.log.warn(e)) : null;
                    if (typeof _alarmWind2 !== undefined && _alarmWind2 !== null) {
                        statusAlarmWind2 = _alarmWind2.val;
                    }

                    const _alarmRain = adapter.config.alarmRain !== '' ? await adapter.getForeignStateAsync(adapter.config.alarmRain).catch((e) => adapter.log.warn(e)) : null;
                    if (typeof _alarmRain !== undefined && _alarmRain !== null) {
                        statusAlarmRain = _alarmRain.val;
                    }

                    const _alarmFrost = adapter.config.alarmFrost !== '' ? await adapter.getForeignStateAsync(adapter.config.alarmFrost).catch((e) => adapter.log.warn(e)) : null;
                    if (typeof _alarmFrost !== undefined && _alarmFrost !== null) {
                        statusAlarmFrost = _alarmFrost.val;
                    }

                    const _alarmFire = adapter.config.alarmFire !== '' ? await adapter.getForeignStateAsync(adapter.config.alarmFire).catch((e) => adapter.log.warn(e)) : null;
                    if (typeof _alarmFire !== undefined && _alarmFire !== null) {
                        statusAlarmFire = _alarmFire.val;
                    }

                    const _triggerState = shutterSettings[s].triggerID !== '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;

                    mustValue = ('' + shutterSettings[s].triggerState);
                    mustValueTilted = shutterSettings[s].triggerStateTilted === 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                    if (typeof _triggerState !== undefined && _triggerState !== null) {
                        currentValue = ('' + _triggerState.val);
                    }

                    switch (alarmType) {
                        // +++++++++++++++++ Alarm Wind 1  +++++++++++++++
                        case 'alarmWind1':
                            if (statusAlarmWind1 === true) {
                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));
                                if (typeof _shutterState !== undefined && _shutterState !== null && parseFloat(_shutterState.val) !== parseFloat(alarmWind1Level) && statusAlarmFire === false) {
                                    if (statusAlarmWind2 === false && statusAlarmRain === false && statusAlarmFrost === false && statusAlarmFire === false) {
                                        if (currentValue !== '' && currentValue !== mustValue && currentValue !== mustValueTilted && shutterSettings[s].driveAfterClose === true) {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                        } else {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                        }
                                    }
                                    shutterSettings[s].currentHeight = parseFloat(alarmWind1Level);
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                    shutterSettings[s].currentAction = 'wind1';
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(alarmWind1Level), nameDevice, 'Alarm #100');

                                    adapter.log.debug('shutter alarm wind 1 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                }
                                else if (typeof _shutterState !== undefined && _shutterState !== null && parseFloat(_shutterState.val) === parseFloat(alarmWind1Level) && statusAlarmFire === false) {
                                    if ((statusAlarmWind2 === false && statusAlarmRain === false && statusAlarmFrost === false && statusAlarmFire === false)) {
                                        if (currentValue !== '' && currentValue !== mustValue && currentValue !== mustValueTilted && shutterSettings[s].driveAfterClose === true) {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                        } else {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                        }
                                    }
                                    shutterSettings[s].currentHeight = parseFloat(alarmWind1Level);
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                    shutterSettings[s].currentAction = 'wind1';
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                    adapter.log.debug('shutter alarm wind 1 ' + shutterSettings[s].shutterName + ' already at: ' + shutterSettings[s].currentHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                }
                            } else if (statusAlarmWind1 === false) {
                                if (pendingAlarm === false && statusAlarmFrost === false) {
                                    if (currentValue === mustValue || currentValue === mustValueTilted || shutterSettings[s].triggerID === '') {
                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (typeof _shutterState !== undefined && _shutterState !== null && parseFloat(_shutterState.val) !== parseFloat(shutterSettings[s].alarmTriggerLevel)) {
                                            shutterSettings[s].currentHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                            shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].alarmTriggerLevel), nameDevice, 'Alarm Wind 1 ended');

                                            adapter.log.debug('shutter alarm wind 1 endet and no other alarm is pending ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                        }
                                        else if (typeof _shutterState !== undefined && _shutterState !== null && parseFloat(_shutterState.val) === parseFloat(shutterSettings[s].alarmTriggerLevel)) {
                                            shutterSettings[s].currentHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                            shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                            adapter.log.debug('shutter alarm wind 1 endet and no other alarm is pending ' + shutterSettings[s].shutterName + ' already at: ' + shutterSettings[s].currentHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                        }
                                    } else if (currentValue !== '' && currentValue !== mustValue && currentValue !== mustValueTilted && shutterSettings[s].driveAfterClose === true) {
                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (typeof _shutterState !== undefined && _shutterState !== null) {
                                            shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                            shutterSettings[s].triggerAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].currentHeight = shutterSettings[s].triggerDrive;
                                            shutterSettings[s].currentAction = 'triggered';

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].currentHeight), nameDevice, '#Shutter alarm wind1 end');

                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                            adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                        }
                                    }
                                } else {
                                    adapter.log.info('Alarm Wind 1 endet for ID: ' + shutterSettings[s].shutterName + ' driving to next highest alarm priority');

                                    if (statusAlarmFire === false) {
                                        if (statusAlarmFrost === true) {
                                            if (shutterSettings[s].alarmTriggerAction === 'down') {
                                                shutterSettings[s].currentAction = 'frost';
                                                shutterSettings[s].currentHeight = alarmFrostLevel;
                                            } else {
                                                shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                                shutterSettings[s].currentHeight = shutterSettings[s].alarmTriggerLevel;
                                            }
                                        }
                                        if (statusAlarmWind2 === true) {
                                            shutterSettings[s].currentHeight = alarmWind2Level;
                                            shutterSettings[s].currentAction = 'wind2';
                                        }
                                        if (statusAlarmRain === true) {
                                            shutterSettings[s].currentHeight = alarmRainLevel;
                                            shutterSettings[s].currentAction = 'rain';
                                        }

                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].currentHeight), nameDevice, '#Shutter alarm wind1 end');

                                        adapter.log.debug('shutter alarm ' + shutterSettings[s].currentAction + ' ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                    }
                                }
                            }
                            await sleep(driveDelayUpAstro);
                            break;

                        // +++++++++++++++++ Alarm Wind 2  +++++++++++++++
                        case 'alarmWind2':
                            if (statusAlarmWind2 === true) {
                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                if (typeof _shutterState !== undefined && _shutterState !== null && parseFloat(_shutterState.val) !== parseFloat(alarmWind2Level) && statusAlarmFire === false) {
                                    if (statusAlarmWind1 === false && statusAlarmRain === false && statusAlarmFrost === false && statusAlarmFire === false) {
                                        if (currentValue !== '' && currentValue !== mustValue && currentValue !== mustValueTilted && shutterSettings[s].driveAfterClose === true) {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                        } else {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                        }
                                    }
                                    shutterSettings[s].currentHeight = parseFloat(alarmWind2Level);
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                    shutterSettings[s].currentAction = 'wind2';
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(alarmWind2Level), nameDevice, '#Shutter alarm wind2');

                                    adapter.log.debug('shutter alarm wind 2 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                }
                                else if (typeof _shutterState !== undefined && _shutterState !== null && parseFloat(_shutterState.val) === parseFloat(alarmWind2Level)) {
                                    if (statusAlarmRain === false && statusAlarmFrost === false && statusAlarmFire === false) {
                                        if (currentValue !== '' && currentValue !== mustValue && currentValue !== mustValueTilted && shutterSettings[s].driveAfterClose === true) {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                        } else {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                        }
                                    }
                                    shutterSettings[s].currentHeight = parseFloat(alarmWind2Level);
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                    shutterSettings[s].currentAction = 'wind2';
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                    adapter.log.debug('shutter alarm wind 2 ' + shutterSettings[s].shutterName + ' already at: ' + shutterSettings[s].currentHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                }
                            } else if (statusAlarmWind2 === false) {
                                if (pendingAlarm === false && statusAlarmFrost === false) {
                                    if (currentValue === mustValue || currentValue === mustValueTilted || shutterSettings[s].triggerID === '') {
                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (typeof _shutterState !== undefined && _shutterState !== null && parseFloat(_shutterState.val) !== parseFloat(shutterSettings[s].alarmTriggerLevel) && statusAlarmFire === false) {
                                            shutterSettings[s].currentHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                            shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].alarmTriggerLevel), nameDevice, 'Alarm Wind 2 end');

                                            adapter.log.debug('shutter alarm wind 2 endet and no other alarm is pending ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                        }
                                        else if (typeof _shutterState !== undefined && _shutterState !== null && parseFloat(_shutterState.val) === parseFloat(shutterSettings[s].alarmTriggerLevel)) {
                                            shutterSettings[s].currentHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                            shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                            adapter.log.debug('shutter alarm wind 2 endet and no other alarm is pending ' + shutterSettings[s].shutterName + ' already at: ' + shutterSettings[s].currentHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                        }
                                    } else if (currentValue !== '' && currentValue !== mustValue && currentValue !== mustValueTilted && shutterSettings[s].driveAfterClose === true) {
                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (typeof _shutterState !== undefined && _shutterState !== null) {
                                            shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                            shutterSettings[s].triggerAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].currentHeight = shutterSettings[s].triggerDrive;
                                            shutterSettings[s].currentAction = 'triggered';

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].currentHeight), nameDevice, '#Shutter alarm wind 2 end');

                                            adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                        }
                                    }
                                } else {
                                    adapter.log.info('Alarm Wind 2 endet for ID: ' + shutterSettings[s].shutterName + ' driving to next highest alarm priority');
                                    if (statusAlarmFire === false) {
                                        if (statusAlarmFrost === true) {
                                            if (shutterSettings[s].alarmTriggerAction === 'down') {
                                                shutterSettings[s].currentAction = 'frost';
                                                shutterSettings[s].currentHeight = alarmFrostLevel;
                                            } else {
                                                shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                                shutterSettings[s].currentHeight = shutterSettings[s].alarmTriggerLevel;
                                            }
                                        }
                                        if (statusAlarmWind1 === true) {
                                            shutterSettings[s].currentHeight = alarmWind1Level;
                                            shutterSettings[s].currentAction = 'wind1';
                                        }
                                        if (statusAlarmRain === true) {
                                            shutterSettings[s].currentHeight = alarmRainLevel;
                                            shutterSettings[s].currentAction = 'rain';
                                        }

                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].currentHeight), nameDevice, '#Shutter alarm wind 2 end');

                                        adapter.log.debug('shutter alarm ' + shutterSettings[s].currentAction + ' ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                    }
                                }
                            }
                            await sleep(driveDelayUpAstro);
                            break;

                        // +++++++++++++++++ Alarm Rain  +++++++++++++++
                        case 'alarmRain':
                            if (statusAlarmRain === true) {
                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                if (typeof _shutterState !== undefined && _shutterState !== null && parseFloat(_shutterState.val) !== parseFloat(alarmRainLevel) && statusAlarmFire === false) {
                                    if (statusAlarmWind1 === false && statusAlarmWind2 === false && statusAlarmFrost === false && statusAlarmFire === false) {
                                        if (currentValue !== '' && currentValue !== mustValue && currentValue !== mustValueTilted && shutterSettings[s].driveAfterClose === true) {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                        } else {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                        }
                                    }
                                    shutterSettings[s].currentHeight = parseFloat(alarmRainLevel);
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                    shutterSettings[s].currentAction = 'rain';
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(alarmRainLevel), nameDevice, '#Shutter alarm Rain');

                                    adapter.log.debug('shutter alarm rain ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                }
                                else if (typeof _shutterState !== undefined && _shutterState !== null && parseFloat(_shutterState.val) === parseFloat(alarmRainLevel) && statusAlarmFire === false) {
                                    if (statusAlarmWind1 === false && statusAlarmWind2 === false && statusAlarmFrost === false && statusAlarmFire === false) {
                                        if (currentValue !== '' && currentValue !== mustValue && currentValue !== mustValueTilted && shutterSettings[s].driveAfterClose === true) {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                        } else {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                        }
                                    }
                                    shutterSettings[s].currentHeight = parseFloat(alarmRainLevel);
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                    shutterSettings[s].currentAction = 'rain';
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                    adapter.log.debug('shutter alarm rain ' + shutterSettings[s].shutterName + ' already at: ' + shutterSettings[s].currentHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                }
                            } else if (statusAlarmRain === false) {
                                if (pendingAlarm === false && statusAlarmFrost === false) {
                                    if (currentValue === mustValue || currentValue === mustValueTilted || shutterSettings[s].triggerID === '') {
                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (typeof _shutterState !== undefined && _shutterState !== null && parseFloat(_shutterState.val) !== parseFloat(shutterSettings[s].alarmTriggerLevel)) {
                                            shutterSettings[s].currentHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                            shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].alarmTriggerLevel), nameDevice, 'Alarm rain end');

                                            adapter.log.debug('shutter alarm rain endet and no other alarm is pending ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                        }
                                        else if (typeof _shutterState !== undefined && _shutterState !== null && parseFloat(_shutterState.val) === parseFloat(shutterSettings[s].alarmTriggerLevel)) {
                                            shutterSettings[s].currentHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                            shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                            adapter.log.debug('shutter alarm rain endet and no other alarm is pending ' + shutterSettings[s].shutterName + ' already at: ' + shutterSettings[s].currentHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                        }
                                    } else if (currentValue !== '' && currentValue !== mustValue && currentValue !== mustValueTilted && shutterSettings[s].driveAfterClose === true) {
                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (typeof _shutterState !== undefined && _shutterState !== null) {
                                            shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                            shutterSettings[s].triggerAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].currentHeight = shutterSettings[s].triggerDrive;
                                            shutterSettings[s].currentAction = 'triggered';

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].currentHeight), nameDevice, '#Shutter alarm rain end');

                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                            adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                        }
                                    }
                                } else {
                                    adapter.log.info('Alarm Rain endet for ID: ' + shutterSettings[s].shutterName + ' driving to next highest alarm priority');

                                    if (statusAlarmFire === false) {
                                        if (statusAlarmFrost === true) {
                                            if (shutterSettings[s].alarmTriggerAction === 'down') {
                                                shutterSettings[s].currentAction = 'frost';
                                                shutterSettings[s].currentHeight = alarmFrostLevel;
                                            } else {
                                                shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                                shutterSettings[s].currentHeight = shutterSettings[s].alarmTriggerLevel;
                                            }
                                        }
                                        if (statusAlarmWind1 === true) {
                                            shutterSettings[s].currentHeight = alarmWind1Level;
                                            shutterSettings[s].currentAction = 'wind1';
                                        }
                                        if (statusAlarmWind2 === true) {
                                            shutterSettings[s].currentHeight = alarmWind2Level;
                                            shutterSettings[s].currentAction = 'wind2';
                                        }

                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].currentHeight), nameDevice, '#Shutter alarm rain end');

                                        adapter.log.debug('shutter alarm ' + shutterSettings[s].currentAction + ' ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                    }
                                }
                            }
                            await sleep(driveDelayUpAstro);
                            break;

                        // +++++++++++++++++ Alarm Frost  +++++++++++++++
                        case 'alarmFrost':
                            if (statusAlarmFrost === true) {
                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                if (typeof _shutterState !== undefined && _shutterState !== null && parseFloat(_shutterState.val) !== parseFloat(alarmFrostLevel) && statusAlarmFire === false) {
                                    if (currentValue !== '' && currentValue !== mustValue && currentValue !== mustValueTilted && shutterSettings[s].driveAfterClose === true) {
                                        if (statusAlarmWind1 === false && statusAlarmWind2 === false && statusAlarmRain === false && statusAlarmFire === false) {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                        }
                                        if ((shutterSettings[s].triggerHeight < parseFloat(alarmFrostLevel) && convertShutter === false) || (shutterSettings[s].triggerHeight > parseFloat(alarmFrostLevel) && convertShutter === true)) {
                                            shutterSettings[s].triggerHeight = parseFloat(alarmFrostLevel);
                                            shutterSettings[s].triggerAction = 'frost';
                                        }
                                    } else if (currentValue === mustValue || currentValue === mustValueTilted || currentValue === '') {
                                        if (statusAlarmWind1 === false && statusAlarmWind2 === false && statusAlarmRain === false && statusAlarmFire === false) {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                        }
                                        if ((parseFloat(_shutterState.val) < parseFloat(alarmFrostLevel) && convertShutter === false) || (parseFloat(_shutterState.val) > parseFloat(alarmFrostLevel) && convertShutter === true)) {
                                            shutterSettings[s].currentHeight = parseFloat(alarmFrostLevel);
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                            shutterSettings[s].currentAction = 'frost';
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(alarmFrostLevel), nameDevice, '#Shutter alarm frost');

                                            adapter.log.debug('shutter alarm frost ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                        }
                                    }

                                }
                                else if (typeof _shutterState !== undefined && _shutterState !== null && parseFloat(_shutterState.val) === parseFloat(alarmFrostLevel) && statusAlarmFire === false) {
                                    if (currentValue !== '' && currentValue !== mustValue && currentValue !== mustValueTilted && shutterSettings[s].driveAfterClose === true) {
                                        if (statusAlarmWind1 === false && statusAlarmWind2 === false && statusAlarmRain === false && statusAlarmFire === false) {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                        }
                                    } else if (currentValue === mustValue || currentValue === mustValueTilted || currentValue === '') {
                                        if (statusAlarmWind1 === false && statusAlarmWind2 === false && statusAlarmRain === false && statusAlarmFire === false) {
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                        }
                                    }
                                    shutterSettings[s].currentHeight = parseFloat(alarmFrostLevel);
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                    shutterSettings[s].currentAction = 'frost';
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                    adapter.log.debug('shutter alarm frost' + shutterSettings[s].shutterName + ' already at: ' + shutterSettings[s].currentHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                }
                            } else if (statusAlarmFrost === false) {
                                if (pendingAlarm === false) {
                                    if (currentValue === mustValue || currentValue === mustValueTilted || shutterSettings[s].triggerID === '') {
                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (typeof _shutterState !== undefined && _shutterState !== null && parseFloat(_shutterState.val) !== parseFloat(shutterSettings[s].alarmTriggerLevel)) {
                                            shutterSettings[s].currentHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                            shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].alarmTriggerLevel), nameDevice, 'Alarm frost ended');

                                            adapter.log.debug('shutter alarm frost endet and no other alarm is pending ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                        }
                                        else if (typeof _shutterState !== undefined && _shutterState !== null && parseFloat(_shutterState.val) === parseFloat(shutterSettings[s].alarmTriggerLevel)) {
                                            shutterSettings[s].currentHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                            shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                            adapter.log.debug('shutter alarm frost endet and no other alarm is pending ' + shutterSettings[s].shutterName + ' already at: ' + shutterSettings[s].currentHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                        }
                                    } else if (currentValue !== '' && currentValue !== mustValue && currentValue !== mustValueTilted && shutterSettings[s].driveAfterClose === true) {
                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                        if (typeof _shutterState !== undefined && _shutterState !== null) {
                                            shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                            shutterSettings[s].triggerAction = shutterSettings[s].alarmTriggerAction;
                                            shutterSettings[s].currentHeight = shutterSettings[s].triggerDrive;
                                            shutterSettings[s].currentAction = 'triggered';

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].currentHeight), nameDevice, '#Shutter alarm frost end');

                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                            adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                        }
                                    }
                                } else {
                                    adapter.log.info('Alarm frost endet for ID: ' + shutterSettings[s].shutterName + ' driving to next highest alarm priority');
                                    if (statusAlarmFire === false) {
                                        if (statusAlarmWind1 === true) {
                                            shutterSettings[s].currentHeight = alarmWind1Level;
                                            shutterSettings[s].currentAction = 'wind1';
                                        }
                                        if (statusAlarmWind2 === true) {
                                            shutterSettings[s].currentHeight = alarmWind2Level;
                                            shutterSettings[s].currentAction = 'wind2';
                                        }
                                        if (statusAlarmRain === true) {
                                            shutterSettings[s].currentHeight = alarmRainLevel;
                                            shutterSettings[s].currentAction = 'rain';
                                        }

                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].currentHeight), nameDevice, '#Shutter alarm frost end');

                                        adapter.log.debug('shutter alarm ' + shutterSettings[s].currentAction + ' ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                    }
                                }
                            }
                            await sleep(driveDelayUpAstro);
                            break;

                        // +++++++++++++++++ Alarm Fire  +++++++++++++++
                        case 'alarmFire':
                            if (statusAlarmFire === true) {
                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                if (typeof _shutterState !== undefined && _shutterState !== null && parseFloat(_shutterState.val) !== parseFloat(alarmFireLevel)) {
                                    if (statusAlarmWind1 === false && statusAlarmWind2 === false && statusAlarmRain === false && statusAlarmFrost === false) {
                                        shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                        shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                    }
                                    shutterSettings[s].currentHeight = parseFloat(alarmFireLevel);
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                    shutterSettings[s].currentAction = 'fire';
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(alarmFireLevel), nameDevice, '#Shutter alarm fire');

                                    adapter.log.debug('shutter alarm fire ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                }
                                else if (typeof _shutterState !== undefined && _shutterState !== null && parseFloat(_shutterState.val) === parseFloat(alarmFireLevel)) {
                                    if (statusAlarmWind1 === false && statusAlarmWind2 === false && statusAlarmRain === false && statusAlarmFrost === false) {
                                        shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                        shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                    }
                                    shutterSettings[s].currentHeight = parseFloat(alarmFireLevel);
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                    shutterSettings[s].currentAction = 'fire';
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                    adapter.log.debug('shutter alarm fire ' + shutterSettings[s].shutterName + ' already at: ' + shutterSettings[s].currentHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                }
                            } else if (statusAlarmFire === false) {
                                adapter.log.info('Alarm fire endet for ID: ' + shutterSettings[s].shutterName + ' fire alarm is not driving back! - please init shutters with button "open all"');
                            }
                            await sleep(driveDelayUpAstro);
                            break;
                    }
                }
            }
        }
        clearTimeout(timerSleep);
        return (shutterSettings);
    }
}

// checks if an alarm is currently pending with exeption of frost alarm

async function checkPendingAlarm(adapter, Shutter) {
    return new Promise(async (resolve) => {
        if (Shutter.enableAlarmWind1 === true || Shutter.enableAlarmWind2 === true || Shutter.enableAlarmRain === true || Shutter.enableAlarmFire === true || Shutter.enableAlarmFrost === true) {
            adapter.log.debug('start pendingAlarm to check if an alarm is currently pending (exept frost)');
        }

        let statusAlarmWind1 = false;
        let statusAlarmWind2 = false;
        let statusAlarmRain = false;
        let statusAlarmFire = false;
        let resAlarmPending = false;

        try {
            const _statusAlarmWind1 = adapter.config.alarmWind1 !== '' ? await adapter.getForeignStateAsync(adapter.config.alarmWind1).catch((e) => adapter.log.warn(e)) : null;
            if (typeof _statusAlarmWind1 !== undefined && _statusAlarmWind1 !== null && _statusAlarmWind1.val) {
                statusAlarmWind1 = _statusAlarmWind1.val;
            }
            const _statusAlarmWind2 = adapter.config.alarmWind2 !== '' ? await adapter.getForeignStateAsync(adapter.config.alarmWind2).catch((e) => adapter.log.warn(e)) : null;
            if (typeof _statusAlarmWind2 !== undefined && _statusAlarmWind2 !== null && _statusAlarmWind2.val) {
                statusAlarmWind2 = _statusAlarmWind2.val;
            }

            const _statusAlarmRain = adapter.config.alarmRain !== '' ? await adapter.getForeignStateAsync(adapter.config.alarmRain).catch((e) => adapter.log.warn(e)) : null;
            if (typeof _statusAlarmRain !== undefined && _statusAlarmRain !== null && _statusAlarmRain.val) {
                statusAlarmRain = _statusAlarmRain.val;
            }

            const _statusAlarmFire = adapter.config.alarmFire !== '' ? await adapter.getForeignStateAsync(adapter.config.alarmFire).catch((e) => adapter.log.warn(e)) : null;
            if (typeof _statusAlarmFire !== undefined && _statusAlarmFire !== null && _statusAlarmFire.val) {
                statusAlarmFire = _statusAlarmFire.val;
            }
        } catch (e) {
            adapter.log.warn(`check pending alarm is not possible: ${e}`)
        }

        // check if alarm ist pending for the given shutter and return true if yes
        if ((statusAlarmWind1 === true && Shutter.enableAlarmWind1 === true) || (statusAlarmWind2 === true && Shutter.enableAlarmWind2 === true) || (statusAlarmRain === true && Shutter.enableAlarmRain === true) || (statusAlarmFire === true && Shutter.enableAlarmFire === true) || (Shutter.currentAction === 'fire')) {
            resAlarmPending = true;
        }

        if (Shutter.enableAlarmWind1 === true || Shutter.enableAlarmWind2 === true || Shutter.enableAlarmRain === true || Shutter.enableAlarmFire === true || Shutter.enableAlarmFrost === true) {
            adapter.log.debug('status alarm pending for ' + Shutter.name + ': ' + resAlarmPending);
        }
        resolve(resAlarmPending);
    });
}

// checks if frost alarm is currently true

async function checkFrostAlarm(adapter, Shutter) {
    return new Promise(async (resolve) => {
        if (Shutter.enableAlarmWind1 === true || Shutter.enableAlarmWind2 === true || Shutter.enableAlarmRain === true || Shutter.enableAlarmFire === true || Shutter.enableAlarmFrost === true) {
            adapter.log.debug('start checking frost alarm');
        }

        let resAlarmFrost = false;

        try {
            const _resAlarmFrost = adapter.config.alarmFrost !== '' ? await adapter.getForeignStateAsync(adapter.config.alarmFrost).catch((e) => adapter.log.warn(e)) : null;
            if (typeof _resAlarmFrost !== undefined && _resAlarmFrost !== null && _resAlarmFrost.val) {
                resAlarmFrost = _resAlarmFrost.val;
            }
        } catch (e) {
            adapter.log.warn(`check frost alarm is not possible: ${e}`)
        }

        if (Shutter.enableAlarmWind1 === true || Shutter.enableAlarmWind2 === true || Shutter.enableAlarmRain === true || Shutter.enableAlarmFire === true || Shutter.enableAlarmFrost === true) {
            adapter.log.debug('status frost alarm for ' + Shutter.name + ': ' + resAlarmFrost);
        }
        resolve(resAlarmFrost);
    });
}

module.exports = {
    shutterAlarm,
    checkPendingAlarm,
    checkFrostAlarm
};