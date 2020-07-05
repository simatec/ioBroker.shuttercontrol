'use strict';

const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');         // shutterState

function shutterDownLate(adapter, delayDown) {

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
                    const resultFull = adapter.config.events;

                    if (resultFull) {

                        // Filter enabled
                        const resEnabled = resultFull.filter(d => d.enabled === true);

                        // Filter late down
                        const resLateDown = resEnabled.filter(d => d.LateDown === true);

                        adapter.log.debug('late down ' + JSON.stringify(resLateDown));

                        for (const i in resLateDown) {
                            let nameDevice = resLateDown[i].shutterName.replace(/[.;, ]/g, '_');
                            adapter.log.info('#25 Set ID: ' + resLateDown[i].shutterName + ' value: ' + resLateDown[i].heightDown + '%');
                            adapter.setForeignState(resLateDown[i].name, parseFloat(resLateDown[i].heightDown), false);
                            resLateDown[i].currentHeight = resLateDown[i].heightDown;
                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: resLateDown[i].currentHeight, ack: true });
                            resLateDown[i].currentAction = 'down';
                            adapter.setState('shutters.autoState.' + nameDevice, { val: resLateDown[i].currentAction, ack: true });
                            adapter.log.debug('save current height: ' + resLateDown[i].currentHeight + '%' + ' from ' + resLateDown[i].shutterName);
                            shutterState(resLateDown[i].name, adapter);
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