import * as schedule from 'node-schedule';
import { checkPendingAlarm, checkFrostAlarm } from './shutterAlarm';
import { setShutterState } from './setShutter';
import { driveWindowLevel } from './windowLevel';
import type { ShutterSettings } from './types';

export async function shutterDownLate(adapter: ioBroker.Adapter, shutterSettings: ShutterSettings[]): Promise<void> {
    try {
        if (adapter.config.LateAllDown) {
            const driveDelayDownLiving = adapter.config.driveDelayUpLiving != 0 ? adapter.config.driveDelayUpLiving * 1000 : 20;
            const downTimeLate = adapter.config.LateAllDownTime.split(':');

            adapter.log.debug(`late down at ${  adapter.config.LateAllDownTime}`);

            schedule.cancelJob('shutterDownLate');

            const downLate = schedule.scheduleJob('shutterDownLate', `${downTimeLate[1]  } ${  downTimeLate[0]  } * * *`, async function () {
                if (shutterSettings) {
                    const resEnabled = shutterSettings.filter((d) => d.enabled === true || d.enabled === 'true'); // Filter enabled
                    const resLateDown = resEnabled.filter((d) => d.LateDown === true); // Filter late down

                    for (let i = 0; i < resLateDown.length; i++) {
                        for (let s = 0; s < shutterSettings.length; s++) {
                            if (shutterSettings[s].shutterName == resLateDown[i].shutterName) {
                                let targetLevel2Set = parseFloat(String(shutterSettings[s].heightDown));
                                let downAction = 'down';

                                const pendingAlarm = await checkPendingAlarm(adapter, shutterSettings[s]);
                                const statusAlarmFrost = await checkFrostAlarm(adapter, shutterSettings[s]);

                                // save current required position to alarmtrigger before overwriting
                                shutterSettings[s].alarmTriggerLevel = targetLevel2Set;
                                shutterSettings[s].alarmTriggerAction = downAction;

                                // overwrite target position and downAction if frost alarm is set.
                                if (statusAlarmFrost == true && shutterSettings[s].enableAlarmFrost == true) {
                                    targetLevel2Set = parseFloat(String(adapter.config.alarmFrostLevel));
                                    downAction = 'frost';
                                }

                                if (pendingAlarm == false) {
                                    const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                                    shutterSettings[s].currentHeight = targetLevel2Set;
                                    shutterSettings[s].currentAction = downAction;
                                    shutterSettings[s].lastAutoAction = 'Down_Late';
                                    shutterSettings[s].triggerHeight = targetLevel2Set; // reset Trigger
                                    shutterSettings[s].triggerAction = downAction;      // reset Trigger

                                    await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Down Late #25');

                                    adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                    adapter.log.debug(`save current height: ${  shutterSettings[s].currentHeight  }%` + ` from ${  shutterSettings[s].shutterName}`);

                                    // the shutter is closed first and only then moved to the ventilation height
                                    driveWindowLevel(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, downAction, nameDevice)
                                        .catch((e) => adapter.log.warn(`#driveWindowLevel: ${e}`));

                                    await adapter.delay(driveDelayDownLiving);
                                } else {
                                    adapter.log.info(`Down Late not moving now due to active alarm: ${  shutterSettings[s].shutterName  } value: ${  targetLevel2Set  }%`);
                                }
                            }
                        }
                    }
                    return (shutterSettings);
                }
            });
        }
    } catch (e) {
        adapter.log.error(`exception catch shutterDownLate [${  e  }]`);
    }
}
