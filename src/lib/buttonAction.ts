import { checkFrostAlarm } from './shutterAlarm';
import { setShutterState, setShutterInfo } from './setShutter';
import type { ShutterSettings } from './types';

/**
 * Executes a button action (open / close / sunProtect / auto) for the shutters of the selected area
 *
 * @param adapter adapter instance
 * @param buttonState name of the pressed button
 * @param shutterSettings all shutter settings
 */
export async function buttonAction(adapter: ioBroker.Adapter, buttonState: string, shutterSettings: ShutterSettings[]): Promise<ShutterSettings[] | undefined> {
    adapter.log.debug('start buttonAction');

    const driveDelayUpLiving = adapter.config.driveDelayUpLiving != 0 ? adapter.config.driveDelayUpLiving * 1000 : 20;
    let resLiving: ShutterSettings[] | undefined;

    if (shutterSettings) {
        switch (buttonState) {
            case 'openLiving':
                resLiving = shutterSettings.filter((d) => d.typeUp == 'living' || d.typeUp == 'living-auto');
                break;
            case 'closeLiving':
                resLiving = shutterSettings.filter((d) => d.typeDown == 'living' || d.typeUp == 'living-auto');
                break;
            case 'openSleep':
                resLiving = shutterSettings.filter((d) => d.typeUp == 'sleep' || d.typeUp == 'sleep-auto');
                break;
            case 'closeSleep':
                resLiving = shutterSettings.filter((d) => d.typeDown == 'sleep' || d.typeUp == 'sleep-auto');
                break;
            case 'openChildren':
                resLiving = shutterSettings.filter((d) => d.typeUp == 'children' || d.typeUp == 'children-auto');
                break;
            case 'closeChildren':
                resLiving = shutterSettings.filter((d) => d.typeDown == 'children' || d.typeUp == 'children-auto');
                break;
            case 'openAll':
                resLiving = shutterSettings.filter((d) => d.typeUp != 'manual-only');
                break;
            case 'closeAll':
                resLiving = shutterSettings.filter((d) => d.typeDown != 'manual-only');
                break;
            case 'sunProtect':
                resLiving = shutterSettings.filter((d) => d.typeDown != 'manual-only');
                break;
            case 'sunProtectSleep':
                resLiving = shutterSettings.filter((d) => d.typeDown == 'sleep' || d.typeUp == 'sleep-auto');
                break;
            case 'sunProtectChildren':
                resLiving = shutterSettings.filter((d) => d.typeDown == 'children' || d.typeUp == 'children-auto');
                break;
            case 'sunProtectLiving':
                resLiving = shutterSettings.filter((d) => d.typeDown == 'living' || d.typeUp == 'living-auto');
                break;
            case 'autoAll':
                resLiving = shutterSettings.filter((d) => d.typeUp != 'manual-only');
                break;
        }

        const result = (resLiving as ShutterSettings[]).filter((d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

        for (let i = 0; i < result.length; i++) {
            for (let s = 0; s < shutterSettings.length; s++) {
                if (shutterSettings[s].shutterName == result[i].shutterName) {
                    const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                    let targetLevel2Set = 0;
                    let downAction = 'down';

                    const statusAlarmFrost = await checkFrostAlarm(adapter, shutterSettings[s]);

                    if (buttonState == 'closeAll' ||
                        buttonState == 'closeLiving' ||
                        buttonState == 'closeSleep' ||
                        buttonState == 'closeChildren') {

                        targetLevel2Set = parseFloat(String(shutterSettings[s].heightDown));
                        downAction = 'down';

                        // save current required position to alarmtrigger before overwriting
                        shutterSettings[s].alarmTriggerLevel = targetLevel2Set;
                        shutterSettings[s].alarmTriggerAction = downAction;

                        // overwrite target position and downAction if frost alarm is set.
                        if (statusAlarmFrost == true && shutterSettings[s].enableAlarmFrost == true) {
                            targetLevel2Set = parseFloat(String(adapter.config.alarmFrostLevel));
                            downAction = 'frost';
                        }

                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                        if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != targetLevel2Set) {

                            shutterSettings[s].currentHeight = targetLevel2Set;
                            shutterSettings[s].triggerHeight = targetLevel2Set;
                            shutterSettings[s].currentAction = downAction;
                            shutterSettings[s].triggerAction = downAction;

                            await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, `Button ${buttonState}`);

                            adapter.log.debug(`shutterDownButton ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${targetLevel2Set}%`);
                        } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == targetLevel2Set) {

                            shutterSettings[s].currentHeight = targetLevel2Set;
                            shutterSettings[s].triggerHeight = targetLevel2Set;
                            shutterSettings[s].currentAction = downAction;
                            shutterSettings[s].triggerAction = downAction;

                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                            adapter.log.debug(`shutterDownButton ${shutterSettings[s].shutterName} already down at: ${targetLevel2Set}% - setting current action: ${shutterSettings[s].currentAction}`);
                        }
                    } else if (buttonState == 'openAll' ||
                        buttonState == 'openLiving' ||
                        buttonState == 'openSleep' ||
                        buttonState == 'openChildren') {

                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                        if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterSettings[s].heightUp) {

                            shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                            shutterSettings[s].triggerHeight = shutterSettings[s].heightUp;
                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                            shutterSettings[s].currentAction = 'up';
                            shutterSettings[s].triggerAction = 'up';
                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;

                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(shutterSettings[s].heightUp)), nameDevice, `Button ${buttonState}`);

                            adapter.log.debug(`shutterUpButton ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].heightUp}%`);
                        } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterSettings[s].heightUp) {

                            shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                            shutterSettings[s].triggerHeight = shutterSettings[s].heightUp;
                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                            shutterSettings[s].currentAction = 'up';
                            shutterSettings[s].triggerAction = 'up';
                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;

                            await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                            adapter.log.debug(`shutterUpButton ${shutterSettings[s].shutterName} already up at: ${shutterSettings[s].heightUp}% - setting current action: ${shutterSettings[s].currentAction}`);
                        }
                    } else if (buttonState == 'sunProtect' ||
                        buttonState == 'sunProtectLiving' ||
                        buttonState == 'sunProtectSleep' ||
                        buttonState == 'sunProtectChildren') {

                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                        if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound != shutterSettings[s].heightDownSun) {

                            shutterSettings[s].currentHeight = shutterSettings[s].heightDownSun;
                            shutterSettings[s].triggerHeight = shutterSettings[s].heightDownSun;
                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                            shutterSettings[s].currentAction = 'manu_sunProtect';
                            shutterSettings[s].triggerAction = 'manu_sunProtect';
                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;

                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(shutterSettings[s].heightDownSun)), nameDevice, `Button ${buttonState}`);

                            adapter.log.debug(`shutterUpButton ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].heightUp}%`);
                        } else if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterSettings[s].heightDownSun) {

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

                        if (_shutterState?.val !== null && _shutterState?.val !== undefined) {
                            adapter.log.info(`Set ID: ${shutterSettings[s].shutterName} to Auto-Mode`);

                            if (Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterSettings[s].heightDownSun) {
                                shutterSettings[s].currentHeight = shutterSettings[s].heightDownSun;
                                shutterSettings[s].triggerHeight = shutterSettings[s].heightDownSun;
                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                shutterSettings[s].currentAction = 'sunProtect';
                                shutterSettings[s].triggerAction = 'sunProtect';
                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;

                                await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                adapter.log.debug(`shutterUpButton ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].heightDownSun}%`);

                            } else if (Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterSettings[s].heightUp) {
                                shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                shutterSettings[s].triggerHeight = shutterSettings[s].heightUp;
                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                shutterSettings[s].currentAction = 'up';
                                shutterSettings[s].triggerAction = 'up';
                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;

                                await setShutterInfo(adapter, shutterSettings, shutterSettings[s], nameDevice);

                                adapter.log.debug(`shutterUpButton ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].heightUp}%`);

                            } else if (Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) * adapter.config.shutterStateRound == shutterSettings[s].heightDown) {
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

                                await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(String(shutterSettings[s].heightUp)), nameDevice, `Button ${buttonState}`);
                                adapter.log.debug(`shutterUpButton ${shutterSettings[s].shutterName} old height: ${shutterSettings[s].oldHeight}% new height: ${shutterSettings[s].heightUp}%`);
                            }
                        }
                    }
                }
            }
            await adapter.delay(driveDelayUpLiving);
        }
        adapter.log.debug('Shuttercontrol save all shutter states');
        return (shutterSettings);
    }
}
