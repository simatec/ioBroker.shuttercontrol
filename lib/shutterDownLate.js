'use strict';

// @ts-ignore
const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');         // shutterState

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
                            setTimeout(function () {
                                if (shutterSettings[s].shutterName == resLateDown[i].shutterName) {
                                    let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                                    adapter.log.info('#25 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDown + '%');
                                    adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].heightDown), false);
                                    shutterSettings[s].currentHeight = shutterSettings[s].heightDown;
                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseInt(shutterSettings[s].currentHeight), ack: true });
                                    shutterSettings[s].currentAction = 'down';
                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                    adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                    return (shutterSettings);
                                }
                            // @ts-ignore
                            }, driveDelayDownLiving * i, i);
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