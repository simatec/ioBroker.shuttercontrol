'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');         // shutterState

function shutterDownLate(adapter, delayDown, shutterSettings) {

    try {
        if (adapter.config.LateAllDown) {

            const driveDelayDownLiving = adapter.config.driveDelayDownLiving * 1000;

            const downTimeLate = adapter.config.LateAllDownTime.split(':');

            adapter.log.debug('late down at ' + adapter.config.LateAllDownTime);

            schedule.cancelJob('shutterDownLate');

            const downLate = schedule.scheduleJob('shutterDownLate', downTimeLate[1] + ' ' + downTimeLate[0] + ' * * *', function () {
                delayDown = delayDown * driveDelayDownLiving;
                setTimeout(function () {

                    adapter.log.debug('now all down late');

                    // Full Result
                    const resultFull = shutterSettings;

                    if (resultFull) {

                        // Filter enabled
                        const resEnabled = resultFull.filter(d => d.enabled === true);

                        // Filter late down
                        const resLateDown = resEnabled.filter(d => d.LateDown === true);

                        adapter.log.debug('late down ' + JSON.stringify(resLateDown));

                        for (const i in resLateDown) {
                            let nameDevice = shutterSettings[i].shutterName.replace(/[.;, ]/g, '_');
                            adapter.log.info('#25 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDown + '%');
                            adapter.setForeignState(shutterSettings[i].name, parseFloat(shutterSettings[i].heightDown), false);
                            shutterSettings[i].currentHeight = shutterSettings[i].heightDown;
                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                            shutterSettings[i].currentAction = 'down';
                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                            adapter.log.debug('save current height: ' + shutterSettings[i].currentHeight + '%' + ' from ' + shutterSettings[i].shutterName);
                            shutterState(shutterSettings[i].name, adapter, shutterSettings);
                            return (shutterSettings);
                        }
                    }

                }, delayDown);
            });
        }
    }
    catch (e) {
        adapter.log.error('exception catch shutterDownLate [' + e + ']');
    }
}
module.exports = shutterDownLate;