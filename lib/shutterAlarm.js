'use strict';

const shutterState = require('./shutterState.js');         // shutterState

// @ts-ignore
function shutterAlarm(adapter, alarmType, shutterSettings) {

    adapter.log.debug('start shutterAlarm');

    const alarmWind1Level = adapter.config.alarmWind1Level;
    const alarmWind2Level = adapter.config.alarmWind2Level;
    const alarmRainLevel = adapter.config.alarmRainLevel;
    const alarmFrostLevel = adapter.config.alarmFrostLevel;
    const alarmFireLevel = adapter.config.alarmFireLevel;
    const driveDelayUpAstro = adapter.config.driveDelayUpAstro != 0 ? adapter.config.driveDelayUpAstro * 1000 : 2000;

    let statusAlarmWind1 = false;
    let statusAlarmWind2 = false;
    let statusAlarmRain = false;
    let statusAlarmFrost = false;
    let statusAlarmFire = false;
    let currentValue = ''; // window trigger value
    let mustValue = '';  // Window trigger referenz value
    let mustValueTilted = '' // Window trigger referenz value Tilted
    let pendingAlarm = false;


    // Full Result
    const resultFull = shutterSettings;
    // Filter Area
    let resAlarm;

    if (resultFull) {
        switch (alarmType) {
            case 'alarmWind1':
                // @ts-ignore
                resAlarm = resultFull.filter(d => d.enableAlarmWind1 == true);
                break;
            case 'alarmWind2':
                // @ts-ignore
                resAlarm = resultFull.filter(d => d.enableAlarmWind2 == true);
                break;
            case 'alarmRain':
                // @ts-ignore
                resAlarm = resultFull.filter(d => d.enableAlarmRain == true);
                break;
            case 'alarmFrost':
                // @ts-ignore
                resAlarm = resultFull.filter(d => d.enableAlarmFrost == true);
                break;
            case 'alarmFire':
                // @ts-ignore
                resAlarm = resultFull.filter(d => d.enableAlarmFire == true);
                break;

        }
        // Filter enabled
        // @ts-ignore
        let resEnabled = resAlarm.filter(d => d.enabled === true);

        let result = resEnabled;

        for (const i in result) {
            for (const s in shutterSettings) {
                if (shutterSettings[s].shutterName == result[i].shutterName) {
                    let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');


                    /** @type {boolean} */
                    let convertShutter;
                    if (parseFloat(shutterSettings[s].heightDown) < parseFloat(shutterSettings[s].heightUp)) {
                        convertShutter = false;
                    } else if (parseFloat(shutterSettings[s].heightDown) > parseFloat(shutterSettings[s].heightUp)) {
                        convertShutter = true;
                    }

                    // @ts-ignore
                    checkPendingAlarm(adapter, shutterSettings[s], function (resAlarmPending) {
                        pendingAlarm = resAlarmPending;
                        /**
                        * @param {any} err
                        * @param {{ val: string; }} state
                        */
                        // @ts-ignore
                        adapter.getForeignState(adapter.config.alarmWind1, (err, state) => {
                            if (typeof state != undefined && state != null) {
                                statusAlarmWind1 = state.val;
                            }

                            /**
                            * @param {any} err
                            * @param {{ val: string; }} state
                            */
                            // @ts-ignore
                            adapter.getForeignState(adapter.config.alarmWind2, (err, state) => {
                                if (typeof state != undefined && state != null) {
                                    statusAlarmWind2 = state.val;
                                }

                                /**
                                * @param {any} err
                                * @param {{ val: string; }} state
                                */
                                // @ts-ignore
                                adapter.getForeignState(adapter.config.alarmRain, (err, state) => {
                                    if (typeof state != undefined && state != null) {
                                        statusAlarmRain = state.val;
                                    }

                                    /**
                                    * @param {any} err
                                    * @param {{ val: string; }} state
                                    */
                                    // @ts-ignore
                                    adapter.getForeignState(adapter.config.alarmFrost, (err, state) => {
                                        if (typeof state != undefined && state != null) {
                                            statusAlarmFrost = state.val;
                                        }

                                        /**
                                        * @param {any} err
                                        * @param {{ val: string; }} state
                                        */
                                        // @ts-ignore
                                        adapter.getForeignState(adapter.config.alarmFire, (err, state) => {
                                            if (typeof state != undefined && state != null) {
                                                statusAlarmFire = state.val;
                                            }

                                            /**
                                             * @param {any} err
                                             * @param {{ val: string; }} state
                                             */
                                            // @ts-ignore
                                            adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {
                                                mustValue = ('' + shutterSettings[s].triggerState);
                                                mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);
                                                if (typeof state != undefined && state != null) {
                                                    currentValue = ('' + state.val);
                                                }

                                                switch (alarmType) {

                                                    // +++++++++++++++++ Alarm Wind 1  +++++++++++++++
                                                    case 'alarmWind1':
                                                        setTimeout(function () {
                                                            if (statusAlarmWind1 == true) {
                                                                // @ts-ignore
                                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null && parseFloat(state.val) != parseFloat(alarmWind1Level) && statusAlarmFire == false) {
                                                                        if (statusAlarmWind2 == false && statusAlarmRain == false && statusAlarmFrost == false && statusAlarmFire == false) {
                                                                            if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                                                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                                                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                                                            } else {
                                                                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                                                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                                                            }
                                                                        }
                                                                        adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + parseFloat(alarmWind1Level) + '%');
                                                                        adapter.setForeignState(shutterSettings[s].name, parseFloat(alarmWind1Level), false);
                                                                        shutterSettings[s].currentHeight = parseFloat(alarmWind1Level);
                                                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                        shutterSettings[s].currentAction = 'wind1';
                                                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        adapter.log.debug('shutter alarm wind 1 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                        return (shutterSettings);
                                                                    }
                                                                    else if (typeof state != undefined && state != null && parseFloat(state.val) == parseFloat(alarmWind1Level) && statusAlarmFire == false) {
                                                                        if ((statusAlarmWind2 == false && statusAlarmRain == false && statusAlarmFrost == false && statusAlarmFire == false)) {
                                                                            if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                                                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                                                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                                                            } else {
                                                                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                                                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                                                            }
                                                                        }
                                                                        shutterSettings[s].currentHeight = parseFloat(alarmWind1Level);
                                                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                        shutterSettings[s].currentAction = 'wind1';
                                                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        adapter.log.debug('shutter alarm wind 1 ' + shutterSettings[s].shutterName + ' already at: ' + shutterSettings[s].currentHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                        return (shutterSettings);
                                                                    }
                                                                });
                                                            } else if (statusAlarmWind1 == false) {
                                                                if (pendingAlarm == false && statusAlarmFrost == false) {
                                                                    if (currentValue === mustValue || currentValue === mustValueTilted || shutterSettings[s].triggerID == '') {
                                                                        // @ts-ignore
                                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null && parseFloat(state.val) != parseFloat(shutterSettings[s].alarmTriggerLevel)) {
                                                                                adapter.log.info('Alarm Wind 1 ended - Set ID: ' + shutterSettings[s].shutterName + ' value: ' + parseFloat(shutterSettings[s].alarmTriggerLevel) + '%');
                                                                                adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].alarmTriggerLevel), false);
                                                                                shutterSettings[s].currentHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                                                                shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                                shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                                                                shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                adapter.log.debug('shutter alarm wind 1 endet and no other alarm is pending ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                return (shutterSettings);
                                                                            }
                                                                            else if (typeof state != undefined && state != null && parseFloat(state.val) == parseFloat(shutterSettings[s].alarmTriggerLevel)) {
                                                                                shutterSettings[s].currentHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                                                                shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                                shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                                                                shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                adapter.log.debug('shutter alarm wind 1 endet and no other alarm is pending ' + shutterSettings[s].shutterName + ' already at: ' + shutterSettings[s].currentHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                return (shutterSettings);
                                                                            }
                                                                        });
                                                                    } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                                                        /**
                                                                        * @param {any} err
                                                                        * @param {{ val: any; }} state
                                                                        */
                                                                        // @ts-ignore
                                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                adapter.log.info('#Shutter alarm wind1 endet - Will move ID: ' + shutterSettings[s].shutterName + ' value: ' + parseFloat(shutterSettings[s].alarmTriggerLevel) + '%' + ' after the window has been closed ');
                                                                                shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                                                                adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                                                shutterSettings[s].triggerAction = shutterSettings[s].alarmTriggerAction;
                                                                                adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                                shutterSettings[s].currentHeight = shutterSettings[s].triggerDrive;
                                                                                adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].currentHeight), false);
                                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                                shutterSettings[s].currentAction = 'triggered';
                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                return (shutterSettings);
                                                                            }
                                                                        });
                                                                    }
                                                                } else {
                                                                    adapter.log.info('Alarm Wind 1 endet for ID: ' + shutterSettings[s].shutterName + ' driving to next highest alarm priority');
                                                                    if (statusAlarmFire == false) {
                                                                        if (statusAlarmFrost == true) {
                                                                            if (shutterSettings[s].alarmTriggerAction == 'down') {
                                                                                shutterSettings[s].currentAction = 'frost';
                                                                                shutterSettings[s].currentHeight = alarmFrostLevel;
                                                                            } else {
                                                                                shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                                                                shutterSettings[s].currentHeight = shutterSettings[s].alarmTriggerLevel;
                                                                            }
                                                                        }
                                                                        if (statusAlarmWind2 == true) {
                                                                            shutterSettings[s].currentHeight = alarmWind2Level;
                                                                            shutterSettings[s].currentAction = 'wind2';
                                                                        }
                                                                        if (statusAlarmRain == true) {
                                                                            shutterSettings[s].currentHeight = alarmRainLevel;
                                                                            shutterSettings[s].currentAction = 'rain';
                                                                        }

                                                                        adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].currentHeight + '%');
                                                                        adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].currentHeight), false);
                                                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        adapter.log.debug('shutter alarm ' + shutterSettings[s].currentAction + ' ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                        return (shutterSettings);
                                                                    }
                                                                }
                                                            }
                                                            // @ts-ignore
                                                        }, driveDelayUpAstro * i, i);
                                                        break;

                                                    // +++++++++++++++++ Alarm Wind 2  +++++++++++++++
                                                    case 'alarmWind2':
                                                        setTimeout(function () {
                                                            if (statusAlarmWind2 == true) {
                                                                // @ts-ignore
                                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null && parseFloat(state.val) != parseFloat(alarmWind2Level) && statusAlarmFire == false) {
                                                                        if (statusAlarmWind1 == false && statusAlarmRain == false && statusAlarmFrost == false && statusAlarmFire == false) {
                                                                            if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                                                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                                                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                                                            } else {
                                                                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                                                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                                                            }
                                                                        }
                                                                        adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + parseFloat(alarmWind2Level) + '%');
                                                                        adapter.setForeignState(shutterSettings[s].name, parseFloat(alarmWind2Level), false);
                                                                        shutterSettings[s].currentHeight = parseFloat(alarmWind2Level);
                                                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                        shutterSettings[s].currentAction = 'wind2';
                                                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        adapter.log.debug('shutter alarm wind 2 ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                        return (shutterSettings);
                                                                    }
                                                                    else if (typeof state != undefined && state != null && parseFloat(state.val) == parseFloat(alarmWind2Level)) {
                                                                        if (statusAlarmWind2 == false && statusAlarmRain == false && statusAlarmFrost == false && statusAlarmFire == false) {
                                                                            if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                                                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                                                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                                                            } else {
                                                                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                                                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                                                            }
                                                                        }
                                                                        shutterSettings[s].currentHeight = parseFloat(alarmWind2Level);
                                                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                        shutterSettings[s].currentAction = 'wind2';
                                                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        adapter.log.debug('shutter alarm wind 2 ' + shutterSettings[s].shutterName + ' already at: ' + shutterSettings[s].currentHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                        return (shutterSettings);
                                                                    }
                                                                });
                                                            } else if (statusAlarmWind2 == false) {
                                                                if (pendingAlarm == false && statusAlarmFrost == false) {
                                                                    if (currentValue === mustValue || currentValue === mustValueTilted || shutterSettings[s].triggerID == '') {
                                                                        // @ts-ignore
                                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null && parseFloat(state.val) != parseFloat(shutterSettings[s].alarmTriggerLevel) && statusAlarmFire == false) {
                                                                                adapter.log.info('Alarm Wind 2 ended - Set ID: ' + shutterSettings[s].shutterName + ' value: ' + parseFloat(shutterSettings[s].alarmTriggerLevel) + '%');
                                                                                adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].alarmTriggerLevel), false);
                                                                                shutterSettings[s].currentHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                                                                shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                                shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                                                                shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                adapter.log.debug('shutter alarm wind 2 endet and no other alarm is pending ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                return (shutterSettings);
                                                                            }
                                                                            else if (typeof state != undefined && state != null && parseFloat(state.val) == parseFloat(shutterSettings[s].alarmTriggerLevel)) {
                                                                                shutterSettings[s].currentHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                                                                shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                                shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                                                                shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                adapter.log.debug('shutter alarm wind 2 endet and no other alarm is pending ' + shutterSettings[s].shutterName + ' already at: ' + shutterSettings[s].currentHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                return (shutterSettings);
                                                                            }
                                                                        });
                                                                    } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                                                        /**
                                                                        * @param {any} err
                                                                        * @param {{ val: any; }} state
                                                                        */
                                                                        // @ts-ignore
                                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                adapter.log.info('#Shutter alarm wind 2 endet - Will move ID: ' + shutterSettings[s].shutterName + ' value: ' + parseFloat(shutterSettings[s].alarmTriggerLevel) + '%' + ' after the window has been closed ');
                                                                                shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                                                                adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                                                shutterSettings[s].triggerAction = shutterSettings[s].alarmTriggerAction;
                                                                                adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                                shutterSettings[s].currentHeight = shutterSettings[s].triggerDrive;
                                                                                adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].currentHeight), false);
                                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                                shutterSettings[s].currentAction = 'triggered';
                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                return (shutterSettings);
                                                                            }
                                                                        });
                                                                    }
                                                                } else {
                                                                    adapter.log.info('Alarm Wind 2 endet for ID: ' + shutterSettings[s].shutterName + ' driving to next highest alarm priority');
                                                                    if (statusAlarmFire == false) {
                                                                        if (statusAlarmFrost == true) {
                                                                            if (shutterSettings[s].alarmTriggerAction == 'down') {
                                                                                shutterSettings[s].currentAction = 'frost';
                                                                                shutterSettings[s].currentHeight = alarmFrostLevel;
                                                                            } else {
                                                                                shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                                                                shutterSettings[s].currentHeight = shutterSettings[s].alarmTriggerLevel;
                                                                            }
                                                                        }
                                                                        if (statusAlarmWind1 == true) {
                                                                            shutterSettings[s].currentHeight = alarmWind1Level;
                                                                            shutterSettings[s].currentAction = 'wind1';
                                                                        }
                                                                        if (statusAlarmRain == true) {
                                                                            shutterSettings[s].currentHeight = alarmRainLevel;
                                                                            shutterSettings[s].currentAction = 'rain';
                                                                        }

                                                                        adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].currentHeight + '%');
                                                                        adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].currentHeight), false);
                                                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        adapter.log.debug('shutter alarm ' + shutterSettings[s].currentAction + ' ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                        return (shutterSettings);
                                                                    }
                                                                }
                                                            }

                                                            // @ts-ignore
                                                        }, driveDelayUpAstro * i, i);
                                                        break;

                                                    // +++++++++++++++++ Alarm Rain  +++++++++++++++
                                                    case 'alarmRain':
                                                        setTimeout(function () {
                                                            if (statusAlarmRain == true) {
                                                                // @ts-ignore
                                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null && parseFloat(state.val) != parseFloat(alarmRainLevel) && statusAlarmFire == false) {
                                                                        if (statusAlarmWind1 == false && statusAlarmWind2 == false && statusAlarmFrost == false && statusAlarmFire == false) {
                                                                            if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                                                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                                                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                                                            } else {
                                                                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                                                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                                                            }
                                                                        }
                                                                        adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + parseFloat(alarmRainLevel) + '%');
                                                                        adapter.setForeignState(shutterSettings[s].name, parseFloat(alarmRainLevel), false);
                                                                        shutterSettings[s].currentHeight = parseFloat(alarmRainLevel);
                                                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                        shutterSettings[s].currentAction = 'rain';
                                                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        adapter.log.debug('shutter alarm rain ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                        return (shutterSettings);
                                                                    }
                                                                    else if (typeof state != undefined && state != null && parseFloat(state.val) == parseFloat(alarmRainLevel) && statusAlarmFire == false) {
                                                                        if (statusAlarmWind1 == false && statusAlarmWind2 == false && statusAlarmFrost == false && statusAlarmFire == false) {
                                                                            if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                                                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                                                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                                                            } else {
                                                                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                                                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                                                            }
                                                                        }
                                                                        shutterSettings[s].currentHeight = parseFloat(alarmRainLevel);
                                                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                        shutterSettings[s].currentAction = 'rain';
                                                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        adapter.log.debug('shutter alarm rain ' + shutterSettings[s].shutterName + ' already at: ' + shutterSettings[s].currentHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                        return (shutterSettings);
                                                                    }
                                                                });
                                                            } else if (statusAlarmRain == false) {
                                                                if (pendingAlarm == false && statusAlarmFrost == false) {
                                                                    if (currentValue === mustValue || currentValue === mustValueTilted || shutterSettings[s].triggerID == '') {
                                                                        // @ts-ignore
                                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null && parseFloat(state.val) != parseFloat(shutterSettings[s].alarmTriggerLevel)) {
                                                                                adapter.log.info('Alarm rain ended - Set ID: ' + shutterSettings[s].shutterName + ' value: ' + parseFloat(shutterSettings[s].alarmTriggerLevel) + '%');
                                                                                adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].alarmTriggerLevel), false);
                                                                                shutterSettings[s].currentHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                                                                shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                                shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                                                                shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                adapter.log.debug('shutter alarm rain endet and no other alarm is pending ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                return (shutterSettings);
                                                                            }
                                                                            else if (typeof state != undefined && state != null && parseFloat(state.val) == parseFloat(shutterSettings[s].alarmTriggerLevel)) {
                                                                                shutterSettings[s].currentHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                                                                shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                                shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                                                                shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                adapter.log.debug('shutter alarm rain endet and no other alarm is pending ' + shutterSettings[s].shutterName + ' already at: ' + shutterSettings[s].currentHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                return (shutterSettings);
                                                                            }
                                                                        });
                                                                    } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                                                        /**
                                                                        * @param {any} err
                                                                        * @param {{ val: any; }} state
                                                                        */
                                                                        // @ts-ignore
                                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                adapter.log.info('#Shutter alarm rain endet - Will move ID: ' + shutterSettings[s].shutterName + ' value: ' + parseFloat(shutterSettings[s].alarmTriggerLevel) + '%' + ' after the window has been closed ');
                                                                                shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                                                                adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                                                shutterSettings[s].triggerAction = shutterSettings[s].alarmTriggerAction;
                                                                                adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                                shutterSettings[s].currentHeight = shutterSettings[s].triggerDrive;
                                                                                adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].currentHeight), false);
                                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                                shutterSettings[s].currentAction = 'triggered';
                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                return (shutterSettings);
                                                                            }
                                                                        });
                                                                    }
                                                                } else {
                                                                    adapter.log.info('Alarm Rain endet for ID: ' + shutterSettings[s].shutterName + ' driving to next highest alarm priority');
                                                                    if (statusAlarmFire == false) {
                                                                        if (statusAlarmFrost == true) {
                                                                            if (shutterSettings[s].alarmTriggerAction == 'down') {
                                                                                shutterSettings[s].currentAction = 'frost';
                                                                                shutterSettings[s].currentHeight = alarmFrostLevel;
                                                                            } else {
                                                                                shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                                                                shutterSettings[s].currentHeight = shutterSettings[s].alarmTriggerLevel;
                                                                            }
                                                                        }
                                                                        if (statusAlarmWind1 == true) {
                                                                            shutterSettings[s].currentHeight = alarmWind1Level;
                                                                            shutterSettings[s].currentAction = 'wind1';
                                                                        }
                                                                        if (statusAlarmWind2 == true) {
                                                                            shutterSettings[s].currentHeight = alarmWind2Level;
                                                                            shutterSettings[s].currentAction = 'wind2';
                                                                        }

                                                                        adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].currentHeight + '%');
                                                                        adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].currentHeight), false);
                                                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        adapter.log.debug('shutter alarm ' + shutterSettings[s].currentAction + ' ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                        return (shutterSettings);
                                                                    }
                                                                }
                                                            }
                                                            // @ts-ignore
                                                        }, driveDelayUpAstro * i, i);
                                                        break;

                                                    // +++++++++++++++++ Alarm Frost  +++++++++++++++
                                                    case 'alarmFrost':
                                                        setTimeout(function () {
                                                            if (statusAlarmFrost == true) {
                                                                // @ts-ignore
                                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null && parseFloat(state.val) != parseFloat(alarmFrostLevel) && statusAlarmFire == false) {
                                                                        if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                                                            if (statusAlarmWind1 == false && statusAlarmWind2 == false && statusAlarmRain == false && statusAlarmFire == false) {
                                                                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                                                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                                                            }
                                                                            if ((shutterSettings[s].triggerHeight < parseFloat(alarmFrostLevel) && convertShutter == false) || (shutterSettings[s].triggerHeight > parseFloat(alarmFrostLevel) && convertShutter == true)) {
                                                                                shutterSettings[s].triggerHeight = parseFloat(alarmFrostLevel);
                                                                                shutterSettings[s].triggerAction = 'frost';
                                                                            }
                                                                        } else if (currentValue === mustValue || currentValue === mustValueTilted) {
                                                                            if (statusAlarmWind1 == false && statusAlarmWind2 == false && statusAlarmRain == false && statusAlarmFire == false) {
                                                                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                                                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                                                            }
                                                                            if ((parseFloat(state.val) < parseFloat(alarmFrostLevel) && convertShutter == false) || (parseFloat(state.val) > parseFloat(alarmFrostLevel) && convertShutter == true)) {
                                                                                adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + parseFloat(alarmFrostLevel) + '%');
                                                                                adapter.setForeignState(shutterSettings[s].name, parseFloat(alarmFrostLevel), false);
                                                                                shutterSettings[s].currentHeight = parseFloat(alarmFrostLevel);
                                                                                shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                                shutterSettings[s].currentAction = 'frost';
                                                                                shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                adapter.log.debug('shutter alarm frost ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                return (shutterSettings);
                                                                            }
                                                                        }

                                                                    }
                                                                    else if (typeof state != undefined && state != null && parseFloat(state.val) == parseFloat(alarmFrostLevel) && statusAlarmFire == false) {
                                                                        if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                                                            if (statusAlarmWind1 == false && statusAlarmWind2 == false && statusAlarmRain == false && statusAlarmFire == false) {
                                                                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].triggerHeight;
                                                                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].triggerAction;
                                                                            }
                                                                        } else if (currentValue === mustValue || currentValue === mustValueTilted) {
                                                                            if (statusAlarmWind1 == false && statusAlarmWind2 == false && statusAlarmRain == false && statusAlarmFire == false) {
                                                                                shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                                                                shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                                                            }
                                                                        }
                                                                        shutterSettings[s].currentHeight = parseFloat(alarmFrostLevel);
                                                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                        shutterSettings[s].currentAction = 'frost';
                                                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        adapter.log.debug('shutter alarm frost' + shutterSettings[s].shutterName + ' already at: ' + shutterSettings[s].currentHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                        return (shutterSettings);
                                                                    }
                                                                });
                                                            } else if (statusAlarmFrost == false) {
                                                                if (pendingAlarm == false) {
                                                                    if (currentValue === mustValue || currentValue === mustValueTilted || shutterSettings[s].triggerID == '') {
                                                                        // @ts-ignore
                                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null && parseFloat(state.val) != parseFloat(shutterSettings[s].alarmTriggerLevel)) {
                                                                                adapter.log.info('Alarm frost ended - Set ID: ' + shutterSettings[s].shutterName + ' value: ' + parseFloat(shutterSettings[s].alarmTriggerLevel) + '%');
                                                                                adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].alarmTriggerLevel), false);
                                                                                shutterSettings[s].currentHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                                                                shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                                shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                                                                shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                adapter.log.debug('shutter alarm frost endet and no other alarm is pending ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                return (shutterSettings);
                                                                            }
                                                                            else if (typeof state != undefined && state != null && parseFloat(state.val) == parseFloat(shutterSettings[s].alarmTriggerLevel)) {
                                                                                shutterSettings[s].currentHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                                                                shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                                shutterSettings[s].currentAction = shutterSettings[s].alarmTriggerAction;
                                                                                shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                adapter.log.debug('shutter alarm frost endet and no other alarm is pending ' + shutterSettings[s].shutterName + ' already at: ' + shutterSettings[s].currentHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                return (shutterSettings);
                                                                            }
                                                                        });
                                                                    } else if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                                                        /**
                                                                        * @param {any} err
                                                                        * @param {{ val: any; }} state
                                                                        */
                                                                        // @ts-ignore
                                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                adapter.log.info('#Shutter alarm frost endet - Will move ID: ' + shutterSettings[s].shutterName + ' value: ' + parseFloat(shutterSettings[s].alarmTriggerLevel) + '%' + ' after the window has been closed ');
                                                                                shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].alarmTriggerLevel);
                                                                                adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                                                shutterSettings[s].triggerAction = shutterSettings[s].alarmTriggerAction;
                                                                                adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                                shutterSettings[s].currentHeight = shutterSettings[s].triggerDrive;
                                                                                adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].currentHeight), false);
                                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                                shutterSettings[s].currentAction = 'triggered';
                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                return (shutterSettings);
                                                                            }
                                                                        });
                                                                    }
                                                                } else {
                                                                    adapter.log.info('Alarm frost endet for ID: ' + shutterSettings[s].shutterName + ' driving to next highest alarm priority');
                                                                    if (statusAlarmFire == false) {
                                                                        if (statusAlarmWind1 == true) {
                                                                            shutterSettings[s].currentHeight = alarmWind1Level;
                                                                            shutterSettings[s].currentAction = 'wind1';
                                                                        }
                                                                        if (statusAlarmWind2 == true) {
                                                                            shutterSettings[s].currentHeight = alarmWind2Level;
                                                                            shutterSettings[s].currentAction = 'wind2';
                                                                        }
                                                                        if (statusAlarmRain == true) {
                                                                            shutterSettings[s].currentHeight = alarmRainLevel;
                                                                            shutterSettings[s].currentAction = 'rain';
                                                                        }

                                                                        adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].currentHeight + '%');
                                                                        adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].currentHeight), false);
                                                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        adapter.log.debug('shutter alarm ' + shutterSettings[s].currentAction + ' ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                        return (shutterSettings);
                                                                    }
                                                                }
                                                            }

                                                            // @ts-ignore
                                                        }, driveDelayUpAstro * i, i);
                                                        break;

                                                    // +++++++++++++++++ Alarm Fire  +++++++++++++++
                                                    case 'alarmFire':
                                                        setTimeout(function () {
                                                            if (statusAlarmFire == true) {
                                                                // @ts-ignore
                                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null && parseFloat(state.val) != parseFloat(alarmFireLevel)) {
                                                                        adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + parseFloat(alarmFireLevel) + '%');
                                                                        if (statusAlarmWind1 == false && statusAlarmWind2 == false && statusAlarmRain == false && statusAlarmFrost == false) {
                                                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                                                        }
                                                                        adapter.setForeignState(shutterSettings[s].name, parseFloat(alarmFireLevel), false);
                                                                        shutterSettings[s].currentHeight = parseFloat(alarmFireLevel);
                                                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                        shutterSettings[s].currentAction = 'fire';
                                                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        adapter.log.debug('shutter alarm fire ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].currentHeight + '%');
                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                        return (shutterSettings);
                                                                    }
                                                                    else if (typeof state != undefined && state != null && parseFloat(state.val) == parseFloat(alarmFireLevel)) {
                                                                        if (statusAlarmWind1 == false && statusAlarmWind2 == false && statusAlarmRain == false && statusAlarmFrost == false) {
                                                                            shutterSettings[s].alarmTriggerLevel = shutterSettings[s].currentHeight;
                                                                            shutterSettings[s].alarmTriggerAction = shutterSettings[s].currentAction;
                                                                        }
                                                                        shutterSettings[s].currentHeight = parseFloat(alarmFireLevel);
                                                                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                                                        shutterSettings[s].currentAction = 'fire';
                                                                        shutterSettings[s].triggerAction = shutterSettings[s].currentAction;
                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                        adapter.log.debug('shutter alarm fire ' + shutterSettings[s].shutterName + ' already at: ' + shutterSettings[s].currentHeight + '% - setting current action: ' + shutterSettings[s].currentAction);
                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                        return (shutterSettings);
                                                                    }
                                                                });
                                                            } else if (statusAlarmFire == false) {
                                                                adapter.log.info('Alarm fire endet for ID: ' + shutterSettings[s].shutterName + ' fire alarm is not driving back! - please init shutters with button "open all"');
                                                            }
                                                            // @ts-ignore
                                                        }, driveDelayUpAstro * i, i);
                                                        break;
                                                }

                                            });

                                        });
                                    });
                                });
                            });
                        });
                    });
                }
            }
        }
    }
}

