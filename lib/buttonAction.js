'use strict';

const shutterState = require('./shutterState.js');         // shutterState
const checkFrostAlarm = require('./shutterAlarm.js').checkFrostAlarm;      // shutterAlarm - check frost alarm

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
            case 'autoAll':
                resLiving = resultFull.filter(d => d.typeUp != 'manual-only');
                break;
        }
        // Filter enabled
        let resEnabled = resLiving.filter(d => d.enabled === true);

        let result = resEnabled;

        for (const i in result) {
            for (const s in shutterSettings) {
                if (shutterSettings[s].shutterName == result[i].shutterName) {
                    let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                    let targetLevel2Set = 0;
                    let downAction = 'down';

                    let statusAlarmFrost = false;
                    checkFrostAlarm(adapter, shutterSettings[s], function(resAlarmFrost) {
                        statusAlarmFrost = resAlarmFrost;

                        setTimeout(function () {
                            if (buttonState == 'closeAll' || buttonState == 'closeLiving' || buttonState == 'closeSleep' || buttonState == 'closeChildren') {

                                targetLevel2Set = shutterSettings[s].heightDown;
                                downAction = 'down';

                                // save current required position to alarmtrigger before overwriting
                                shutterSettings[s].alarmTriggerLevel = targetLevel2Set;
                                shutterSettings[s].alarmTriggerAction = downAction;

                                // overwrite target position and downAction if frost alarm is set.
                                if (statusAlarmFrost == true && shutterSettings[s].enableAlarmFrost == true) { 
                                    targetLevel2Set = parseFloat(adapter.config.alarmFrostLevel);
                                    downAction = 'frost';
                                } 

                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                    if (typeof state != undefined && state != null && state.val != targetLevel2Set) {
                                        adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + targetLevel2Set + '%');
                                        adapter.setForeignState(shutterSettings[s].name, parseFloat(targetLevel2Set), false);
                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                        shutterSettings[s].triggerHeight = targetLevel2Set;
                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                        shutterSettings[s].currentAction = downAction;
                                        shutterSettings[s].triggerAction = downAction;
                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                        adapter.log.debug('shutterDownButton ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + targetLevel2Set + '%');
                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                        return (shutterSettings);
                                    }
                                    else if (typeof state != undefined && state != null && state.val == targetLevel2Set) {
                                        shutterSettings[s].currentHeight = targetLevel2Set;
                                        shutterSettings[s].triggerHeight = targetLevel2Set;
                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                        shutterSettings[s].currentAction = downAction;
                                        shutterSettings[s].triggerAction = downAction;
                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                        adapter.log.debug('shutterDownButton ' + shutterSettings[s].shutterName + ' already down at: ' + targetLevel2Set + '% - setting current action: ' + shutterSettings[s].currentAction);
                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                        return (shutterSettings);
                                    }
                                });
                            } else if ((buttonState == 'openAll' || buttonState == 'openLiving' || buttonState == 'openSleep' || buttonState == 'openChildren')) {
                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                    if (typeof state != undefined && state != null && state.val != shutterSettings[s].heightUp) {
                                        adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%');
                                        adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].heightUp), false);
                                        shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                        shutterSettings[s].triggerHeight = shutterSettings[s].heightUp;
                                        shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                        shutterSettings[s].currentAction = 'up';
                                        shutterSettings[s].triggerAction = 'up';
                                        shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                        adapter.log.debug('shutterUpButton ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightUp + '%');
                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                        return (shutterSettings);
                                    }
                                    else if (typeof state != undefined && state != null && state.val == shutterSettings[s].heightUp) {
                                        shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                        shutterSettings[s].triggerHeight = shutterSettings[s].heightUp;
                                        shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                        shutterSettings[s].currentAction = 'up';
                                        shutterSettings[s].triggerAction = 'up';
                                        shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                        adapter.log.debug('shutterUpButton ' + shutterSettings[s].shutterName + ' already up at: ' + shutterSettings[s].heightUp + '% - setting current action: ' + shutterSettings[s].currentAction);
                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                        return (shutterSettings);
                                    }
                                });
                            } else if ((buttonState == 'sunProtect' || buttonState == 'sunProtectLiving' || buttonState == 'sunProtectSleep' || buttonState == 'sunProtectChildren')) {
                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                    if (typeof state != undefined && state != null && state.val != shutterSettings[s].heightDownSun) {
                                        adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDownSun + '%');
                                        adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].heightDownSun), false);
                                        shutterSettings[s].currentHeight = shutterSettings[s].heightDownSun;
                                        shutterSettings[s].triggerHeight = shutterSettings[s].heightDownSun;
                                        shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                        shutterSettings[s].currentAction = 'manu_sunProtect';
                                        shutterSettings[s].triggerAction = 'manu_sunProtect';
                                        shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                        adapter.log.debug('shutterUpButton ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightUp + '%');
                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                        return (shutterSettings);
                                    }
                                    else if (typeof state != undefined && state != null && state.val == shutterSettings[s].heightDownSun) {
                                        shutterSettings[s].currentHeight = shutterSettings[s].heightDownSun;
                                        shutterSettings[s].triggerHeight = shutterSettings[s].heightDownSun;
                                        shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                        shutterSettings[s].currentAction = 'manu_sunProtect';
                                        shutterSettings[s].triggerAction = 'manu_sunProtect';
                                        shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                        adapter.log.debug('shutterUpButton ' + shutterSettings[s].shutterName + ' already down at: ' + shutterSettings[s].heightDown + '% - setting current action: ' + shutterSettings[s].currentAction);
                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                        return (shutterSettings);
                                    }
                                });
                            } else if (buttonState == 'autoAll') {
                                // @ts-ignore
                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                    if (typeof state != undefined && state != null && state.val) {
                                        adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' to Auto-Mode');
                                        if (state.val == shutterSettings[s].heightDownSun) {
                                            shutterSettings[s].currentHeight = shutterSettings[s].heightDownSun;
                                            shutterSettings[s].triggerHeight = shutterSettings[s].heightDownSun;
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                            shutterSettings[s].currentAction = 'sunProtect';
                                            shutterSettings[s].triggerAction = 'sunProtect';
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                            adapter.log.debug('shutterUpButton ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightDownSun + '%');
                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                            return (shutterSettings);
                                        } else if (state.val == shutterSettings[s].heightUp) {
                                            shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                            shutterSettings[s].triggerHeight = shutterSettings[s].heightUp;
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                            shutterSettings[s].currentAction = 'up';
                                            shutterSettings[s].triggerAction = 'up';
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                            adapter.log.debug('shutterUpButton ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightUp + '%');
                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                            return (shutterSettings);
                                        } else if (state.val == shutterSettings[s].heightDown) {
                                            shutterSettings[s].currentHeight = shutterSettings[s].heightDown;
                                            shutterSettings[s].triggerHeight = shutterSettings[s].heightDown;
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                            shutterSettings[s].currentAction = 'down';
                                            shutterSettings[s].triggerAction = 'down';
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                            adapter.log.debug('shutterUpButton ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightDown + '%');
                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                            return (shutterSettings);
                                        } else {
                                            adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].heightUp), false);
                                            shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                            shutterSettings[s].triggerHeight = shutterSettings[s].heightUp;
                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                            shutterSettings[s].currentAction = 'up';
                                            shutterSettings[s].triggerAction = 'up';
                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                            adapter.log.debug('shutterUpButton ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightUp + '%');
                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                            return (shutterSettings);
                                        }
                                    }
                                });
                            }
                        // @ts-ignore
                        }, driveDelayUpLiving * i, i);
                    });
                }
            }
        }
    }
}
module.exports = buttonAction;