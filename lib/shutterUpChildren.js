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
async function driveshutterUpChildren(adapter, upTimeChildren, autoChildrenStr, shutterSettings, childrenType, driveDelayUpChildren, timeoutChildrenAuto, noGoDelay) {
    if (shutterSettings) {
        adapter.log.debug(`Children-type: ${childrenType}`);

        const resChildren = shutterSettings.filter((/** @type {{ typeUp: string; }} */ d) => d.typeUp == childrenType); // Filter Area Children
        const result = resChildren.filter((/** @type {{ enabled: boolean | string; }} */ d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

        let number = 0;

        if (childrenType === 'children') {
            for (const i in result) {
                number++;
            }
            timeoutChildrenAuto = number !== 0 ? number * driveDelayUpChildren : driveDelayUpChildren;
        }

        for (const i in result) {
            for (const s in shutterSettings) {
                if (shutterSettings[s].shutterName == result[i].shutterName) {
                    const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                    const pendingAlarm = await checkPendingAlarm(adapter, shutterSettings[s]);

                    const _autoUpState = await adapter.getStateAsync(`shutters.autoUp.${nameDevice}`).catch((e) => adapter.log.warn(e));

                    if (_autoUpState?.val === true) {
                        let shutterHeight = 0;
                        if (shutterSettings[s].currentAction == 'sunProtect' ||
                            shutterSettings[s].currentAction == 'OpenInSunProtect') {

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
                            const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;
                            const mustValue = ('' + shutterSettings[s].triggerState);
                            const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);
                            const currentValue = _triggerState?.val !== null && _triggerState?.val !== undefined ? ('' + _triggerState.val) : '';

                            if (currentValue === mustValue ||
                                currentValue === mustValueTilted ||
                                (currentValue != mustValue &&
                                    currentValue != mustValueTilted &&
                                    shutterSettings[s].autoDrive != 'onlyDown' &&
                                    shutterSettings[s].autoDrive != 'off')) {

                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                if (_shutterState?.val !== null && _shutterState?.val !== undefined && 
                                    Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterHeight && 
                                    Date.now() >= (_shutterState.lc + noGoDelay)) {

                                    shutterSettings[s].currentHeight = shutterHeight;
                                    shutterSettings[s].lastAutoAction = 'up_ChidrenTime';
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight; // reset Trigger
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction; // reset Trigger

                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], shutterHeight, nameDevice, 'Children Up #21');

                                    adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                    adapter.log.debug('shutterUpChildren #1 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                }
                                else if (_shutterState?.val !== null && _shutterState?.val !== undefined && 
                                    Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterHeight && 
                                    Date.now() >= (_shutterState.lc + noGoDelay)) {

                                    shutterSettings[s].currentHeight = shutterHeight;
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight; // reset Trigger
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction; // reset Trigger

                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                    adapter.log.debug('shutterUpChildren #1 ' + shutterSettings[s].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                }
                            } else if (shutterSettings[s].triggerID == '') {
                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                if (_shutterState?.val !== null && _shutterState?.val !== undefined && 
                                    Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterHeight && 
                                    Date.now() >= (_shutterState.lc + noGoDelay)) {

                                    shutterSettings[s].currentHeight = shutterHeight;
                                    shutterSettings[s].lastAutoAction = 'up_ChidrenTime';

                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], shutterHeight, nameDevice, 'Children Up #22');

                                    adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                    adapter.log.debug('shutterUpChildren #2 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterHeight + '%');
                                }
                                else if (_shutterState?.val !== null && _shutterState?.val !== undefined && 
                                    Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterHeight && 
                                    Date.now() >= (_shutterState.lc + noGoDelay)) {

                                    shutterSettings[s].currentHeight = shutterHeight;

                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                    adapter.log.debug('shutterUpChildren #2 ' + shutterSettings[s].shutterName + ' already up at: ' + shutterHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                }
                            } else if (currentValue != mustValue && 
                                currentValue != mustValueTilted && 
                                shutterSettings[s].driveAfterClose == true) {

                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                if (_shutterState?.val !== null && _shutterState?.val !== undefined && Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterHeight) {
                                    shutterSettings[s].triggerHeight = shutterHeight;
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    adapter.log.info('#23 Will open ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%' + ' after the window has been closed ');
                                    adapter.log.debug('save new trigger height: ' + shutterHeight + '%');
                                    adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterHeight) {

                                    shutterSettings[s].triggerHeight = shutterHeight;
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    adapter.log.info(`#24 Will open ID: ${shutterSettings[s].shutterName} value: ${shutterHeight}% after is the value for Children up`);
                                    adapter.log.debug(`save new trigger height: ${shutterHeight}%`);
                                    adapter.log.debug(`save new trigger action: ${shutterSettings[s].triggerAction}`);
                                }
                            }
                        } else {
                            adapter.log.info('Children up not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterHeight + '%');
                        }
                        await sleep(driveDelayUpChildren);
                    }
                }
            }
        }
        adapter.log.debug(`Adapter Auto-Children is: ${autoChildrenStr}`);

        // start children-auto after drive children shutter
        if ((autoChildrenStr === true || 
            autoChildrenStr === 'true') && 
            childrenType === 'children') {
                
            await sleep(timeoutChildrenAuto);
            childrenType = 'children-auto';
            driveshutterUpChildren(adapter, upTimeChildren, autoChildrenStr, shutterSettings, childrenType, driveDelayUpChildren, timeoutChildrenAuto, noGoDelay);
        } else {
            clearTimeout(timerSleep);
            return (shutterSettings);
        }
    }
}

// @ts-ignore
async function shutterUpChildren(adapter, upTimeChildren, delayUp, autoChildrenStr, shutterSettings) {
    const driveDelayUpChildren = adapter.config.driveDelayUpChildren != 0 ? adapter.config.driveDelayUpChildren * 1000 : 20;
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving != 0 ? adapter.config.driveDelayUpLiving * 1000 : 20;
    const noGoDelay = adapter.config.noGoTime * 1000 * 60;

    upTimeChildren = upTimeChildren == undefined ? adapter.config.W_shutterUpChildrenMax : upTimeChildren;

    let childrenType = 'children';
    let upTime;

    try {
        upTime = upTimeChildren.split(':');
    } catch (e) {
        adapter.log.debug('Uptime for the childrenarea is not defined ... Please check your config!!');
    }

    let timeoutChildrenAuto = 0;

    schedule.cancelJob('shutterUpChildren');

    try {
        const upChildren = schedule.scheduleJob('shutterUpChildren', upTime[1] + ' ' + upTime[0] + ' * * *', async function () {
            delayUp = delayUp * driveDelayUpLiving;
            await sleep(delayUp);
            driveshutterUpChildren(adapter, upTimeChildren, autoChildrenStr, shutterSettings, childrenType, driveDelayUpChildren, timeoutChildrenAuto, noGoDelay);
        });
    } catch (e) {
        adapter.log.debug('error on uptime for childrenarea ... please check your config!!');
    }
}
module.exports = shutterUpChildren;