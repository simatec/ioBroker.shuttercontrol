'use strict';

// @ts-ignore
const schedule = require('node-schedule');
const checkPendingAlarm = require('./shutterAlarm.js').checkPendingAlarm;           // shutterAlarm
const setShutterState = require('./setShutter.js').setShutterState;                 // set Shutter State
const setShutterInfo = require('./setShutter.js').setShutterInfo;                   // set Shutter State

let timerSleep = 0;

async function sleep(ms) {
    return new Promise(async (resolve) => {
        // @ts-ignore
        timerSleep = setTimeout(async () => resolve(), ms);
    });
}

// @ts-ignore
async function driveshutterUpLiving(adapter, upTimeLiving, autoLivingStr, shutterSettings, livingType, driveDelayUpLiving, timeoutLivingAuto, noGoDelay) {
    if (shutterSettings) {
        adapter.log.debug(`Living-type: ${livingType}`);

        const resLiving = shutterSettings.filter((/** @type {{ typeUp: string; }} */ d) => d.typeUp == livingType); // Filter Area Living
        const result = resLiving.filter((/** @type {{ enabled: boolean; }} */ d) => d.enabled === true); // Filter enabled

        let number = 0;

        if (livingType === 'living') {
            for (const i in result) {
                number++;
            }
            timeoutLivingAuto = number !== 0 ? number * driveDelayUpLiving: driveDelayUpLiving;
        }

        for (const i in result) {
            for (const s in shutterSettings) {
                if (shutterSettings[s].shutterName == result[i].shutterName) {
                    const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                    const pendingAlarm = await checkPendingAlarm(adapter, shutterSettings[s]);

                    const _autoUpState = await adapter.getStateAsync(`shutters.autoUp.${nameDevice}`).catch((e) => adapter.log.warn(e));

                    if (_autoUpState && _autoUpState === true || _autoUpState && _autoUpState.val === true) {
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

                        if (pendingAlarm == false) {
                            let currentValue = '';

                            const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;

                            let mustValue = ('' + shutterSettings[s].triggerState);
                            let mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                            if (typeof _triggerState != undefined && _triggerState != null) {
                                currentValue = ('' + _triggerState.val);
                            }

                            if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyDown' && shutterSettings[s].autoDrive != 'off')) {
                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterHeight && Date.now() >= (_shutterState.lc + noGoDelay)) {
                                    shutterSettings[s].currentHeight = shutterHeight;
                                    shutterSettings[s].lastAutoAction = 'up_LivingTime';
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight; // reset Trigger
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction; // reset Trigger

                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], shutterHeight, nameDevice, 'Living up #13');

                                    adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                    adapter.log.debug('shutterUpLiving #1 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                }
                                else if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterHeight && Date.now() >= (_shutterState.lc + noGoDelay)) {
                                    shutterSettings[s].currentHeight = shutterHeight;
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight; // reset Trigger
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction; // reset Trigger

                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                    adapter.log.debug('shutterUpLiving #1 ' + shutterSettings[s].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                }
                            } else if (shutterSettings[s].triggerID == '') {
                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterHeight && Date.now() >= (_shutterState.lc + noGoDelay)) {
                                    shutterSettings[s].currentHeight = shutterHeight;
                                    shutterSettings[s].lastAutoAction = 'up_LivingTime';

                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], shutterHeight, nameDevice, 'Living up #13');

                                    adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                    adapter.log.debug('shutterUpLiving #2 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                }
                                else if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterHeight && Date.now() >= (_shutterState.lc + noGoDelay)) {
                                    shutterSettings[s].currentHeight = shutterHeight;

                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                    adapter.log.debug('shutterUpLiving #2 ' + shutterSettings[s].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                }
                            } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                if (typeof _shutterState != undefined && _shutterState != null && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterSettings[s].shutterHeight) {
                                    shutterSettings[s].triggerHeight = shutterHeight;
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    adapter.log.info('#15 Will open ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%' + ' after the window has been closed ');
                                    adapter.log.debug('save new trigger height: ' + shutterHeight + '%');
                                    adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                }
                            }
                        } else {
                            adapter.log.info('Living up not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                        }
                        await sleep(driveDelayUpLiving);
                    }
                }
            }
        }
        // start living-auto after drive living shutter
        if ((autoLivingStr === true || autoLivingStr === 'true') && livingType === 'living') {
            await sleep(timeoutLivingAuto);
            livingType = 'living-auto';
            driveshutterUpLiving(adapter, upTimeLiving, autoLivingStr, shutterSettings, livingType, driveDelayUpLiving, timeoutLivingAuto, noGoDelay);
        } else {
            clearTimeout(timerSleep);
            return (shutterSettings);
        }
    }
}

// @ts-ignore
/**
 * @param {boolean} autoLivingStr
 */
async function shutterUpLiving(adapter, upTimeLiving, autoLivingStr, shutterSettings) {
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving != 0 ? adapter.config.driveDelayUpLiving * 1000 : 20;
    const noGoDelay = adapter.config.noGoTime * 1000 * 60;

    upTimeLiving = upTimeLiving == undefined ? adapter.config.W_shutterUpLivingMax : upTimeLiving;

    let livingType = 'living';
    let upTime = upTimeLiving.split(':');
    let timeoutLivingAuto = 0;

    schedule.cancelJob('shutterUpLiving');

    const upLiving = schedule.scheduleJob('shutterUpLiving', upTime[1] + ' ' + upTime[0] + ' * * *', async function () {
        driveshutterUpLiving(adapter, upTimeLiving, autoLivingStr, shutterSettings, livingType, driveDelayUpLiving, timeoutLivingAuto, noGoDelay);
    });
}

module.exports = shutterUpLiving;