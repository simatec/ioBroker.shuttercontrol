'use strict';

const checkFrostAlarm = require('./shutterAlarm.js').checkFrostAlarm;       // shutterAlarm - check frost alarm
const setShutterState = require('./setShutter.js').setShutterState;         // set Shutter State
const setShutterInfo = require('./setShutter.js').setShutterInfo;           // set Shutter State

let timerSleep = 0;

async function sleep(ms) {
    return new Promise(async (resolve) => {
        // @ts-ignore
        timerSleep = setTimeout(async () => resolve(), ms);
    });
}

// @ts-ignore
async function buttonAction(adapter, buttonState, shutterSettings) {
    adapter.log.debug('start buttonAction');

    const driveDelayUpLiving = adapter.config.driveDelayUpLiving != 0 ? adapter.config.driveDelayUpLiving * 1000 : 20;
    let resLiving;

    if (shutterSettings) {
        switch (buttonState) {
            case 'openLiving':
                resLiving = shutterSettings.filter((/** @type {{ typeUp: string; }} */ d) => d.typeUp == 'living' || d.typeUp == 'living-auto');
                break;
            case 'closeLiving':
                resLiving = shutterSettings.filter((/** @type {{ typeDown: string; typeUp: string; }} */ d) => d.typeDown == 'living' || d.typeUp == 'living-auto');
                break;
            case 'openSleep':
                resLiving = shutterSettings.filter((/** @type {{ typeUp: string; }} */ d) => d.typeUp == 'sleep' || d.typeUp == 'sleep-auto');
                break;
            case 'closeSleep':
                resLiving = shutterSettings.filter((/** @type {{ typeDown: string; typeUp: string; }} */ d) => d.typeDown == 'sleep' || d.typeUp == 'sleep-auto');
                break;
            case 'openChildren':
                resLiving = shutterSettings.filter((/** @type {{ typeUp: string; }} */ d) => d.typeUp == 'children' || d.typeUp == 'children-auto');
                break;
            case 'closeChildren':
                resLiving = shutterSettings.filter((/** @type {{ typeDown: string; typeUp: string; }} */ d) => d.typeDown == 'children' || d.typeUp == 'children-auto');
                break;
            case 'openAll':
                resLiving = shutterSettings.filter((/** @type {{ typeUp: string; }} */ d) => d.typeUp != 'manual-only');
                break;
            case 'closeAll':
                resLiving = shutterSettings.filter((/** @type {{ typeDown: string; }} */ d) => d.typeDown != 'manual-only');
                break;
            case 'sunProtect':
                resLiving = shutterSettings.filter((/** @type {{ typeDown: string; }} */ d) => d.typeDown != 'manual-only');
                break;
            case 'sunProtectSleep':
                resLiving = shutterSettings.filter((/** @type {{ typeDown: string; typeUp: string; }} */ d) => d.typeDown == 'sleep' || d.typeUp == 'sleep-auto');
                break;
            case 'sunProtectChildren':
                resLiving = shutterSettings.filter((/** @type {{ typeDown: string; typeUp: string; }} */ d) => d.typeDown == 'children' || d.typeUp == 'children-auto');
                break;
            case 'sunProtectLiving':
                resLiving = shutterSettings.filter((/** @type {{ typeDown: string; typeUp: string; }} */ d) => d.typeDown == 'living' || d.typeUp == 'living-auto');
                break;
            case 'autoAll':
                resLiving = shutterSettings.filter((/** @type {{ typeUp: string; }} */ d) => d.typeUp != 'manual-only');
                break;
        }

        const result = resLiving.filter((/** @type {{ enabled: boolean; }} */ d) => d.enabled === true); // Filter enabled

        for (const i in result) {
            for (const s in shutterSettings) {
                if (shutterSettings[s].shutterName == result[i].shutterName) {
                    let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                    let targetLevel2Set = 0;
                    let downAction = 'down';

                    const statusAlarmFrost = await checkFrostAlarm(adapter, shutterSettings[s]);

                    if (buttonState == 'closeAll' || buttonState == 'closeLiving' || buttonState == 'closeSleep' || buttonState == 'closeChildren') {
                        targetLevel2Set = parseFloat(shutterSettings[s].heightDown);
                        downAction = 'down';

                        // save current required position to alarmtrigger before overwriting
                        shutterSettings[s].alarmTriggerLevel = targetLevel2Set;
                        shutterSettings[s].alarmTriggerAction = downAction;

                        // overwrite target position and downAction if frost alarm is set.
                        if (statusAlarmFrost == true && shutterSettings[s].enableAlarmFrost == true) {
                            targetLevel2Set = parseFloat(adapter.config.alarmFrostLevel);
                            downAction = 'frost';
                        }

                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                        if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != targetLevel2Set) {
                            shutterSettings[s].currentHeight = targetLevel2Set;
                            shutterSettings[s].triggerHeight = targetLevel2Set;
                            shutterSettings[s].currentAction = downAction;
                            shutterSettings[s].triggerAction = downAction;

                            await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, `Button ${buttonState}`);

                            adapter.log.debug(`shutterDownButton ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${targetLevel2Set}%`);
                        }
                        else if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val == targetLevel2Set) {
                            shutterSettings[s].currentHeight = targetLevel2Set;
                            shutterSettings[s].triggerHeight = targetLevel2Set;
                            shutterSettings[s].currentAction = downAction;
                            shutterSettings[s].triggerAction = downAction;

                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                            adapter.log.debug(`shutterDownButton ${shutterSettings[s].shutterName} already down at: ${targetLevel2Set}% - setting current action: ${shutterSettings[s].currentAction}`);
                        }
                    } else if ((buttonState == 'openAll' || buttonState == 'openLiving' || buttonState == 'openSleep' || buttonState == 'openChildren')) {
                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                        if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != shutterSettings[s].heightUp) {
                            shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                            shutterSettings[s].triggerHeight = shutterSettings[s].heightUp;
                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                            shutterSettings[s].currentAction = 'up';
                            shutterSettings[s].triggerAction = 'up';
                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;

                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].heightUp), nameDevice, `Button ${buttonState}`);

                            adapter.log.debug(`shutterUpButton ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].heightUp}%`);
                        }
                        else if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val == shutterSettings[s].heightUp) {
                            shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                            shutterSettings[s].triggerHeight = shutterSettings[s].heightUp;
                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                            shutterSettings[s].currentAction = 'up';
                            shutterSettings[s].triggerAction = 'up';
                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;

                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                            adapter.log.debug(`shutterUpButton ${shutterSettings[s].shutterName} already up at: ${shutterSettings[s].heightUp}% - setting current action: ${shutterSettings[s].currentAction}`);
                        }
                    } else if ((buttonState == 'sunProtect' || buttonState == 'sunProtectLiving' || buttonState == 'sunProtectSleep' || buttonState == 'sunProtectChildren')) {
                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                        if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != shutterSettings[s].heightDownSun) {

                            shutterSettings[s].currentHeight = shutterSettings[s].heightDownSun;
                            shutterSettings[s].triggerHeight = shutterSettings[s].heightDownSun;
                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                            shutterSettings[s].currentAction = 'manu_sunProtect';
                            shutterSettings[s].triggerAction = 'manu_sunProtect';
                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;

                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].heightDownSun), nameDevice, `Button ${buttonState}`);

                            adapter.log.debug(`shutterUpButton ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].heightUp}%`);
                        }
                        else if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val == shutterSettings[s].heightDownSun) {
                            shutterSettings[s].currentHeight = shutterSettings[s].heightDownSun;
                            shutterSettings[s].triggerHeight = shutterSettings[s].heightDownSun;
                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                            shutterSettings[s].currentAction = 'manu_sunProtect';
                            shutterSettings[s].triggerAction = 'manu_sunProtect';
                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;

                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                            adapter.log.debug(`shutterUpButton ${shutterSettings[s].shutterName} already down at: ${shutterSettings[s].heightDown}% - setting current action: ${shutterSettings[s].currentAction}`);
                        }
                    } else if (buttonState == 'autoAll') {
                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                        if (typeof _shutterState != undefined && _shutterState != null && typeof _shutterState.val) {
                            adapter.log.info(`Set ID: ${shutterSettings[s].shutterName} to Auto-Mode`);
                            if (_shutterState.val == shutterSettings[s].heightDownSun) {
                                shutterSettings[s].currentHeight = shutterSettings[s].heightDownSun;
                                shutterSettings[s].triggerHeight = shutterSettings[s].heightDownSun;
                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                shutterSettings[s].currentAction = 'sunProtect';
                                shutterSettings[s].triggerAction = 'sunProtect';
                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;

                                await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                adapter.log.debug(`shutterUpButton ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].heightDownSun}%`);
                            } else if (_shutterState.val == shutterSettings[s].heightUp) {
                                shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                shutterSettings[s].triggerHeight = shutterSettings[s].heightUp;
                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                shutterSettings[s].currentAction = 'up';
                                shutterSettings[s].triggerAction = 'up';
                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;

                                await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                adapter.log.debug(`shutterUpButton ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].heightUp}%`);
                            } else if (_shutterState.val == shutterSettings[s].heightDown) {
                                shutterSettings[s].currentHeight = shutterSettings[s].heightDown;
                                shutterSettings[s].triggerHeight = shutterSettings[s].heightDown;
                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                shutterSettings[s].currentAction = 'down';
                                shutterSettings[s].triggerAction = 'down';
                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;

                                await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                adapter.log.debug(`shutterUpButton ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].heightDown}%`);
                            } else {
                                shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                shutterSettings[s].triggerHeight = shutterSettings[s].heightUp;
                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                shutterSettings[s].currentAction = 'up';
                                shutterSettings[s].triggerAction = 'up';
                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].heightUp), nameDevice, `Button ${buttonState}`);
                                adapter.log.debug(`shutterUpButton ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].heightUp}%`);
                            }
                        }
                    }
                }
            }
            await sleep(driveDelayUpLiving);
        }
        adapter.log.debug('Shuttercontrol save all shutter states');
        clearTimeout(timerSleep);
        return (shutterSettings);
    }
}
module.exports = buttonAction;