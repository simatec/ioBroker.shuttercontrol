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
async function driveshutterDownChildren(adapter: ioBroker.Adapter, downTimeChildren: string, autoChildrenStr: string | boolean, shutterSettings: ShutterSettings[], childrenType: string, driveDelayUpChildren: number, timeoutChildrenAuto: number): Promise<ShutterSettings[] | undefined> {
    if (shutterSettings) {
        const resChildren = shutterSettings.filter((d) => d.typeDown == childrenType); // Filter Area children or children-auto
        const result = resChildren.filter((d) => d.enabled === true || d.enabled === 'true'); // Filter enabled
        let number = 0;

        if (childrenType == 'children') {
            for (let i = 0; i < result.length; i++) {
                number++;
            }

            timeoutChildrenAuto = number * driveDelayUpChildren;
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

                    // save current required position to alarmtrigger before overwriting
                    shutterSettings[s].alarmTriggerLevel = targetLevel2Set;
                    shutterSettings[s].alarmTriggerAction = downAction;

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
                                        shutterSettings[s].lastAutoAction = 'Down_ChildrenTime';
                                        shutterSettings[s].triggerHeight = targetLevel2Set; // reset Trigger
                                        shutterSettings[s].triggerAction = downAction;      // reset Trigger

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Children down #26');

                                        adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                        adapter.log.debug(`shutterDownChildren #1 ${  shutterSettings[s].shutterName  } old height: ${  shutterSettings[s].oldHeight  }% new height: ${  targetLevel2Set  }%`);
                                    } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                        Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set) {

                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                        shutterSettings[s].currentAction = downAction;

                                        await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                        adapter.log.debug(`shutterDownChildren #1 ${  shutterSettings[s].shutterName  } already down at: ${  targetLevel2Set  }% - setting current action: ${  shutterSettings[s].currentAction}`);
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
                                        shutterSettings[s].lastAutoAction = 'Down_ChildrenTime';

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Children down #27');

                                        adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                        adapter.log.debug(`shutterDownChildren #2 ${  shutterSettings[s].shutterName  } old height: ${  shutterSettings[s].oldHeight  }% new height: ${  targetLevel2Set  }%`);
                                    } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                        Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set) {

                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                        shutterSettings[s].currentAction = downAction;

                                        await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                        adapter.log.debug(`shutterDownChildren #2 ${  shutterSettings[s].shutterName  } already down at: ${  targetLevel2Set  }% - setting current action: ${  shutterSettings[s].currentAction}`);
                                    }
                                } else if (currentValue != mustValue &&
                                    currentValue != mustValueTilted &&
                                    shutterSettings[s].driveAfterClose == true) {

                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                    if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                        Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {

                                        shutterSettings[s].triggerHeight = targetLevel2Set;
                                        shutterSettings[s].triggerAction = 'down';

                                        adapter.log.info(`#28 Will close ID: ${  shutterSettings[s].shutterName  } value: ${  targetLevel2Set  }%` + ` after the window has been closed `);
                                        adapter.log.debug(`save new trigger height: ${  shutterSettings[s].triggerHeight  }%`);
                                        adapter.log.debug(`save new trigger action: ${  shutterSettings[s].triggerAction}`);
                                    }
                                }
                                await adapter.delay(driveDelayUpChildren);
                            } else {
                                adapter.log.info(`Down children not moving now due to active alarm: ${  shutterSettings[s].shutterName  } value: ${  targetLevel2Set  }%`);
                            }
                        }
                    }
                }
            }
        }
        // start children-auto after drive children shutter
        if (autoChildrenStr == true && childrenType == 'children') {
            await adapter.delay(timeoutChildrenAuto);
            childrenType = 'children-auto';
            void driveshutterDownChildren(adapter, downTimeChildren, autoChildrenStr, shutterSettings, childrenType, driveDelayUpChildren, timeoutChildrenAuto);
        } else {
            return (shutterSettings);
        }
    }
}
export async function shutterDownChildren(adapter: ioBroker.Adapter, downTimeChildren: string, delayDown: number, autoChildrenStr: string | boolean, shutterSettings: ShutterSettings[]): Promise<void> {
    const driveDelayUpChildren = adapter.config.driveDelayUpChildren != 0 ? adapter.config.driveDelayUpChildren * 1000 : 20;
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving != 0 ? adapter.config.driveDelayUpLiving * 1000 : 20;

    downTimeChildren = downTimeChildren == undefined ? adapter.config.W_shutterDownChildren : downTimeChildren;

    const childrenType = 'children';
    let downTime: string[] | undefined;

    try {
        downTime = downTimeChildren.split(':');
    } catch (e) {
        adapter.log.debug('downtime for the childrenarea is not defined ... Please check your config!!');
    }

    const timeoutChildrenAuto = 0;

    schedule.cancelJob('shutterDownChildren');
    try {
        const downChildren = schedule.scheduleJob('shutterDownChildren', `${(downTime as string[])[1]  } ${  (downTime as string[])[0]  } * * *`, async function () {
            delayDown = delayDown * driveDelayUpLiving;
            await adapter.delay(delayDown);
            void driveshutterDownChildren(adapter, downTimeChildren, autoChildrenStr, shutterSettings, childrenType, driveDelayUpChildren, timeoutChildrenAuto);
        });
    } catch (e) {
        adapter.log.debug('error on downtime for childrenarea ... please check your config!!');
    }
}