// checks if an alarm is currently pending with exeption of frost alarm
// @ts-ignore
function checkPendingAlarm(adapter, Shutter, callback) {
    if (Shutter.enableAlarmWind1 == true || Shutter.enableAlarmWind2 == true || Shutter.enableAlarmRain == true || Shutter.enableAlarmFire == true || Shutter.enableAlarmFrost == true) {
        adapter.log.debug('start pendingAlarm to check if an alarm is currently pending (exept frost)');
    }

    let statusAlarmWind1 = false;
    let statusAlarmWind2 = false;
    let statusAlarmRain = false;
    let statusAlarmFire = false;
    let resAlarmPending = false;



    /**
    * @param {any} err
    * @param {{ val: string; }} state
    */
    // @ts-ignore
    adapter.getForeignState(adapter.config.alarmWind1, (err, state) => {
        if (typeof state != undefined && state != null) {
            statusAlarmWind1 = state.val;
        }

        /**
        * @param {any} err
        * @param {{ val: string; }} state
        */
        // @ts-ignore
        adapter.getForeignState(adapter.config.alarmWind2, (err, state) => {
            if (typeof state != undefined && state != null) {
                statusAlarmWind2 = state.val;
            }

            /**
            * @param {any} err
            * @param {{ val: string; }} state
            */
            // @ts-ignore
            adapter.getForeignState(adapter.config.alarmWind2, (err, state) => {
                if (typeof state != undefined && state != null) {
                    statusAlarmWind2 = state.val;
                }

                /**
                * @param {any} err
                * @param {{ val: string; }} state
                */
                // @ts-ignore
                adapter.getForeignState(adapter.config.alarmRain, (err, state) => {
                    if (typeof state != undefined && state != null) {
                        statusAlarmRain = state.val;
                    }

                    /**
                    * @param {any} err
                    * @param {{ val: string; }} state
                    */
                    // @ts-ignore
                    adapter.getForeignState(adapter.config.alarmFire, (err, state) => {
                        if (typeof state != undefined && state != null) {
                            statusAlarmFire = state.val;
                        }

                        // check if alarm ist pending for the given shutter and return true if yes
                        if ((statusAlarmWind1 == true && Shutter.enableAlarmWind1 == true) || (statusAlarmWind2 == true && Shutter.enableAlarmWind2 == true) || (statusAlarmRain == true && Shutter.enableAlarmRain == true) || (statusAlarmFire == true && Shutter.enableAlarmFire == true) || (Shutter.currentAction == 'fire')) {
                            resAlarmPending = true;
                        }
                        if (Shutter.enableAlarmWind1 == true || Shutter.enableAlarmWind2 == true || Shutter.enableAlarmRain == true || Shutter.enableAlarmFire == true || Shutter.enableAlarmFrost == true) {
                            adapter.log.debug('status alarm pending for ' + Shutter.name + ': ' + resAlarmPending);
                        }
                        callback(resAlarmPending);
                    });
                });
            });
        });
    });
}

// checks if frost alarm is currently true
// @ts-ignore
function checkFrostAlarm(adapter, Shutter, callback) {
    if (Shutter.enableAlarmWind1 == true || Shutter.enableAlarmWind2 == true || Shutter.enableAlarmRain == true || Shutter.enableAlarmFire == true || Shutter.enableAlarmFrost == true) {
        adapter.log.debug('start checking frost alarm ');
    }

    let resAlarmFrost = false;
    /**
    * @param {any} err
    * @param {{ val: string; }} state
    */
    // @ts-ignore
    adapter.getForeignState(adapter.config.alarmFrost, (err, state) => {
        if (typeof state != undefined && state != null) {
            /** @type {boolean} */
            resAlarmFrost = state.val;
        }
        if (Shutter.enableAlarmWind1 == true || Shutter.enableAlarmWind2 == true || Shutter.enableAlarmRain == true || Shutter.enableAlarmFire == true || Shutter.enableAlarmFrost == true) {
            adapter.log.debug('status frost alarm for ' + Shutter.name + ': ' + resAlarmFrost);
        }
        callback(resAlarmFrost);
    });

}
module.exports = { shutterAlarm, checkPendingAlarm, checkFrostAlarm };