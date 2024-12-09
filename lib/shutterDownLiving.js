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
 * @param [d]
 */
function getDate(d) {
    d = d || new Date();
    return `${(`0${d.getHours()}`).slice(-2)}:${(`0${d.getMinutes()}`).slice(-2)}`;
}

// @ts-ignore
async function driveshutterDownLiving(adapter, downTimeLiving, autoLivingStr, shutterSettings, livingType, driveDelayUpLiving, timeoutLivingAuto) {
    if (shutterSettings) {
        const resLiving = shutterSettings.filter((d) => d.typeDown == livingType); // Filter Area Living or living-auto
        const result = resLiving.filter((d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

        let number = 0;

        if (livingType == 'living') {
            for (const i in result) {
                number++;
            }
            timeoutLivingAuto = number * driveDelayUpLiving;
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

                    //xmas level or standard down level
                    targetLevel2Set = XmasLevel > -1 ? XmasLevel : targetLevel2Set;
                    downAction = XmasLevel > -1 ? 'Xmas' : downAction;

                    // save current required position to alarmtrigger before overwriting
                    shutterSettings[s].alarmTriggerLevel = targetLevel2Set;
                    shutterSettings[s].alarmTriggerAction = downAction;

                    // overwrite target position and downAction if frost alarm is set.
                    if (statusAlarmFrost == true &&
                        shutterSettings[s].enableAlarmFrost == true &&
                        downAction != 'Xmas') {

                        targetLevel2Set = parseFloat(adapter.config.alarmFrostLevel);
                        downAction = 'frost';
                    }

                    if (!inSummerNotDown) {
                        const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                        const _autoDownState = await adapter.getStateAsync(`shutters.autoDown.${nameDevice}`).catch((e) => adapter.log.warn(e));

                        if (_autoDownState?.val === true) {
                            if (pendingAlarm == false) {
                                const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;
                                const mustValue = (`${shutterSettings[s].triggerState}`);
                                const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? (`${shutterSettings[s].triggerState}`) : (`${shutterSettings[s].triggerStateTilted}`);
                                const currentValue = _triggerState?.val !== null && _triggerState?.val !== undefined ? (`${_triggerState.val}`) : '';

                                if (currentValue === mustValue ||
                                    currentValue === mustValueTilted ||
                                    (currentValue != mustValue &&
                                        currentValue != mustValueTilted &&
                                        shutterSettings[s].autoDrive != 'onlyUp' &&
                                        shutterSettings[s].autoDrive != 'off')) {

                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                    if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                        Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {

                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                        shutterSettings[s].currentAction = downAction;
                                        shutterSettings[s].lastAutoAction = 'Down_LivingTime';
                                        shutterSettings[s].triggerHeight = targetLevel2Set; // reset Trigger
                                        shutterSettings[s].triggerAction = downAction;      // reset Trigger

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Living down #17');

                                        adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                        adapter.log.debug(`shutterDownLiving #1 ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${targetLevel2Set}%`);
                                    } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                        Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set) {

                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                        shutterSettings[s].currentAction = downAction;

                                        await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                        adapter.log.debug(`shutterDownLiving #1 ${shutterSettings[s].shutterName} already down at: ${targetLevel2Set}% - setting current action: ${shutterSettings[s].currentAction}`);
                                    }
                                } else if (shutterSettings[s].triggerID == '') {
                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                    if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                        Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {

                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                        shutterSettings[s].currentAction = downAction;
                                        shutterSettings[s].lastAutoAction = 'Down_LivingTime';

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Living down #18');

                                        adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                        adapter.log.debug(`shutterDownLiving #2 ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${targetLevel2Set}%`);
                                    } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                        Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set) {

                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                        shutterSettings[s].currentAction = downAction;

                                        await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                        adapter.log.debug(`shutterDownLiving #2 ${shutterSettings[s].shutterName} already down at: ${targetLevel2Set}% - setting current action: ${shutterSettings[s].currentAction}`);
                                    }
                                } else if (currentValue != mustValue &&
                                    currentValue != mustValueTilted &&
                                    shutterSettings[s].driveAfterClose == true) {

                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                    if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                        Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {
                                        shutterSettings[s].triggerHeight = targetLevel2Set;
                                        shutterSettings[s].triggerAction = downAction;

                                        adapter.log.info(`#19 Will close ID: ${shutterSettings[s].shutterName} value: ${targetLevel2Set}%` + ` after the window has been closed `);
                                        adapter.log.debug(`save new trigger height: ${shutterSettings[s].triggerHeight}%`);
                                        adapter.log.debug(`save new trigger action: ${shutterSettings[s].triggerAction}`);
                                    }
                                }
                                await sleep(driveDelayUpLiving);
                            } else {
                                adapter.log.info(`Down living not moving now due to active alarm: ${shutterSettings[s].shutterName} value: ${targetLevel2Set}%`);
                            }
                        }
                    }
                }
            }
        }
        // start living-auto after drive living shutter
        if (autoLivingStr == true && livingType == 'living') {
            await sleep(timeoutLivingAuto);
            livingType = 'living-auto';
            driveshutterDownLiving(adapter, downTimeLiving, autoLivingStr, shutterSettings, livingType, driveDelayUpLiving, timeoutLivingAuto);
        } else {
            clearTimeout(timerSleep);
            return (shutterSettings);
        }
    }
}

// @ts-ignore
async function shutterDownLiving(adapter, downTimeLiving, autoLivingStr, shutterSettings) {
    adapter.log.debug('shutterDownLiving');

    const driveDelayUpLiving = adapter.config.driveDelayUpLiving != 0 ? adapter.config.driveDelayUpLiving * 1000 : 20;

    downTimeLiving = downTimeLiving == undefined ? adapter.config.W_shutterDownLiving : downTimeLiving;

    let livingType = 'living';
    let downTime = downTimeLiving.split(':');

    let timeoutLivingAuto = 0;

    schedule.cancelJob('shutterDownLiving');

    const downLiving = schedule.scheduleJob('shutterDownLiving', `${downTime[1]} ${downTime[0]} * * *`, async function () {
        driveshutterDownLiving(adapter, downTimeLiving, autoLivingStr, shutterSettings, livingType, driveDelayUpLiving, timeoutLivingAuto);
    });
}

module.exports = shutterDownLiving;