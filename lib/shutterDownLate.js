'use strict';

// @ts-ignore
const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');                           // shutterState
const checkPendingAlarm = require('./shutterAlarm.js').checkPendingAlarm;    // shutterAlarm
const checkFrostAlarm = require('./shutterAlarm.js').checkFrostAlarm;      // shutterAlarm - check frost alarm


// @ts-ignore
function shutterDownLate(adapter, shutterSettings) {

    try {
        if (adapter.config.LateAllDown) {

            const driveDelayDownLiving = adapter.config.driveDelayDownLiving * 1000;

            const downTimeLate = adapter.config.LateAllDownTime.split(':');

            adapter.log.debug('late down at ' + adapter.config.LateAllDownTime);

            schedule.cancelJob('shutterDownLate');

            const downLate = schedule.scheduleJob('shutterDownLate', downTimeLate[1] + ' ' + downTimeLate[0] + ' * * *', function () {
                // Full Result
                const resultFull = shutterSettings;

                if (resultFull) {
                    // Filter enabled
                    const resEnabled = resultFull.filter(d => d.enabled === true);

                    // Filter late down
                    const resLateDown = resEnabled.filter(d => d.LateDown === true);

                    for (const i in resLateDown) {
                        for (const s in shutterSettings) {
                            let targetLevel2Set = shutterSettings[s].heightDown;
                            let downAction = 'down';

                            let pendingAlarm = false;
                            checkPendingAlarm(adapter, shutterSettings[s], function (resAlarmPending) {
                                pendingAlarm = resAlarmPending;

                                let statusAlarmFrost = false;
                                checkFrostAlarm(adapter, shutterSettings[s], function (resAlarmFrost) {
                                    statusAlarmFrost = resAlarmFrost;

                                    // save current required position to alarmtrigger before overwriting
                                    shutterSettings[s].alarmTriggerLevel = targetLevel2Set;
                                    shutterSettings[s].alarmTriggerAction = downAction;

                                    // overwrite target position and downAction if frost alarm is set.
                                    if (statusAlarmFrost == true && shutterSettings[s].enableAlarmFrost == true) {
                                        targetLevel2Set = parseFloat(adapter.config.alarmFrostLevel);
                                        downAction = 'frost';
                                    }
                                    if (pendingAlarm == false) {
                                        setTimeout(function () {
                                            if (shutterSettings[s].shutterName == resLateDown[i].shutterName) {
                                                let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                                                adapter.log.info('#25 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                                adapter.setForeignState(shutterSettings[s].name, parseFloat(targetLevel2Set), false);
                                                shutterSettings[s].currentHeight = targetLevel2Set;
                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                shutterSettings[s].currentAction = downAction;
                                                shutterSettings[s].lastAutoAction = 'Down_Late';
                                                adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                return (shutterSettings);
                                            }
                                            // @ts-ignore
                                        }, driveDelayDownLiving * i, i);
                                    } else {
                                        adapter.log.info('Down Late not moving now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                    }
                                });
                            });
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