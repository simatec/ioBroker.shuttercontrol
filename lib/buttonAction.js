'use strict';

const shutterState = require('./shutterState.js');         // shutterState

function buttonAction(adapter, buttonState) {

    adapter.log.debug('start buttonAction');

    const driveDelayUpLiving = adapter.config.driveDelayUpLiving * 1000;
    // Full Result
    const resultFull = adapter.config.events;
    // Filter Area
    let resLiving;

    if (resultFull) {
        switch (buttonState) {
            case 'openLiving':
                resLiving = resultFull.filter(d => d.typeUp == 'living' || d.typeUp == 'living-auto');
                break;
            case 'closeLiving':
                resLiving = resultFull.filter(d => d.typeDown == 'living' || d.typeUp == 'living-auto');
                break;
            case 'openSleep':
                resLiving = resultFull.filter(d => d.typeUp == 'sleep' || d.typeUp == 'sleep-auto' );
                break;
            case 'closeSleep':
                resLiving = resultFull.filter(d => d.typeDown == 'sleep' || d.typeUp == 'sleep-auto');
                break;
            case 'openAll':
                resLiving = resultFull;
                break;
            case 'closeAll':
                resLiving = resultFull;
                break;
            case 'sunProtect':
                resLiving = resultFull;
                break;
			case 'sunProtectSleep':
                resLiving = resultFull.filter(d => d.typeDown == 'sleep' || d.typeUp == 'sleep-auto');
                break;
			case 'sunProtectLiving':
                resLiving = resultFull.filter(d => d.typeDown == 'living' || d.typeUp == 'living-auto');
                break;
        }
        // Filter enabled
        let resEnabled = resLiving.filter(d => d.enabled === true);

        let result = resEnabled;

        for (const i in result) {
            let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
            setTimeout(function () {
                if (buttonState == 'closeAll' || buttonState == 'closeLiving' || buttonState == 'closeSleep') {
                    adapter.getForeignState(result[i].name, (err, state) => {
                        if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                            adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                            result[i].currentHeight = result[i].heightDown;
                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                            result[i].currentAction = 'down';
                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                            adapter.log.debug('shutterDownButton ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDownt + '%');
                            shutterState(result[i].name, adapter);
                        }
                    });
                } else if ((buttonState == 'openAll' || buttonState == 'openLiving' || buttonState == 'openSleep')) {
                    adapter.getForeignState(result[i].name, (err, state) => {
                        if (typeof state != undefined && state != null && state.val != result[i].heightUp) {
                            adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightUp + '%');
                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                            result[i].currentHeight = result[i].heightUp;
                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                            result[i].currentAction = 'up';
                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                            adapter.log.debug('shutterUpButton ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightUp + '%');
                            shutterState(result[i].name, adapter);
                        }
                    });
                } else if ((buttonState == 'sunProtect' || buttonState == 'sunProtectLiving' || buttonState == 'sunProtectSleep')) {
                    adapter.getForeignState(result[i].name, (err, state) => {
                        if (typeof state != undefined && state != null && state.val != result[i].heightDownSun) {
                            adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%');
                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightDownSun), false);
                            result[i].currentHeight = result[i].heightDownSun;
                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                            result[i].currentAction = 'manu_sunProtect';
                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                            adapter.log.debug('shutterUpButton ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightUp + '%');
                            shutterState(result[i].name, adapter);
                        }
                    });
                }
            }, driveDelayUpLiving * i, i);
        }
    }
}
module.exports = buttonAction;