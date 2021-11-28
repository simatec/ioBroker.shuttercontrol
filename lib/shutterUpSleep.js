'use strict';

// @ts-ignore
const schedule = require('node-schedule');
const checkPendingAlarm = require('./shutterAlarm.js').checkPendingAlarm;           // shutterAlarm
const setShutterState = require('./setShutter.js').setShutterState;                 // set Shutter State
const setShutterInfo = require('./setShutter.js').setShutterInfo;                   // set Shutter State

// @ts-ignore
async function driveshutterUpSleep(adapter, upTimeSleep, autoSleepStr, shutterSettings, sleepType, driveDelayUpSleep, timeoutSleepAuto, noGoDelay) {
    if (shutterSettings) {

        const resSleep = shutterSettings.filter((/** @type {{ typeUp: any; }} */ d) => d.typeUp == sleepType); // Filter Area sleep
        let result = resSleep.filter((/** @type {{ enabled: boolean; }} */ d) => d.enabled === true); // Filter enabled
        ;
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
                    const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                    const pendingAlarm = await checkPendingAlarm(adapter, shutterSettings[s]);

                    const _autoUpState = await adapter.getStateAsync(`shutters.autoUp.${nameDevice}`);

                    if (_autoUpState && _autoUpState === true || _autoUpState && _autoUpState.val === true) {
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

                            if (!pendingAlarm) {
                                let currentValue = '';

                                const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID) : null;

                                let mustValue = ('' + shutterSettings[s].triggerState);
                                let mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                if (typeof _triggerState != undefined && _triggerState != null) {
                                    currentValue = ('' + _triggerState.val);
                                }

                                if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyDown' && shutterSettings[s].autoDrive != 'off')) {
                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name);

                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != shutterHeight && Date.now() >= (_shutterState.lc + noGoDelay)) {
                                        shutterSettings[s].currentHeight = shutterHeight;
                                        shutterSettings[s].lastAutoAction = 'up_SleepTime';

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], shutterHeight, nameDevice, 'Sleep up #21');

                                        adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                        adapter.log.debug('shutterUpSleep #1 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                        return (shutterSettings);
                                    }
                                    else if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val == shutterHeight && Date.now() >= (_shutterState.lc + noGoDelay)) {
                                        shutterSettings[s].currentHeight = shutterHeight;

                                        await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                        adapter.log.debug('shutterUpSleep #1 ' + shutterSettings[s].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                        return (shutterSettings);
                                    }
                                } else if (shutterSettings[s].triggerID == '') {
                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name);

                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != shutterHeight && Date.now() >= (_shutterState.lc + noGoDelay)) {
                                        shutterSettings[s].currentHeight = shutterHeight;
                                        shutterSettings[s].lastAutoAction = 'up_SleepTime';
                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], shutterHeight, nameDevice, 'Sleep up #22');

                                        adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                        adapter.log.debug('shutterUpSleep #2 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                        return (shutterSettings);
                                    }
                                    else if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val == shutterHeight && Date.now() >= (_shutterState.lc + noGoDelay)) {
                                        shutterSettings[s].currentHeight = shutterHeight;

                                        await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                        adapter.log.debug('shutterUpSleep #2 ' + shutterSettings[s].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                        return (shutterSettings);
                                    }
                                } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name);

                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != shutterHeight) {
                                        shutterSettings[s].triggerHeight = shutterHeight;
                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                        adapter.log.info('#23 Will open ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%' + ' after the window has been closed ');
                                        adapter.log.debug('save new trigger height: ' + shutterHeight + '%');
                                        adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                        return (shutterSettings);
                                    }
                                }
                            } else {
                                adapter.log.info('Sleep up not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                            }
                            // @ts-ignore
                        }, driveDelayUpSleep * i, i);
                    }
                }
            }
        }
    }

    // start sleep-auto after drive sleep shutter
    if (autoSleepStr == true && sleepType == 'sleep') {
        setTimeout(async function () {
            sleepType = 'sleep-auto';
            driveshutterUpSleep(adapter, upTimeSleep, autoSleepStr, shutterSettings, sleepType, driveDelayUpSleep, timeoutSleepAuto, noGoDelay);
        }, timeoutSleepAuto);
    }
}

// @ts-ignore
async function shutterUpSleep(adapter, upTimeSleep, delayUp, autoSleepStr, shutterSettings) {
    const driveDelayUpSleep = adapter.config.driveDelayUpSleep != 0 ? adapter.config.driveDelayUpSleep * 1000 : 2000;
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving != 0 ? adapter.config.driveDelayUpLiving * 1000 : 2000;
    const noGoDelay = adapter.config.noGoTime * 1000 * 60;

    upTimeSleep = upTimeSleep == undefined ? adapter.config.W_shutterUpSleepMax : upTimeSleep;

    let sleepType = 'sleep';
    let upTime = upTimeSleep.split(':');
    let timeoutSleepAuto = 0;

    schedule.cancelJob('shutterUpSleep');

    const upSleep = schedule.scheduleJob('shutterUpSleep', upTime[1] + ' ' + upTime[0] + ' * * *', async function () {
        delayUp = delayUp * driveDelayUpLiving;
        setTimeout(async function () {
            driveshutterUpSleep(adapter, upTimeSleep, autoSleepStr, shutterSettings, sleepType, driveDelayUpSleep, timeoutSleepAuto, noGoDelay);
        }, delayUp);
    });
}

module.exports = shutterUpSleep;