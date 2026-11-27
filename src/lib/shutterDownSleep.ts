import * as schedule from 'node-schedule';
import { checkPendingAlarm, checkFrostAlarm } from './shutterAlarm';
import { setShutterState, setShutterInfo } from './setShutter';
import { CheckInSummerNotDown, GetXmasLevel } from './isSummerTime';
import { driveWindowLevel } from './windowLevel';
import type { ShutterSettings } from './types';

/**
 * @param [d]
 */
function getDate(d?: Date): string {
    d = d || new Date();
    return `${(`0${  d.getHours()}`).slice(-2)  }:${  (`0${  d.getMinutes()}`).slice(-2)}`;
}
async function driveshutterDownSleep(adapter: ioBroker.Adapter, downTimeSleep: string, autoSleepStr: string | boolean, shutterSettings: ShutterSettings[], sleepType: string, driveDelayUpSleep: number, timeoutSleepAuto: number): Promise<ShutterSettings[] | undefined> {
    if (shutterSettings) {
        const resSleep = shutterSettings.filter((d) => d.typeDown == sleepType); // Filter Area sleep
        const result = resSleep.filter((d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

        let number = 0;

        if (sleepType == 'sleep') {
            for (let i = 0; i < result.length; i++) {
                number++;
            }
            timeoutSleepAuto = number * driveDelayUpSleep;
        }

        for (let i = 0; i < result.length; i++) {
            for (let s = 0; s < shutterSettings.length; s++) {
                if (shutterSettings[s].shutterName == result[i].shutterName) {
                    const inSummerNotDown = await CheckInSummerNotDown(adapter, shutterSettings[s]);
                    const XmasLevel = await GetXmasLevel(adapter, shutterSettings[s]);

                    let targetLevel2Set = 0;
                    let downAction = 'down';

                    const pendingAlarm = await checkPendingAlarm(adapter, shutterSettings[s]);
                    const statusAlarmFrost = await checkFrostAlarm(adapter, shutterSettings[s]);

                    if (getDate() < adapter.config.betweenPositionTime) {
                        // between Position Level
                        targetLevel2Set = shutterSettings[s].betweenPosition == true ? parseFloat(String(shutterSettings[s].betweenPositionLevel)) : parseFloat(String(shutterSettings[s].heightDown));
                        downAction = shutterSettings[s].betweenPosition == true ? 'middle' : 'down';
                    } else {
                        targetLevel2Set = parseFloat(String(shutterSettings[s].heightDown));
                        downAction = 'down';
                    }

                    // xmas level or standard down level
                    targetLevel2Set = XmasLevel > -1 ? XmasLevel : targetLevel2Set;
                    downAction = XmasLevel > -1 ? 'Xmas' : downAction;

                    // position to return to after an alarm - stored below only if the shutter is really driven (or waits for an alarm)
                    const alarmTriggerLevel = targetLevel2Set;
                    const alarmTriggerAction = downAction;

                    // overwrite target position and downAction if frost alarm is set.
                    if (statusAlarmFrost == true && 
                        shutterSettings[s].enableAlarmFrost == true && 
                        downAction != 'Xmas') {

                        targetLevel2Set = parseFloat(String(adapter.config.alarmFrostLevel));
                        downAction = 'frost';
                    }

                    if (!inSummerNotDown) {
                        const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                        const _autoDownState = await adapter.getStateAsync(`shutters.autoDown.${nameDevice}`).catch((e) => adapter.log.warn(e));

                        if (_autoDownState?.val === true) {
                            shutterSettings[s].alarmTriggerLevel = alarmTriggerLevel;
                            shutterSettings[s].alarmTriggerAction = alarmTriggerAction;

                            if (pendingAlarm == false) {
                                const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;
                                const mustValue = (`${  shutterSettings[s].triggerState}`);
                                const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? (`${  shutterSettings[s].triggerState}`) : (`${  shutterSettings[s].triggerStateTilted}`);
                                const currentValue = _triggerState?.val !== null && _triggerState?.val !== undefined ? (`${  _triggerState.val}`) : '';


                                if (currentValue === mustValue || 
                                    currentValue === mustValueTilted || 
                                    (currentValue != mustValue && 
                                        currentValue != mustValueTilted && 
                                        shutterSettings[s].autoDrive != 'onlyUp' && 
                                        shutterSettings[s].autoDrive != 'off')) {

                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                    if (_shutterState?.val !== null && _shutterState?.val !== undefined && 
                                        Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {

                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                        shutterSettings[s].currentAction = downAction;
                                        shutterSettings[s].lastAutoAction = 'Down_SleepTime';
                                        shutterSettings[s].triggerHeight = targetLevel2Set; // reset Trigger
                                        shutterSettings[s].triggerAction = downAction;      // reset Trigger

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Sleep down #26');

                                        adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                        adapter.log.debug(`shutterDownSleep #1 ${  shutterSettings[s].shutterName  } old height: ${  shutterSettings[s].oldHeight  }% new height: ${  targetLevel2Set  }%`);
                                    } else if (_shutterState?.val !== null && _shutterState?.val !== undefined && 
                                        Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set) {

                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                        shutterSettings[s].currentAction = downAction;
                                        shutterSettings[s].triggerHeight = targetLevel2Set; // reset Trigger
                                        shutterSettings[s].triggerAction = downAction;      // reset Trigger

                                        await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                        adapter.log.debug(`shutterDownSleep #1 ${  shutterSettings[s].shutterName  } already down at: ${  targetLevel2Set  }% - setting current action: ${  shutterSettings[s].currentAction}`);
                                    }

                                    // the shutter is closed first and only then moved to the ventilation height
                                    driveWindowLevel(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, downAction, nameDevice)
                                        .catch((e) => adapter.log.warn(`#driveWindowLevel: ${e}`));
                                } else if (shutterSettings[s].triggerID == '') {
                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                    if (_shutterState?.val !== null && _shutterState?.val !== undefined && 
                                        Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {

                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                        shutterSettings[s].currentAction = downAction;
                                        shutterSettings[s].lastAutoAction = 'Down_SleepTime';

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Sleep down #27');

                                        adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                        adapter.log.debug(`shutterDownSleep #2 ${  shutterSettings[s].shutterName  } old height: ${  shutterSettings[s].oldHeight  }% new height: ${  targetLevel2Set  }%`);
                                    } else if (_shutterState?.val !== null && _shutterState?.val !== undefined && 
                                        Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set) {

                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                        shutterSettings[s].currentAction = downAction;

                                        await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                        adapter.log.debug(`shutterDownSleep #2 ${  shutterSettings[s].shutterName  } already down at: ${  targetLevel2Set  }% - setting current action: ${  shutterSettings[s].currentAction}`);
                                    }
                                } else if (currentValue != mustValue && 
                                    currentValue != mustValueTilted && 
                                    shutterSettings[s].driveAfterClose == true) {

                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                    if (_shutterState?.val !== null && _shutterState?.val !== undefined && 
                                        Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {

                                        shutterSettings[s].triggerHeight = targetLevel2Set;
                                        shutterSettings[s].triggerAction = downAction;

                                        adapter.log.info(`#28 Will close ID: ${  shutterSettings[s].shutterName  } value: ${  targetLevel2Set  }%` + ` after the window has been closed`);
                                        adapter.log.debug(`save new trigger height: ${  shutterSettings[s].triggerHeight  }%`);
                                        adapter.log.debug(`save new trigger action: ${  shutterSettings[s].triggerAction}`);
                                    }
                                }
                                await adapter.delay(driveDelayUpSleep);
                            } else {
                                adapter.log.info(`Down sleep not moving now due to active alarm: ${  shutterSettings[s].shutterName  } value: ${  targetLevel2Set  }%`);
                            }
                        }
                    }
                }
            }
        }
        // start sleep-auto after drive sleep shutter
        if (autoSleepStr == true && sleepType == 'sleep') {
            await adapter.delay(timeoutSleepAuto);
            sleepType = 'sleep-auto';
            void driveshutterDownSleep(adapter, downTimeSleep, autoSleepStr, shutterSettings, sleepType, driveDelayUpSleep, timeoutSleepAuto);
        } else {
            return (shutterSettings);
        }
    }


}
export async function shutterDownSleep(adapter: ioBroker.Adapter, downTimeSleep: string, delayDown: number, autoSleepStr: string | boolean, shutterSettings: ShutterSettings[]): Promise<void> {
    const driveDelayUpSleep = adapter.config.driveDelayUpSleep != 0 ? adapter.config.driveDelayUpSleep * 1000 : 20;
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving != 0 ? adapter.config.driveDelayUpLiving * 1000 : 20;

    downTimeSleep = downTimeSleep == undefined ? adapter.config.W_shutterDownSleep : downTimeSleep;

    const sleepType = 'sleep';
    const downTime = downTimeSleep.split(':');
    const timeoutSleepAuto = 0;

    schedule.cancelJob('shutterDownSleep');
    const downSleep = schedule.scheduleJob('shutterDownSleep', `${downTime[1]  } ${  downTime[0]  } * * *`, async function () {
        delayDown = delayDown * driveDelayUpLiving;

        await adapter.delay(delayDown);
        void driveshutterDownSleep(adapter, downTimeSleep, autoSleepStr, shutterSettings, sleepType, driveDelayUpSleep, timeoutSleepAuto);
    });
}
