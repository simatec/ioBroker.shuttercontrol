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
    return `${(`0${d.getHours()}`).slice(-2)}:${(`0${d.getMinutes()}`).slice(-2)}`;
}
async function driveshutterDownLiving(adapter: ioBroker.Adapter, downTimeLiving: string, autoLivingStr: string | boolean, shutterSettings: ShutterSettings[], livingType: string, driveDelayUpLiving: number, timeoutLivingAuto: number): Promise<ShutterSettings[] | undefined> {
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
                        targetLevel2Set = shutterSettings[s].betweenPosition == true ? parseFloat(String(shutterSettings[s].betweenPositionLevel)) : parseFloat(String(shutterSettings[s].heightDown));
                        downAction = shutterSettings[s].betweenPosition == true ? 'middle' : 'down';
                    } else {
                        targetLevel2Set = parseFloat(String(shutterSettings[s].heightDown));
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

                        targetLevel2Set = parseFloat(String(adapter.config.alarmFrostLevel));
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
                                        Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {

                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                        shutterSettings[s].currentAction = downAction;
                                        shutterSettings[s].lastAutoAction = 'Down_LivingTime';
                                        shutterSettings[s].triggerHeight = targetLevel2Set; // reset Trigger
                                        shutterSettings[s].triggerAction = downAction;      // reset Trigger

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Living down #17');

                                        adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                        adapter.log.debug(`shutterDownLiving #1 ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${targetLevel2Set}%`);
                                    } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                        Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set) {

                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                        shutterSettings[s].currentAction = downAction;

                                        await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                        adapter.log.debug(`shutterDownLiving #1 ${shutterSettings[s].shutterName} already down at: ${targetLevel2Set}% - setting current action: ${shutterSettings[s].currentAction}`);
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
                                        shutterSettings[s].lastAutoAction = 'Down_LivingTime';

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Living down #18');

                                        adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                        adapter.log.debug(`shutterDownLiving #2 ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${targetLevel2Set}%`);
                                    } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                        Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set) {

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
                                        Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {
                                        shutterSettings[s].triggerHeight = targetLevel2Set;
                                        shutterSettings[s].triggerAction = downAction;

                                        adapter.log.info(`#19 Will close ID: ${shutterSettings[s].shutterName} value: ${targetLevel2Set}%` + ` after the window has been closed `);
                                        adapter.log.debug(`save new trigger height: ${shutterSettings[s].triggerHeight}%`);
                                        adapter.log.debug(`save new trigger action: ${shutterSettings[s].triggerAction}`);
                                    }
                                }
                                await adapter.delay(driveDelayUpLiving);
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
            await adapter.delay(timeoutLivingAuto);
            livingType = 'living-auto';
            driveshutterDownLiving(adapter, downTimeLiving, autoLivingStr, shutterSettings, livingType, driveDelayUpLiving, timeoutLivingAuto);
        } else {
            return (shutterSettings);
        }
    }
}
export async function shutterDownLiving(adapter: ioBroker.Adapter, downTimeLiving: string, autoLivingStr: string | boolean, shutterSettings: ShutterSettings[]): Promise<void> {
    adapter.log.debug('shutterDownLiving');

    const driveDelayUpLiving = adapter.config.driveDelayUpLiving != 0 ? adapter.config.driveDelayUpLiving * 1000 : 20;

    downTimeLiving = downTimeLiving == undefined ? adapter.config.W_shutterDownLiving : downTimeLiving;

    const livingType = 'living';
    const downTime = downTimeLiving.split(':');

    const timeoutLivingAuto = 0;

    schedule.cancelJob('shutterDownLiving');

    const downLiving = schedule.scheduleJob('shutterDownLiving', `${downTime[1]} ${downTime[0]} * * *`, async function () {
        driveshutterDownLiving(adapter, downTimeLiving, autoLivingStr, shutterSettings, livingType, driveDelayUpLiving, timeoutLivingAuto);
    });
}

