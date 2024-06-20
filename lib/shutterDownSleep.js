'use strict';

// @ts-ignore
const schedule = require('node-schedule');
const checkPendingAlarm = require('./shutterAlarm.js').checkPendingAlarm;           // shutterAlarm
const checkFrostAlarm = require('./shutterAlarm.js').checkFrostAlarm;               // shutterAlarm - check frost alarm
const setShutterState = require('./setShutter.js').setShutterState;                 // set Shutter State
const setShutterInfo = require('./setShutter.js').setShutterInfo;                   // set Shutter State
const CheckInSummerNotDown = require('./isSummerTime.js').CheckInSummerNotDown;     // check Summer time
const GetXmasLevel = require('./isSummerTime.js').GetXmasLevel;                     // Check Xmas Time

let timerSleep = 0;

async function sleep(ms) {
    return new Promise(async (resolve) => {
        // @ts-ignore
        timerSleep = setTimeout(async () => resolve(), ms);
    });
}

/**
 * @param {Date | undefined} [d]
 */
function getDate(d) {
    d = d || new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

// @ts-ignore
async function driveshutterDownSleep(adapter, downTimeSleep, autoSleepStr, shutterSettings, sleepType, driveDelayUpSleep, timeoutSleepAuto) {
    if (shutterSettings) {
        const resSleep = shutterSettings.filter((/** @type {{ typeDown: any; }} */ d) => d.typeDown == sleepType); // Filter Area sleep
        const result = resSleep.filter((/** @type {{ enabled: boolean | string; }} */ d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

        let number = 0;

        if (sleepType == 'sleep') {
            for (const i in result) {
                number++;
            }
            timeoutSleepAuto = number * driveDelayUpSleep;
        }

        for (const i in result) {
            for (const s in shutterSettings) {
                if (shutterSettings[s].shutterName == result[i].shutterName) {
                    const inSummerNotDown = await CheckInSummerNotDown(adapter, shutterSettings[s]);
                    const XmasLevel = await GetXmasLevel(adapter, shutterSettings[s]);

                    let targetLevel2Set = 0;
                    let downAction = 'down';

                    const pendingAlarm = await checkPendingAlarm(adapter, shutterSettings[s]);
                    const statusAlarmFrost = await checkFrostAlarm(adapter, shutterSettings[s]);

                    if (getDate() < adapter.config.betweenPositionTime) {
                        // between Position Level
                        targetLevel2Set = shutterSettings[s].betweenPosition == true ? parseFloat(shutterSettings[s].betweenPositionLevel) : parseFloat(shutterSettings[s].heightDown);
                        downAction = shutterSettings[s].betweenPosition == true ? 'middle' : 'down';
                    } else {
                        targetLevel2Set = parseFloat(shutterSettings[s].heightDown);
                        downAction = 'down';
                    }

                    // xmas level or standard down level
                    targetLevel2Set = XmasLevel > -1 ? XmasLevel : targetLevel2Set;
                    downAction = XmasLevel > -1 ? 'Xmas' : downAction;

                    // save current required position to alarmtrigger before overwriting
                    shutterSettings[s].alarmTriggerLevel = targetLevel2Set;
                    shutterSettings[s].alarmTriggerAction = downAction;

                    // overwrite target position and downAction if frost alarm is set.
                    if (statusAlarmFrost == true && shutterSettings[s].enableAlarmFrost == true && downAction != 'Xmas') {
                        targetLevel2Set = parseFloat(adapter.config.alarmFrostLevel);
                        downAction = 'frost';
                    }

                    if (!inSummerNotDown) {
                        const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                        const _autoDownState = await adapter.getStateAsync(`shutters.autoDown.${nameDevice}`).catch((e) => adapter.log.warn(e));

                        if (_autoDownState && _autoDownState === true || _autoDownState && _autoDownState.val === true) {
                            if (pendingAlarm == false) {
                                let currentValue = '';

                                const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;

                                const mustValue = ('' + shutterSettings[s].triggerState);
                                const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                if (typeof _triggerState != undefined && _triggerState != null) {
                                    currentValue = ('' + _triggerState.val);
                                }

                                if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyUp' && shutterSettings[s].autoDrive != 'off')) {
                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != targetLevel2Set) {
                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                        shutterSettings[s].currentAction = downAction;
                                        shutterSettings[s].lastAutoAction = 'Down_SleepTime';
                                        shutterSettings[s].triggerHeight = targetLevel2Set; // reset Trigger
                                        shutterSettings[s].triggerAction = downAction;      // reset Trigger

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Sleep down #26');

                                        adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                        adapter.log.debug('shutterDownSleep #1 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                    }
                                    else if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set) {
                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                        shutterSettings[s].currentAction = downAction;
                                        shutterSettings[s].triggerHeight = targetLevel2Set; // reset Trigger
                                        shutterSettings[s].triggerAction = downAction;      // reset Trigger

                                        await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                        adapter.log.debug('shutterDownSleep #1 ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                    }
                                } else if (shutterSettings[s].triggerID == '') {
                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                    if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {
                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                        shutterSettings[s].currentAction = downAction;
                                        shutterSettings[s].lastAutoAction = 'Down_SleepTime';

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Sleep down #27');

                                        adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                        adapter.log.debug('shutterDownSleep #2 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                    }
                                    else if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set) {
                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                        shutterSettings[s].currentAction = downAction;

                                        await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                        adapter.log.debug('shutterDownSleep #2 ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                    }
                                } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                    if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {
                                        shutterSettings[s].triggerHeight = targetLevel2Set;
                                        shutterSettings[s].triggerAction = downAction;

                                        adapter.log.info('#28 Will close ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%' + ' after the window has been closed ');
                                        adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                        adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                    }
                                }
                                await sleep(driveDelayUpSleep);
                            } else {
                                adapter.log.info('Down sleep not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                            }
                        }
                    }
                }
            }
        }
        // start sleep-auto after drive sleep shutter
        if (autoSleepStr == true && sleepType == 'sleep') {
            await sleep(timeoutSleepAuto);
            sleepType = 'sleep-auto';
            driveshutterDownSleep(adapter, downTimeSleep, autoSleepStr, shutterSettings, sleepType, driveDelayUpSleep, timeoutSleepAuto);
        } else {
            clearTimeout(timerSleep);
            return (shutterSettings);
        }
    }


}

// @ts-ignore
async function shutterDownSleep(adapter, downTimeSleep, delayDown, autoSleepStr, shutterSettings) {
    const driveDelayUpSleep = adapter.config.driveDelayUpSleep != 0 ? adapter.config.driveDelayUpSleep * 1000 : 20;
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving != 0 ? adapter.config.driveDelayUpLiving * 1000 : 20;

    downTimeSleep = downTimeSleep == undefined ? adapter.config.W_shutterDownSleep : downTimeSleep;

    let sleepType = 'sleep';
    let downTime = downTimeSleep.split(':');
    let timeoutSleepAuto = 0;

    schedule.cancelJob('shutterDownSleep');

    // @ts-ignore
    const downSleep = schedule.scheduleJob('shutterDownSleep', downTime[1] + ' ' + downTime[0] + ' * * *', async function () {
        delayDown = delayDown * driveDelayUpLiving;

        await sleep(delayDown);
        driveshutterDownSleep(adapter, downTimeSleep, autoSleepStr, shutterSettings, sleepType, driveDelayUpSleep, timeoutSleepAuto);
    });
}
module.exports = shutterDownSleep;