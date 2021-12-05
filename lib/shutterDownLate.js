'use strict';


// @ts-ignore
const schedule = require('node-schedule');
const checkPendingAlarm = require('./shutterAlarm.js').checkPendingAlarm;       // shutterAlarm
const checkFrostAlarm = require('./shutterAlarm.js').checkFrostAlarm;           // shutterAlarm - check frost alarm
const setShutterState = require('./setShutter.js').setShutterState;             // set Shutter State

async function shutterDownLate(adapter, shutterSettings) {
    try {
        if (adapter.config.LateAllDown) {
            const driveDelayDownLiving = adapter.config.driveDelayDownLiving * 1000;
            const downTimeLate = adapter.config.LateAllDownTime.split(':');

            adapter.log.debug('late down at ' + adapter.config.LateAllDownTime);

            schedule.cancelJob('shutterDownLate');

            const downLate = schedule.scheduleJob('shutterDownLate', downTimeLate[1] + ' ' + downTimeLate[0] + ' * * *', async function () {
                if (shutterSettings) {
                    const resEnabled = shutterSettings.filter((/** @type {{ enabled: boolean; }} */ d) => d.enabled === true); // Filter enabled
                    const resLateDown = resEnabled.filter((/** @type {{ LateDown: boolean; }} */ d) => d.LateDown === true); // Filter late down

                    for (const i in resLateDown) {
                        for (const s in shutterSettings) {
                            let targetLevel2Set = parseFloat(shutterSettings[s].heightDown);
                            let downAction = 'down';

                            const pendingAlarm = await checkPendingAlarm(adapter, shutterSettings[s]);
                            const statusAlarmFrost = await checkFrostAlarm(adapter, shutterSettings[s]);

                            // save current required position to alarmtrigger before overwriting
                            shutterSettings[s].alarmTriggerLevel = targetLevel2Set;
                            shutterSettings[s].alarmTriggerAction = downAction;

                            // overwrite target position and downAction if frost alarm is set.
                            if (statusAlarmFrost == true && shutterSettings[s].enableAlarmFrost == true) {
                                targetLevel2Set = parseFloat(adapter.config.alarmFrostLevel);
                                downAction = 'frost';
                            }

                            if (pendingAlarm == false) {
                                setTimeout(async function () {
                                    if (shutterSettings[s].shutterName == resLateDown[i].shutterName) {
                                        const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                        shutterSettings[s].currentAction = downAction;
                                        shutterSettings[s].lastAutoAction = 'Down_Late';
                                        shutterSettings[s].triggerHeight = targetLevel2Set; // reset Trigger
                                        shutterSettings[s].triggerAction = downAction;      // reset Trigger

                                        await setShutterState(adapter, shutterSettings, shutterSettings[s], targetLevel2Set, nameDevice, 'Down Late #25');

                                        adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                        adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                        return (shutterSettings);
                                    }
                                    // @ts-ignore
                                }, driveDelayDownLiving * i, i);
                            } else {
                                adapter.log.info('Down Late not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                            }
                        }
                    }
                }
            });
        }
    }
    catch (e) {
        adapter.log.error('exception catch shutterDownLate [' + e + ']');
    }
}
module.exports = shutterDownLate;