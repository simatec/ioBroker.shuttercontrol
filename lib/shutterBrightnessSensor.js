'use strict';

const checkPendingAlarm = require('./shutterAlarm.js').checkPendingAlarm;               // shutterAlarm
const checkFrostAlarm = require('./shutterAlarm.js').checkFrostAlarm;                   // shutterAlarm - check frost alarm
const CheckInSummerNotDown = require('./isSummerTime.js').CheckInSummerNotDown;         // Check is summer
const GetXmasLevel = require('./isSummerTime.js').GetXmasLevel;                         // Check is XMas
const setShutterState = require('./setShutter.js').setShutterState;                     // set Shutter State
const setShutterInfo = require('./setShutter.js').setShutterInfo;                       // set Shutter State

/**
 * @param {Date | undefined} [d]
 */
function getDate(d) {
    d = d || new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

/**
 * @param {{ config: { lightsensorDown: any; lightsensorUp: any; }; }} adapter
 * @param {number} brightnessValue
 * @param {boolean} brightnessDown
 */
function brightnessState(adapter, brightnessValue, brightnessDown) {
    const shutterDownBrightness = adapter.config.lightsensorDown;
    const shutterUpBrightness = adapter.config.lightsensorUp;
    const currentHour = new Date().getHours();

    if (currentHour > 12 && brightnessValue <= shutterDownBrightness) {
        brightnessDown = true;
        return (brightnessDown);
    } else if (currentHour <= 12 && brightnessValue > shutterUpBrightness) {
        brightnessDown = false;
        return (brightnessDown);
    } else {
        brightnessDown = false;
        return (brightnessDown);
    }
}

// @ts-ignore
async function shutterBrightnessSensor(adapter, brightnessValue, shutterSettings, brightnessDown) {
    const shutterDownBrightness = adapter.config.lightsensorDown;
    const shutterUpBrightness = adapter.config.lightsensorUp;
    const driveDelayAstro = adapter.config.driveDelayUpAstro != 0 ? adapter.config.driveDelayUpAstro * 1000 : 2000;
    const currentHour = new Date().getHours();

    if (currentHour > 12 && brightnessValue <= shutterDownBrightness && brightnessDown == false) {
        if (shutterSettings) {
            const resLiving = shutterSettings.filter((/** @type {{ typeDown: string; }} */ d) => d.typeDown == 'lightsensor'); // Filter Area Living
            const result = resLiving.filter((/** @type {{ enabled: boolean; }} */ d) => d.enabled === true); // Filter enabled

            for (const i in result) {
                for (const s in shutterSettings) {
                    if (shutterSettings[s].shutterName == result[i].shutterName) {
                        const inSummerNotDown = CheckInSummerNotDown(adapter, shutterSettings[s]);
                        const XmasLevel = GetXmasLevel(adapter, shutterSettings[s]);
                        const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                        let pendingAlarm = false;

                        checkPendingAlarm(adapter, shutterSettings[s], async function (/** @type {boolean} */ resAlarmPending) {
                            pendingAlarm = resAlarmPending;

                            let statusAlarmFrost = false;

                            checkFrostAlarm(adapter, shutterSettings[s], async function (/** @type {boolean} */ resAlarmFrost) {
                                statusAlarmFrost = resAlarmFrost;
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

                                targetLevel2Set = XmasLevel > -1 ? XmasLevel : targetLevel2Set; // xmas level or standard down level
                                downAction = XmasLevel > -1 ? 'Xmas' : downAction; // xmas Action or standard down Action

                                // save current required position to alarmtrigger before overwriting
                                shutterSettings[s].alarmTriggerLevel = targetLevel2Set;
                                shutterSettings[s].alarmTriggerAction = downAction;

                                // overwrite target position and downAction if frost alarm is set.
                                if (statusAlarmFrost == true && shutterSettings[s].enableAlarmFrost == true) {
                                    targetLevel2Set = parseFloat(adapter.config.alarmFrostLevel);
                                    downAction = 'frost';
                                }

                                if (!inSummerNotDown) {
                                    const _autoDownState = await adapter.getStateAsync(`shutters.autoDown.${nameDevice}`);

                                    if (_autoDownState && _autoDownState === true || _autoDownState && _autoDownState.val === true) {
                                        if (shutterSettings[s].currentAction != 'triggered' || shutterSettings[s].currentAction != 'triggered_Tilted' || shutterSettings[s].currentAction != 'down') {
                                            if (pendingAlarm == false) {
                                                setTimeout(async function () {
                                                    let currentValue = '';

                                                    const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID) : null;

                                                    const mustValue = ('' + shutterSettings[s].triggerState);
                                                    const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                                    if (typeof _triggerState != undefined && _triggerState != null) {
                                                        currentValue = ('' + _triggerState.val);
                                                    }
                                                    if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyUp' && shutterSettings[s].autoDrive != 'off')) {
                                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name);

                                                        if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != targetLevel2Set && shutterSettings[s].triggerAction != 'down') {
                                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                                            shutterSettings[s].currentAction = downAction;
                                                            shutterSettings[s].lastAutoAction = 'Down_Brightness';

                                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Lightsensor #8');

                                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                            adapter.log.debug(`save current height: ${shutterSettings[s].currentHeight}% from ${shutterSettings[s].shutterName}`);
                                                            return (shutterSettings);
                                                        }
                                                        else if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val == targetLevel2Set && (shutterSettings[s].currentHeight != targetLevel2Set || shutterSettings[s].currentAction != downAction)) {
                                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                                            shutterSettings[s].currentAction = downAction;

                                                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                                            adapter.log.debug(`Lightsensor down ${shutterSettings[s].shutterName} already down at: ${targetLevel2Set}% - setting current action: ${shutterSettings[s].currentAction}`);
                                                            return (shutterSettings);
                                                        }
                                                    } else if (shutterSettings[s].triggerID == '') {
                                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name);

                                                        if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != targetLevel2Set && (_shutterState.val == shutterSettings[s].heightDownSun || _shutterState.val == shutterSettings[s].heightUp || _shutterState.val == shutterSettings[s].triggerDrive)) {
                                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                                            shutterSettings[s].currentAction = downAction;
                                                            shutterSettings[s].lastAutoAction = 'Down_Brightness';

                                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Lightsensor #9');

                                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                            adapter.log.debug(`save current height: ${shutterSettings[s].currentHeight}% from ${shutterSettings[s].shutterName}`);
                                                            return (shutterSettings);
                                                        }
                                                        else if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val == targetLevel2Set && (shutterSettings[s].currentHeight != targetLevel2Set || shutterSettings[s].currentAction != downAction)) {
                                                            shutterSettings[s].currentHeight = targetLevel2Set;
                                                            shutterSettings[s].currentAction = downAction;

                                                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                                            adapter.log.debug(`Lightsensor down ${shutterSettings[s].shutterName} already down at: ${targetLevel2Set}% - setting current action: ${shutterSettings[s].currentAction}`);
                                                            return (shutterSettings);
                                                        }

                                                    } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name);

                                                        if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != targetLevel2Set && (_shutterState.val == shutterSettings[s].heightDownSun || _shutterState.val == shutterSettings[s].heightUp || _shutterState.val == shutterSettings[s].triggerDrive)) {
                                                            shutterSettings[s].triggerHeight = targetLevel2Set;
                                                            shutterSettings[s].triggerAction = downAction;

                                                            adapter.log.info(`Lightsensor #4 Will close ID: ${shutterSettings[s].shutterName} value: ${targetLevel2Set}% after the window has been closed`);
                                                            adapter.log.debug(`save new trigger height: ${targetLevel2Set}%`);
                                                            adapter.log.debug(`save new trigger action: ${shutterSettings[s].triggerAction}`);
                                                            return (shutterSettings);
                                                        }
                                                    }
                                                    // @ts-ignore
                                                }, driveDelayAstro * i, i);
                                            } else {
                                                adapter.log.info(`Brighness down not moving now due to active alarm: ${shutterSettings[s].shutterName} value: ${targetLevel2Set}%`);
                                            }
                                        }
                                    }
                                }
                            });
                        });
                    }
                }
            }
        }
    } else if (currentHour <= 12 && brightnessValue > shutterUpBrightness) {
        if (shutterSettings) {
            const resLiving = shutterSettings.filter((/** @type {{ typeUp: string; }} */ d) => d.typeUp == 'lightsensor'); // Filter Area Living
            const result = resLiving.filter((/** @type {{ enabled: boolean; }} */ d) => d.enabled === true); // Filter enabled

            for (const i in result) {
                for (const s in shutterSettings) {
                    if (shutterSettings[s].shutterName == result[i].shutterName) {
                        const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                        let pendingAlarm = false;

                        checkPendingAlarm(adapter, shutterSettings[s], async function (/** @type {boolean} */ resAlarmPending) {
                            pendingAlarm = resAlarmPending;
                            const _autoUpState = await adapter.getStateAsync(`shutters.autoUp.${nameDevice}`);

                            if (_autoUpState && _autoUpState === true || _autoUpState && _autoUpState.val === true) {
                                if (pendingAlarm == false) {
                                    setTimeout(async function () {
                                        let shutterHeight = 0;
                                        if (shutterSettings[s].currentAction == 'sunProtect' || shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                            shutterHeight = parseFloat(shutterSettings[s].heightDownSun);
                                            shutterSettings[s].currentAction = 'sunProtect';
                                        } else {
                                            shutterHeight = parseFloat(shutterSettings[s].heightUp);
                                            shutterSettings[s].currentAction = 'up';
                                        }

                                        // saving current required values to alarmtrigger
                                        shutterSettings[s].alarmTriggerLevel = shutterHeight;
                                        shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;

                                        let currentValue = '';

                                        const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID) : null;
                                        const mustValue = ('' + shutterSettings[s].triggerState);
                                        const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                        if (typeof _triggerState != undefined && _triggerState != null) {
                                            currentValue = ('' + _triggerState.val);
                                        }

                                        if (pendingAlarm == false) {
                                            if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyDown' && shutterSettings[s].autoDrive != 'off')) {
                                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name);

                                                if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != shutterHeight) {
                                                    shutterSettings[s].currentHeight = shutterHeight;
                                                    shutterSettings[s].lastAutoAction = 'up_Brightness';

                                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], shutterHeight, nameDevice, 'Lightsensor #5');

                                                    adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                    adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                                    return (shutterSettings);
                                                }
                                                else if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val == shutterHeight) {
                                                    shutterSettings[s].currentHeight = shutterHeight;
                                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                                    adapter.log.debug(`Lightsensor up ${shutterSettings[s].shutterName} already up at: ${shutterSettings[s].heightUp}% - setting current action: ${shutterSettings[s].currentAction}`);
                                                    return (shutterSettings);
                                                }

                                            } else if (shutterSettings[s].triggerID == '') {
                                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name);

                                                if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != shutterHeight) {
                                                    shutterSettings[s].currentHeight = shutterHeight;
                                                    shutterSettings[s].lastAutoAction = 'up_Brightness';

                                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], shutterHeight, nameDevice, 'Lightsensor #6');

                                                    adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                    adapter.log.debug(`save current height: ${shutterSettings[s].currentHeight}% from ${shutterSettings[s].shutterName}`);
                                                    return (shutterSettings);
                                                }
                                                else if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val == shutterHeight) {
                                                    shutterSettings[s].currentHeight = shutterHeight;
                                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                                    adapter.log.debug(`Lightsensor up ${shutterSettings[s].shutterName} already up at: ${shutterSettings[s].heightUp}% - setting current action: ${shutterSettings[s].currentAction}`);
                                                    return (shutterSettings);
                                                }

                                            } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name);

                                                if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != shutterHeight) {
                                                    shutterSettings[s].triggerHeight = shutterHeight;
                                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                                    adapter.log.info(`Lightsensor #7 Will open ID: ${shutterSettings[s].shutterName} value: ${shutterHeight}% after the window has been closed`);
                                                    adapter.log.debug(`save new trigger height: ${shutterHeight}%`);
                                                    adapter.log.debug(`save new trigger action: ${shutterSettings[s].triggerAction}`);
                                                    return (shutterSettings);
                                                }
                                            }
                                        }
                                        // @ts-ignore
                                    }, driveDelayAstro * i, i);
                                } else {
                                    let shutterHeight = 0;
                                    if (shutterSettings[s].currentAction == 'sunProtect' || shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                        shutterHeight = parseFloat(shutterSettings[s].heightDownSun);
                                    } else {
                                        shutterHeight = parseFloat(shutterSettings[s].heightUp);
                                    }
                                    adapter.log.info(`Brighness up not moving now due to active alarm: ${shutterSettings[s].shutterName} value: ${shutterHeight}%`);
                                }
                            }
                        });
                    }
                }
            }
        }
    }
}

module.exports = {
    shutterBrightnessSensor,
    brightnessState
};