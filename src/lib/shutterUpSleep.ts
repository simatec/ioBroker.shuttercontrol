import * as schedule from 'node-schedule';
import { checkPendingAlarm } from './shutterAlarm';
import { setShutterState, setShutterInfo } from './setShutter';
import type { ShutterSettings } from './types';

async function driveshutterUpSleep(adapter: ioBroker.Adapter, upTimeSleep: string, autoSleepStr: string | boolean, shutterSettings: ShutterSettings[], sleepType: string, driveDelayUpSleep: number, timeoutSleepAuto: number, noGoDelay: number): Promise<ShutterSettings[] | undefined> {
    if (shutterSettings) {
        adapter.log.debug(`Sleep-type: ${sleepType}`);

        const resSleep = shutterSettings.filter((d) => d.typeUp == sleepType); // Filter Area sleep
        const result = resSleep.filter((d) => d.enabled === true || d.enabled === 'true'); // Filter enabled
        ;
        let number = 0;

        if (sleepType == 'sleep') {
            for (let i = 0; i < result.length; i++) {
                number++;
            }
            timeoutSleepAuto = number !== 0 ? number * driveDelayUpSleep : driveDelayUpSleep;
        }

        for (let i = 0; i < result.length; i++) {
            for (let s = 0; s < shutterSettings.length; s++) {
                if (shutterSettings[s].shutterName == result[i].shutterName) {
                    const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                    const pendingAlarm = await checkPendingAlarm(adapter, shutterSettings[s]);
                    const _autoUpState = await adapter.getStateAsync(`shutters.autoUp.${nameDevice}`).catch((e) => adapter.log.warn(e));

                    if (_autoUpState?.val === true) {
                        let shutterHeight = 0;

                        if (shutterSettings[s].currentAction == 'sunProtect' ||
                            shutterSettings[s].currentAction == 'OpenInSunProtect') {

                            shutterHeight = parseFloat(String(shutterSettings[s].heightDownSun));
                            shutterSettings[s].currentAction = 'sunProtect';
                        } else {
                            shutterHeight = parseFloat(String(shutterSettings[s].heightUp));
                            shutterSettings[s].currentAction = 'up';
                        }

                        // saving current required values to alarmtrigger
                        shutterSettings[s].alarmTriggerLevel = shutterHeight;
                        shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;

                        if (pendingAlarm == false) {
                            const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;
                            const mustValue = (`${shutterSettings[s].triggerState}`);
                            const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? (`${shutterSettings[s].triggerState}`) : (`${shutterSettings[s].triggerStateTilted}`);
                            const currentValue = _triggerState?.val !== null && _triggerState?.val !== undefined ? (`${_triggerState.val}`) : '';

                            if (currentValue === mustValue ||
                                currentValue === mustValueTilted ||
                                (currentValue != mustValue &&
                                    currentValue != mustValueTilted &&
                                    shutterSettings[s].autoDrive != 'onlyDown' &&
                                    shutterSettings[s].autoDrive != 'off')) {

                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterHeight &&
                                    Date.now() >= (_shutterState.lc + noGoDelay)) {

                                    shutterSettings[s].currentHeight = shutterHeight;
                                    shutterSettings[s].lastAutoAction = 'up_SleepTime';
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight; // reset Trigger
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction; // reset Trigger

                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], shutterHeight, nameDevice, 'Sleep up #21');

                                    adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                    adapter.log.debug(`shutterUpSleep #1 ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterHeight}%`);
                                } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterHeight &&
                                    Date.now() >= (_shutterState.lc + noGoDelay)) {

                                    shutterSettings[s].currentHeight = shutterHeight;
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight; // reset Trigger
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction; // reset Trigger

                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                    adapter.log.debug(`shutterUpSleep #1 ${shutterSettings[s].shutterName} already up at: ${shutterHeight}% - setting current action: ${shutterSettings[s].currentAction}`);
                                }
                            } else if (shutterSettings[s].triggerID == '') {
                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterHeight &&
                                    Date.now() >= (_shutterState.lc + noGoDelay)) {

                                    shutterSettings[s].currentHeight = shutterHeight;
                                    shutterSettings[s].lastAutoAction = 'up_SleepTime';

                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], shutterHeight, nameDevice, 'Sleep up #22');

                                    adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                    adapter.log.debug(`shutterUpSleep #2 ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterHeight}%`);
                                } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterHeight &&
                                    Date.now() >= (_shutterState.lc + noGoDelay)) {

                                    shutterSettings[s].currentHeight = shutterHeight;

                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                    adapter.log.debug(`shutterUpSleep #2 ${shutterSettings[s].shutterName} already up at: ${shutterHeight}% - setting current action: ${shutterSettings[s].currentAction}`);
                                }
                            } else if (currentValue != mustValue &&
                                currentValue != mustValueTilted &&
                                shutterSettings[s].driveAfterClose == true) {

                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterHeight) {

                                    shutterSettings[s].triggerHeight = shutterHeight;
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    adapter.log.info(`#23 Will open ID: ${shutterSettings[s].shutterName} value: ${shutterHeight}% after the window has been closed`);
                                    adapter.log.debug(`save new trigger height: ${shutterHeight}%`);
                                    adapter.log.debug(`save new trigger action: ${shutterSettings[s].triggerAction}`);
                                } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterHeight) {

                                    shutterSettings[s].triggerHeight = shutterHeight;
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    adapter.log.info(`#24 Will open ID: ${shutterSettings[s].shutterName} value: ${shutterHeight}% after is the value for sleep up`);
                                    adapter.log.debug(`save new trigger height: ${shutterHeight}%`);
                                    adapter.log.debug(`save new trigger action: ${shutterSettings[s].triggerAction}`);
                                }
                            }
                        } else {
                            adapter.log.info(`Sleep up not moving now due to active alarm: ${shutterSettings[s].shutterName} value: ${shutterHeight}%`);
                        }
                        await adapter.delay(driveDelayUpSleep);
                    }
                }
            }
        }
        adapter.log.debug(`Adapter Auto-Sleep is: ${autoSleepStr}`);

        // start sleep-auto after drive sleep shutter
        if ((autoSleepStr === true ||
            autoSleepStr === 'true') &&
            sleepType === 'sleep') {

            await adapter.delay(timeoutSleepAuto);
            sleepType = 'sleep-auto';
            void driveshutterUpSleep(adapter, upTimeSleep, autoSleepStr, shutterSettings, sleepType, driveDelayUpSleep, timeoutSleepAuto, noGoDelay);
        } else {
            return (shutterSettings);
        }
    }
}
export async function shutterUpSleep(adapter: ioBroker.Adapter, upTimeSleep: string | undefined, delayUp: number, autoSleepStr: string | boolean, shutterSettings: ShutterSettings[]): Promise<void> {
    const driveDelayUpSleep = adapter.config.driveDelayUpSleep != 0 ? adapter.config.driveDelayUpSleep * 1000 : 20;
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving != 0 ? adapter.config.driveDelayUpLiving * 1000 : 20;
    const noGoDelay = adapter.config.noGoTime * 1000 * 60;

    upTimeSleep = upTimeSleep == undefined ? adapter.config.W_shutterUpSleepMax : upTimeSleep;

    const sleepType = 'sleep';
    const upTime = upTimeSleep.split(':');
    const timeoutSleepAuto = 0;

    schedule.cancelJob('shutterUpSleep');

    const upSleep = schedule.scheduleJob('shutterUpSleep', `${upTime[1]} ${upTime[0]} * * *`, async function () {
        delayUp = delayUp * driveDelayUpLiving;

        await adapter.delay(delayUp);
        void driveshutterUpSleep(adapter, upTimeSleep, autoSleepStr, shutterSettings, sleepType, driveDelayUpSleep, timeoutSleepAuto, noGoDelay);
    });
}

