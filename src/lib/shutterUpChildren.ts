import * as schedule from 'node-schedule';
import { checkPendingAlarm } from './shutterAlarm';
import { setShutterState, setShutterInfo } from './setShutter';
import type { ShutterSettings } from './types';

async function driveshutterUpChildren(adapter: ioBroker.Adapter, upTimeChildren: string, autoChildrenStr: string | boolean, shutterSettings: ShutterSettings[], childrenType: string, driveDelayUpChildren: number, timeoutChildrenAuto: number, noGoDelay: number): Promise<ShutterSettings[] | undefined> {
    if (shutterSettings) {
        adapter.log.debug(`Children-type: ${childrenType}`);

        const resChildren = shutterSettings.filter((d) => d.typeUp == childrenType); // Filter Area Children
        const result = resChildren.filter((d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

        let number = 0;

        if (childrenType === 'children') {
            for (let i = 0; i < result.length; i++) {
                number++;
            }
            timeoutChildrenAuto = number !== 0 ? number * driveDelayUpChildren : driveDelayUpChildren;
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
                                    shutterSettings[s].lastAutoAction = 'up_ChidrenTime';
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight; // reset Trigger
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction; // reset Trigger

                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], shutterHeight, nameDevice, 'Children Up #21');

                                    adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                    adapter.log.debug(`shutterUpChildren #1 ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterHeight}%`);
                                } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterHeight &&
                                    Date.now() >= (_shutterState.lc + noGoDelay)) {

                                    shutterSettings[s].currentHeight = shutterHeight;
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight; // reset Trigger
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction; // reset Trigger

                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                    adapter.log.debug(`shutterUpChildren #1 ${shutterSettings[s].shutterName} already up at: ${shutterHeight}% - setting current action: ${shutterSettings[s].currentAction}`);
                                }
                            } else if (shutterSettings[s].triggerID == '') {
                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterHeight &&
                                    Date.now() >= (_shutterState.lc + noGoDelay)) {

                                    shutterSettings[s].currentHeight = shutterHeight;
                                    shutterSettings[s].lastAutoAction = 'up_ChidrenTime';

                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], shutterHeight, nameDevice, 'Children Up #22');

                                    adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                    adapter.log.debug(`shutterUpChildren #2 ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterHeight}%`);
                                } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterHeight &&
                                    Date.now() >= (_shutterState.lc + noGoDelay)) {

                                    shutterSettings[s].currentHeight = shutterHeight;

                                    await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                    adapter.log.debug(`shutterUpChildren #2 ${shutterSettings[s].shutterName} already up at: ${shutterHeight}% - setting current action: ${shutterSettings[s].currentAction}`);
                                }
                            } else if (currentValue != mustValue &&
                                currentValue != mustValueTilted &&
                                shutterSettings[s].driveAfterClose == true) {

                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                if (_shutterState?.val !== null && _shutterState?.val !== undefined && Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterHeight) {
                                    shutterSettings[s].triggerHeight = shutterHeight;
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    adapter.log.info(`#23 Will open ID: ${shutterSettings[s].shutterName} value: ${shutterHeight}%` + ` after the window has been closed `);
                                    adapter.log.debug(`save new trigger height: ${shutterHeight}%`);
                                    adapter.log.debug(`save new trigger action: ${shutterSettings[s].triggerAction}`);
                                } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterHeight) {

                                    shutterSettings[s].triggerHeight = shutterHeight;
                                    shutterSettings[s].triggerAction = shutterSettings[s].currentAction;

                                    adapter.log.info(`#24 Will open ID: ${shutterSettings[s].shutterName} value: ${shutterHeight}% after is the value for Children up`);
                                    adapter.log.debug(`save new trigger height: ${shutterHeight}%`);
                                    adapter.log.debug(`save new trigger action: ${shutterSettings[s].triggerAction}`);
                                }
                            }
                        } else {
                            adapter.log.info(`Children up not moving now due to active alarm: ${shutterSettings[s].shutterName} value: ${shutterHeight}%`);
                        }
                        await adapter.delay(driveDelayUpChildren);
                    }
                }
            }
        }
        adapter.log.debug(`Adapter Auto-Children is: ${autoChildrenStr}`);

        // start children-auto after drive children shutter
        if ((autoChildrenStr === true ||
            autoChildrenStr === 'true') &&
            childrenType === 'children') {

            await adapter.delay(timeoutChildrenAuto);
            childrenType = 'children-auto';
            void driveshutterUpChildren(adapter, upTimeChildren, autoChildrenStr, shutterSettings, childrenType, driveDelayUpChildren, timeoutChildrenAuto, noGoDelay);
        } else {
            return (shutterSettings);
        }
    }
}
export async function shutterUpChildren(adapter: ioBroker.Adapter, upTimeChildren: string | undefined, delayUp: number, autoChildrenStr: string | boolean, shutterSettings: ShutterSettings[]): Promise<void> {
    const driveDelayUpChildren = adapter.config.driveDelayUpChildren != 0 ? adapter.config.driveDelayUpChildren * 1000 : 20;
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving != 0 ? adapter.config.driveDelayUpLiving * 1000 : 20;
    const noGoDelay = adapter.config.noGoTime * 1000 * 60;

    upTimeChildren = upTimeChildren == undefined ? adapter.config.W_shutterUpChildrenMax : upTimeChildren;

    const childrenType = 'children';
    let upTime: string[] | undefined;

    try {
        upTime = upTimeChildren.split(':');
    } catch (e) {
        adapter.log.debug('Uptime for the childrenarea is not defined ... Please check your config!!');
    }

    const timeoutChildrenAuto = 0;

    schedule.cancelJob('shutterUpChildren');

    try {
        const upChildren = schedule.scheduleJob('shutterUpChildren', `${(upTime as string[])[1]} ${(upTime as string[])[0]} * * *`, async function () {
            delayUp = delayUp * driveDelayUpLiving;
            await adapter.delay(delayUp);
            void driveshutterUpChildren(adapter, upTimeChildren, autoChildrenStr, shutterSettings, childrenType, driveDelayUpChildren, timeoutChildrenAuto, noGoDelay);
        });
    } catch (e) {
        adapter.log.debug('error on uptime for childrenarea ... please check your config!!');
    }
}
