'use strict';

const shutterState = require('./shutterState.js');         // shutterState

function buttonAction(adapter, buttonState, shutterSettings) {

    adapter.log.debug('start buttonAction');

    const driveDelayUpLiving = adapter.config.driveDelayUpLiving * 1000;
    // Full Result
    const resultFull = shutterSettings;
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
                resLiving = resultFull.filter(d => d.typeUp == 'sleep' || d.typeUp == 'sleep-auto');
                break;
            case 'closeSleep':
                resLiving = resultFull.filter(d => d.typeDown == 'sleep' || d.typeUp == 'sleep-auto');
                break;
            case 'openChildren':
                resLiving = resultFull.filter(d => d.typeUp == 'children' || d.typeUp == 'children-auto');
                break;
            case 'closeChildren':
                resLiving = resultFull.filter(d => d.typeDown == 'children' || d.typeUp == 'children-auto');
                break;
            case 'openAll':
                resLiving = resultFull.filter(d => d.typeUp != 'manual-only');
                break;
            case 'closeAll':
                resLiving = resultFull.filter(d => d.typeDown != 'manual-only');
                break;
            case 'sunProtect':
                resLiving = resultFull.filter(d => d.typeDown != 'manual-only');
                break;
            case 'sunProtectSleep':
                resLiving = resultFull.filter(d => d.typeDown == 'sleep' || d.typeUp == 'sleep-auto');
                break;
            case 'sunProtectChildren':
                resLiving = resultFull.filter(d => d.typeDown == 'children' || d.typeUp == 'children-auto');
                break;
            case 'sunProtectLiving':
                resLiving = resultFull.filter(d => d.typeDown == 'living' || d.typeUp == 'living-auto');
                break;
        }
        // Filter enabled
        let resEnabled = resLiving.filter(d => d.enabled === true);

        let result = resEnabled;

        for (const i in result) {
            let nameDevice = shutterSettings[i].shutterName.replace(/[.;, ]/g, '_');
            setTimeout(function () {
                if (buttonState == 'closeAll' || buttonState == 'closeLiving' || buttonState == 'closeSleep' || buttonState == 'closeChildren') {
                    adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                        if (typeof state != undefined && state != null && state.val != shutterSettings[i].heightDown) {
                            adapter.log.info('Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDown + '%');
                            adapter.setForeignState(shutterSettings[i].name, parseFloat(shutterSettings[i].heightDown), false);
                            shutterSettings[i].currentHeight = shutterSettings[i].heightDown;
                            shutterSettings[i].triggerHeight = shutterSettings[i].heightDown;
                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                            shutterSettings[i].currentAction = 'down';
                            shutterSettings[i].triggerAction = 'down';
                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                            adapter.log.debug('shutterDownButton ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterSettings[i].heightDown + '%');
                            shutterState(shutterSettings[i].name, adapter, shutterSettings);
                            return (shutterSettings);
                        }
                        else if (typeof state != undefined && state != null && state.val == shutterSettings[i].heightDown) {
                            shutterSettings[i].currentHeight = shutterSettings[i].heightDown;
                            shutterSettings[i].triggerHeight = shutterSettings[i].heightDown;
                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                            shutterSettings[i].currentAction = 'down';
                            shutterSettings[i].triggerAction = 'down';
                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                            adapter.log.debug('shutterDownButton ' + shutterSettings[i].shutterName + ' already down at: ' + shutterSettings[i].heightDown + '% - setting current action: ' + shutterSettings[i].currentAction);
                            shutterState(shutterSettings[i].name, adapter, shutterSettings);
                            return (shutterSettings);
                        }
                    });
                } else if ((buttonState == 'openAll' || buttonState == 'openLiving' || buttonState == 'openSleep' || buttonState == 'openChildren')) {
                    adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                        if (typeof state != undefined && state != null && state.val != shutterSettings[i].heightUp) {
                            adapter.log.info('Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightUp + '%');
                            adapter.setForeignState(shutterSettings[i].name, parseFloat(shutterSettings[i].heightUp), false);
                            shutterSettings[i].currentHeight = shutterSettings[i].heightUp;
                            shutterSettings[i].triggerHeight = shutterSettings[i].heightup;
                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                            shutterSettings[i].currentAction = 'up';
                            shutterSettings[i].triggerAction = 'up';
                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                            adapter.log.debug('shutterUpButton ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterSettings[i].heightUp + '%');
                            shutterState(shutterSettings[i].name, adapter, shutterSettings);
                            return (shutterSettings);
                        }
                        else if (typeof state != undefined && state != null && state.val == shutterSettings[i].heightUp) {
                            shutterSettings[i].currentHeight = shutterSettings[i].heightUp;
                            shutterSettings[i].triggerHeight = shutterSettings[i].heightup;
                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                            shutterSettings[i].currentAction = 'up';
                            shutterSettings[i].triggerAction = 'up';
                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                            adapter.log.debug('shutterUpButton ' + shutterSettings[i].shutterName + ' already up at: ' + shutterSettings[i].heightUp + '% - setting current action: ' + shutterSettings[i].currentAction);
                            shutterState(shutterSettings[i].name, adapter, shutterSettings);
                            return (shutterSettings);
                        }
                    });
                } else if ((buttonState == 'sunProtect' || buttonState == 'sunProtectLiving' || buttonState == 'sunProtectSleep' || buttonState == 'sunProtectChildren')) {
                    adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                        if (typeof state != undefined && state != null && state.val != shutterSettings[i].heightDownSun) {
                            adapter.log.info('Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDownSun + '%');
                            adapter.setForeignState(shutterSettings[i].name, parseFloat(shutterSettings[i].heightDownSun), false);
                            shutterSettings[i].currentHeight = shutterSettings[i].heightDownSun;
                            shutterSettings[i].triggerHeight = shutterSettings[i].heightDownSun;
                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                            shutterSettings[i].currentAction = 'manu_sunProtect';
                            shutterSettings[i].triggerAction = 'manu_sunProtect';
                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                            adapter.log.debug('shutterUpButton ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterSettings[i].heightUp + '%');
                            shutterState(shutterSettings[i].name, adapter, shutterSettings);
                            return (shutterSettings);
                        }
                        else if (typeof state != undefined && state != null && state.val == shutterSettings[i].heightDownSun) {
                            shutterSettings[i].currentHeight = shutterSettings[i].heightDownSun;
                            shutterSettings[i].triggerHeight = shutterSettings[i].heightDownSun;
                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                            shutterSettings[i].currentAction = 'manu_sunProtect';
                            shutterSettings[i].triggerAction = 'manu_sunProtect';
                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                            adapter.log.debug('shutterUpButton ' + shutterSettings[i].shutterName + ' already down at: ' + shutterSettings[i].heightDown + '% - setting current action: ' + shutterSettings[i].currentAction);
                            shutterState(shutterSettings[i].name, adapter, shutterSettings);
                            return (shutterSettings);
                        }
                    });
                }
            }, driveDelayUpLiving * i, i);
        }
    }
}
module.exports = buttonAction;