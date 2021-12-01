/* jshint -W097 */
/* jshint strict: false */
/*jslint node: true */
'use strict';

// @ts-ignore
const utils = require('@iobroker/adapter-core');
// @ts-ignore
const schedule = require('node-schedule');
// @ts-ignore
const SunCalc = require('suncalc2');

const sunProtect = require('./lib/sunProtect.js');                                                      // SunProtect
const triggerChange = require('./lib/triggerChange.js');                                                // triggerChange
const elevationDown = require('./lib/elevationDown.js');                                                // elevationDown
const shutterGoldenHour = require('./lib/shutterGoldenHour.js');                                        // shutterGoldenHour
const shutterUpLiving = require('./lib/shutterUpLiving.js');                                            // shutterUpLiving
const shutterSunriseSunset = require('./lib/shutterSunriseSunset.js');                                  // shutterSunriseSunset
const shutterDownLiving = require('./lib/shutterDownLiving.js');                                        // shutterDownLiving
const shutterUpSleep = require('./lib/shutterUpSleep.js');                                              // shutterUpSleep
const shutterDownLate = require('./lib/shutterDownLate.js');                                            // shutterDownLate
const shutterDownChildren = require('./lib/shutterDownChildren.js');                                    // shutterDownChildren
const shutterUpChildren = require('./lib/shutterUpChildren.js');                                        // shutterUpChildren
const shutterDownSleep = require('./lib/shutterDownSleep.js');                                          // shutterDownSleep
const buttonAction = require('./lib/buttonAction.js');                                                  // buttonAction
const shutterState = require('./lib/shutterState.js');        			                                // shutterState
const shutterDownComplete = require('./lib/shutterDownComplete.js');                                    // shutterDownComplete
const shutterBrightnessSensor = require('./lib/shutterBrightnessSensor.js').shutterBrightnessSensor;    // shutterBrightnessSensor
const brightnessState = require('./lib/shutterBrightnessSensor.js').brightnessState;                    // brightnessState
const shutterAlarm = require('./lib/shutterAlarm.js').shutterAlarm;                                     // ShutterAlarm

let adapter;
const adapterName = require('./package.json').name.split('.').pop();

let autoLivingStr, autoSleepStr, autoChildrenStr, delayUp, delayUpChildren, delayDown, delayDownChildren, resTriggerChange, shutterSettings;
let astroTimeLivingUp, astroTimeLivingDown, astroTimeSleepUp, astroTimeSleepDown, astroTimeChildrenUp, astroTimeChildrenDown;
let timer, timerMain, timerState1, timerState2, timerDelete, timerDelete1, timerDelete2, timerDelete3, timerDelete4, timerwaitTime_StateCheck, timerBrightnessDown;

let resTrigger = [];
let resSunInsideTemp = [];
let resSunOutsideTemp = [];
let resSunLight = [];

let ObjautoUp = [];
let ObjautoDown = [];
let ObjautoSun = [];
let ObjautoState = [];
let ObjautoLevel = [];
let resShutterState = [];

let waitTime4StateCheck = 0;
let brightnessDown = false;

// +++++++++++++++++++++++++++ Starts the adapter instance ++++++++++++++++++++++++++++++++

function startAdapter(options) {

    options = options || {};
    Object.assign(options, { name: adapterName });

    adapter = new utils.Adapter(options);

    // start here!
    adapter.on('ready', () => main(adapter));

    // +++++++++++++++++++++++++ is called when adapter shuts down +++++++++++++++++++++++++

    adapter.on('unload', (callback) => {

        try {
            adapter.log.info('cleaned everything up...');
            clearTimeout(timer);
            clearTimeout(timerMain);
            clearTimeout(timerState1);
            clearTimeout(timerState2);
            clearTimeout(timerDelete);
            clearTimeout(timerDelete1);
            clearTimeout(timerDelete2);
            clearTimeout(timerDelete3);
            clearTimeout(timerDelete4);
            clearTimeout(timerwaitTime_StateCheck);
            clearTimeout(timerBrightnessDown);
            schedule.cancelJob('shutterUpGoldenHourEnd');
            schedule.cancelJob('calcTimer');
            schedule.cancelJob('shutterDownGoldenHour');
            schedule.cancelJob('shutterUpSunrise');
            schedule.cancelJob('shutterDownSunset');
            schedule.cancelJob('shutterUpLiving');
            schedule.cancelJob('shutterDownLiving');
            schedule.cancelJob('shutterUpSleep');
            schedule.cancelJob('shutterDownLate');
            schedule.cancelJob('shutterDownComplete');
            schedule.cancelJob('shutterDownSleep');
            schedule.cancelJob('calcPosTimer');
            schedule.cancelJob('shutterUpChildren');
            schedule.cancelJob('shutterDownChildren');
            callback();
        } catch (e) {
            callback(e);
        }
    });

    // ++++++++++++++++++ is called if a subscribed state changes ++++++++++++++++++

    adapter.on('stateChange', (id, state) => {
        if (state) {
            if (adapter.config.HolidayDP !== '') {
                if (id.includes(adapter.config.HolidayDP)) {
                    adapter.log.debug('HolidayDP changed to ' + JSON.stringify(state.val));
                    adapter.setState('control.Holiday', { val: state.val, ack: true });
                }
            }
            if (adapter.config.schoolfreeDP !== '') {
                if (id.includes(adapter.config.schoolfreeDP)) {
                    adapter.log.debug('schoolfreeDP changed to ' + JSON.stringify(state.val));
                    adapter.setState('control.schoolfree', { val: state.val, ack: true });
                }
            }
            if (id === adapter.namespace + '.control.Holiday') {
                HolidayStr = state.val;
                shutterDriveCalc();
            }
            if (id === adapter.namespace + '.control.schoolfree') {
                SchoolfreeStr = state.val;
                shutterDriveCalc();
            }
            if (id === adapter.namespace + '.control.autoLiving') {
                autoLivingStr = state.val;
                shutterDriveCalc();
            }
            if (id === adapter.namespace + '.control.autoSleep') {
                autoSleepStr = state.val;
                shutterDriveCalc();
            }
            if (id === adapter.namespace + '.control.autoChildren') {
                autoChildrenStr = state.val;
                shutterDriveCalc();
            }
            if (adapter.config.publicHolidays === true) {
                if (id === adapter.config.publicHolInstance + '.heute.boolean') {
                    publicHolidayStr = state.val;
                    shutterDriveCalc();
                }
                if (id === adapter.config.publicHolInstance + '.morgen.boolean') {
                    publicHolidayTomorowStr = state.val;
                    shutterDriveCalc();
                }
            }
            if (adapter.config.schoolfree === true) {
                if (id === adapter.config.schoolfreeInstance + '.info.today') {
                    schoolfreeStr = state.val;
                    shutterDriveCalc();
                }
                if (id === adapter.config.schoolfreeInstance + '.info.tomorrow') {
                    schoolfreeTomorowStr = state.val;
                    shutterDriveCalc();
                }
            }
            if (id === adapter.config.triggerAutoLiving) {
                adapter.setState('control.autoLiving', { val: state.val, ack: true });
                adapter.log.debug('Auto Living is: ' + state.val);
            }
            if (id === adapter.config.triggerAutoSleep) {
                adapter.setState('control.autoSleep', { val: state.val, ack: true });
                adapter.log.debug('Auto Sleep is: ' + state.val);
            }
            if (id === adapter.config.triggerAutoChildren) {
                adapter.setState('control.autoChildren', { val: state.val, ack: true });
                adapter.log.debug('Auto Children is: ' + state.val);
            }
            if (id === adapter.config.lightsensorUpDown) {
                shutterBrightnessSensor(adapter, state.val, shutterSettings, brightnessDown);
                adapter.log.debug('Brightness sensor value: ' + state.val);
                timerBrightnessDown = setTimeout(function () {
                    brightnessDown = brightnessState(adapter, state.val, brightnessDown);
                    adapter.log.debug('Brightness State Down is: ' + brightnessDown);
                }, 10000);
            }
            if (id === adapter.config.alarmWind1) {
                adapter.log.debug('Alarm Wind 1 changed: ' + state.val);
                shutterAlarm(adapter, 'alarmWind1', shutterSettings);
            }
            if (id === adapter.config.alarmWind2) {
                adapter.log.debug('Alarm Wind 2 changed: ' + state.val);
                shutterAlarm(adapter, 'alarmWind2', shutterSettings);
            }
            if (id === adapter.config.alarmRain) {
                adapter.log.debug('Alarm Rain changed: ' + state.val);
                shutterAlarm(adapter, 'alarmRain', shutterSettings);
            }
            if (id === adapter.config.alarmFrost) {
                adapter.log.debug('Alarm Frost changed: ' + state.val);
                shutterAlarm(adapter, 'alarmFrost', shutterSettings);
            }
            if (id === adapter.config.alarmFire) {
                adapter.log.debug('Alarm Fire changed: ' + state.val);
                shutterAlarm(adapter, 'alarmFire', shutterSettings);
            }

            resTrigger.forEach(function (resultTriggerID) {
                if (id === resultTriggerID && state.ts === state.lc) {
                    resTriggerChange = resultTriggerID;
                    adapter.log.debug('TriggerID changed: ' + resultTriggerID + ' Value: ' + state.val);
                    triggerChange(resTriggerChange, adapter, shutterSettings);
                }
            });
            resSunInsideTemp.forEach(function (resSunInsideTempID) {
                if (id === resSunInsideTempID && state.ts === state.lc) {
                    adapter.log.debug('insidetemperature changed: ' + resSunInsideTempID + ' Value: ' + state.val);
                    sunProtect(adapter, elevation, azimuth, shutterSettings);
                }
            });
            resSunOutsideTemp.forEach(function (resSunOutsideTempID) {
                if (id === resSunOutsideTempID && state.ts === state.lc) {
                    adapter.log.debug('outsidetemperature changed: ' + resSunOutsideTempID + ' Value: ' + state.val);
                    sunProtect(adapter, elevation, azimuth, shutterSettings);
                }
            });
            resSunLight.forEach(function (resSunLightID) {
                if (id === resSunLightID && state.ts === state.lc) {
                    adapter.log.debug('Lightsensor changed: ' + resSunLightID + ' Value: ' + state.val);
                    sunProtect(adapter, elevation, azimuth, shutterSettings);
                }
            });
            resShutterState.forEach(function (resShutterID) {
                if (id === resShutterID && state.ts === state.lc) {
                    const result = shutterSettings.filter((/** @type {{ name: any; }} */ d) => d.name == resShutterID);

                    if (adapter.config.currentShutterState == true && adapter.config.currentShutterStateTime) {
                        clearTimeout(timerwaitTime_StateCheck);
                        timerwaitTime_StateCheck = null;
                        waitTime4StateCheck = (adapter.config.currentShutterStateTime * 1000);
                    }

                    for (const i in result) {
                        for (const s in shutterSettings) {
                            if (shutterSettings[s].shutterName == result[i].shutterName) {
                                const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                                adapter.getForeignState(shutterSettings[s].name, (state) => {
                                    if (typeof state != undefined && state != null && shutterSettings[s].oldHeight != state.val) {
                                        adapter.log.debug('Shutter state changed: ' + shutterSettings[s].shutterName + ' old value = ' + shutterSettings[s].oldHeight + ' new value = ' + state.val);
                                    }
                                    if (typeof state != undefined && state != null && state.val != shutterSettings[s].currentHeight && state.val != shutterSettings[s].oldHeight && adapter.config.currentShutterState == true) {
                                        timerwaitTime_StateCheck = setTimeout(() => {
                                            shutterSettings[s].currentAction = 'Manu_Mode';
                                            shutterSettings[s].triggerAction = 'Manu_Mode';

                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });

                                            adapter.log.debug(shutterSettings[s].shutterName + ' drived manually to ' + state.val + '. Old value = ' + shutterSettings[s].oldHeight + '. New value = ' + state.val);
                                            adapter.log.debug(shutterSettings[s].shutterName + ' Updated trigger action to ' + shutterSettings[s].triggerAction + ' to prevent moving after window close ');
                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                        }, waitTime4StateCheck);
                                    } else if (typeof state != undefined && state != null && state.val != shutterSettings[s].currentHeight && state.val != shutterSettings[s].oldHeight && adapter.config.currentShutterState == false) {
                                        shutterSettings[s].currentAction = 'Manu_Mode';
                                        shutterSettings[s].triggerAction = 'Manu_Mode';

                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });

                                        adapter.log.debug(shutterSettings[s].shutterName + ' Updated trigger action to ' + shutterSettings[s].triggerAction + ' to prevent moving after window close ');
                                        adapter.log.debug(shutterSettings[s].shutterName + ' drived manually to ' + state.val + '. Old value = ' + shutterSettings[s].oldHeight + '. New value = ' + state.val);
                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                    } else if (typeof state != undefined && state != null && state.val == shutterSettings[s].currentHeight) {
                                        adapter.log.debug(shutterSettings[s].shutterName + ' Old value = ' + shutterSettings[s].oldHeight + '. New value = ' + state.val + '. automatic is active');
                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                    }
                                    timerState1 = setTimeout(() => {
                                        saveCurrentStates(false);
                                    }, 5000 + waitTime4StateCheck);
                                });
                                //Shutter is closed -> opened manually to heightUp (should be 100% or 0%) before it has been opened automatically -> enable possibility to activate sunprotect height if required --> if sunprotect is required: shutter is set to sunProtect height
                                if (shutterSettings[s].firstCompleteUp == true && state.val == shutterSettings[s].heightUp && shutterSettings[s].currentAction != 'up' && shutterSettings[s].currentAction != 'triggered' && shutterSettings[s].currentAction != 'triggered_Tilted') {
                                    shutterSettings[s].currentHeight = state.val;
                                    shutterSettings[s].currentAction = 'none'; //reset mode. e.g. mode can be set to sunProtect later if window is closed
                                    shutterSettings[s].firstCompleteUp = false;

                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });

                                    adapter.log.debug(shutterSettings[s].shutterName + ' opened manually to ' + shutterSettings[s].heightUp + '. Old value = ' + shutterSettings[s].oldHeight + '. New value = ' + state.val + '. Possibility to activate sunprotect enabled.');
                                }
                                if (shutterSettings[s].firstCompleteUp == true && shutterSettings[s].currentAction != 'triggered' && shutterSettings[s].currentAction != 'triggered_Tilted' && shutterSettings[s].currentAction != 'none' && (state.val == shutterSettings[s].heightUp || state.val == shutterSettings[s].heightDownSun)) {
                                    shutterSettings[s].firstCompleteUp = false; //reset firstCompleteUp if shutter has been moved up
                                }
                                //save old height
                                timerState2 = setTimeout(function () {
                                    shutterSettings[s].oldHeight = state.val;    //set old Height after 60 Sek - after 60 Sek end position should be reached
                                    saveCurrentStates(false);
                                }, 60000 + waitTime4StateCheck);
                            }
                        }
                    }
                }
            });

            if (id === adapter.namespace + '.info.Azimut') {
                sunProtect(adapter, elevation, azimuth, shutterSettings);
            }
            if (id === adapter.namespace + '.info.Elevation') {
                elevationDown(adapter, elevation, azimuth, shutterSettings);
            }
            if (id === adapter.namespace + '.control.closeAll') {
                buttonAction(adapter, 'closeAll', shutterSettings);
            }
            if (id === adapter.namespace + '.control.openAll') {
                buttonAction(adapter, 'openAll', shutterSettings);
            }
            if (id === adapter.namespace + '.control.closeLiving') {
                buttonAction(adapter, 'closeLiving', shutterSettings);
            }
            if (id === adapter.namespace + '.control.openLiving') {
                buttonAction(adapter, 'openLiving', shutterSettings);
            }
            if (id === adapter.namespace + '.control.closeSleep') {
                buttonAction(adapter, 'closeSleep', shutterSettings);
            }
            if (id === adapter.namespace + '.control.openSleep') {
                buttonAction(adapter, 'openSleep', shutterSettings);
            }
            if (id === adapter.namespace + '.control.closeChildren') {
                buttonAction(adapter, 'closeChildren', shutterSettings);
            }
            if (id === adapter.namespace + '.control.openChildren') {
                buttonAction(adapter, 'openChildren', shutterSettings);
            }
            if (id === adapter.namespace + '.control.sunProtect') {
                buttonAction(adapter, 'sunProtect', shutterSettings);
            }
            if (id === adapter.namespace + '.control.sunProtectSleep') {
                buttonAction(adapter, 'sunProtectSleep', shutterSettings);
            }
            if (id === adapter.namespace + '.control.sunProtectChildren') {
                buttonAction(adapter, 'sunProtectChildren', shutterSettings);
            }
            if (id === adapter.namespace + '.control.sunProtectLiving') {
                buttonAction(adapter, 'sunProtectLiving', shutterSettings);
            }
            if (id === adapter.namespace + '.control.autoAll') {
                buttonAction(adapter, 'autoAll', shutterSettings);
            }
        }
    });
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// +++++++++++++++++ save states on start and shutter change ++++++++++++++++++++++++++++

async function saveCurrentStates(onStart) {
    let currentStates = {};
    let shutterName = [];
    let num = 0;

    const _currentStates = await adapter.getStateAsync('shutters.currentStates');
    if (_currentStates && _currentStates.val && _currentStates.val !== null) {
        try {
            currentStates = JSON.parse(_currentStates.val);
        } catch (err) {
            adapter.log.debug('settings cannot be read from the state');
            currentStates = {};
        }
    }

    for (const s in shutterSettings) {
        let timerSaveSettings = setTimeout(async () => {
            const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
            shutterName.push(shutterSettings[s].shutterName);
            num++;

            if (currentStates && currentStates[`${nameDevice}`] && !onStart) {
                currentStates[`${nameDevice}`].currentAction = shutterSettings[s].currentAction;
                currentStates[`${nameDevice}`].currentHeight = shutterSettings[s].currentHeight;
                currentStates[`${nameDevice}`].triggerAction = shutterSettings[s].triggerAction;
                currentStates[`${nameDevice}`].triggerHeight = shutterSettings[s].triggerHeight;
                currentStates[`${nameDevice}`].oldHeight = shutterSettings[s].oldHeight;
                currentStates[`${nameDevice}`].firstCompleteUp = shutterSettings[s].firstCompleteUp;
                currentStates[`${nameDevice}`].alarmTriggerAction = shutterSettings[s].alarmTriggerAction;
                currentStates[`${nameDevice}`].alarmTriggerLevel = shutterSettings[s].alarmTriggerLevel;
                currentStates[`${nameDevice}`].lastAutoAction = shutterSettings[s].lastAutoAction;
            } else if (currentStates && currentStates[`${nameDevice}`] && onStart) {
                adapter.log.debug(nameDevice + ': save settings');
                shutterSettings[s].currentAction = currentStates[`${nameDevice}`].currentAction;
                shutterSettings[s].currentHeight = currentStates[`${nameDevice}`].currentHeight;
                shutterSettings[s].triggerAction = currentStates[`${nameDevice}`].triggerAction;
                shutterSettings[s].triggerHeight = currentStates[`${nameDevice}`].triggerHeight;
                shutterSettings[s].oldHeight = currentStates[`${nameDevice}`].oldHeight;
                shutterSettings[s].firstCompleteUp = currentStates[`${nameDevice}`].firstCompleteUp;
                shutterSettings[s].alarmTriggerAction = currentStates[`${nameDevice}`].alarmTriggerAction;
                shutterSettings[s].alarmTriggerLevel = currentStates[`${nameDevice}`].alarmTriggerLevel;
                shutterSettings[s].lastAutoAction = currentStates[`${nameDevice}`].lastAutoAction;
            } else if (currentStates && !currentStates[`${nameDevice}`] && onStart) {
                adapter.log.debug(nameDevice + ': settings added');
                currentStates[`${nameDevice}`] = null;

                const states = ({
                    "shutterName": shutterSettings[s].shutterName,
                    "currentAction": shutterSettings[s].currentAction,
                    "currentHeight": shutterSettings[s].currentHeight,
                    "triggerAction": shutterSettings[s].triggerAction,
                    "triggerHeight": shutterSettings[s].triggerHeight,
                    "oldHeight": shutterSettings[s].oldHeight,
                    "firstCompleteUp": shutterSettings[s].firstCompleteUp,
                    "alarmTriggerLevel": shutterSettings[s].alarmTriggerLevel,
                    "alarmTriggerAction": shutterSettings[s].alarmTriggerAction,
                    "lastAutoAction": shutterSettings[s].lastAutoAction
                });

                currentStates[`${nameDevice}`] = states;
            }
            if (num == shutterSettings.length && onStart) {
                clearTimeout(timerSaveSettings);

                for (const i in currentStates) {
                    if (shutterName.indexOf(currentStates[i].shutterName) === -1) {
                        const name = currentStates[i].shutterName.replace(/[.;, ]/g, '_')
                        adapter.log.debug(name + ': settings deleted');
                        delete currentStates[`${name}`];
                    }
                    let timerSetSettings = setTimeout(async () => {
                        adapter.setState('shutters.currentStates', { val: JSON.stringify(currentStates), ack: true });
                        clearTimeout(timerSetSettings);
                    }, 2000);
                }
            } else if (num == shutterSettings.length && !onStart) {
                clearTimeout(timerSaveSettings);
                await adapter.setStateAsync('shutters.currentStates', { val: JSON.stringify(currentStates), ack: true });
            }
            // @ts-ignore
        }, 100 * s, s);
    }
}

// +++++++++++++++++ Check States of Trigger after start ++++++++++++++++++++++++++++

async function checkStates() {
    const _holidayStates = await adapter.getStateAsync('control.Holiday');
    if ((_holidayStates && _holidayStates === null) || (_holidayStates && _holidayStates.val === null)) {
        await adapter.setStateAsync('control.Holiday', { val: false, ack: true });
    }

    const _schoolfreeStates = await adapter.getStateAsync('control.schoolfree');
    if ((_schoolfreeStates && _schoolfreeStates === null) || (_schoolfreeStates && _schoolfreeStates.val === null)) {
        await adapter.setStateAsync('control.schoolfree', { val: false, ack: true });
    }

    const _autoLivingStates = await adapter.getStateAsync('control.autoLiving');
    if ((_autoLivingStates && _autoLivingStates === null) || (_autoLivingStates && _autoLivingStates.val === null)) {
        await adapter.setStateAsync('control.autoLiving', { val: false, ack: true });
    }

    const _autoSleepStates = await adapter.getStateAsync('control.autoSleep');
    if ((_autoSleepStates && _autoSleepStates === null) || (_autoSleepStates && _autoSleepStates.val === null)) {
        await adapter.setStateAsync('control.autoSleep', { val: false, ack: true });
    }

    const _autoChildrenStates = await adapter.getStateAsync('control.autoChildren');
    if ((_autoChildrenStates && _autoChildrenStates === null) || (_autoChildrenStates && _autoChildrenStates.val === null)) {
        await adapter.setStateAsync('control.autoChildren', { val: false, ack: true });
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// +++++++++++++++++++ check all current States an changes +++++++++++++++++++++++++

async function checkActualStates() {
    const _holidayStates = await adapter.getStateAsync('control.Holiday');
    if (_holidayStates) {
        HolidayStr = _holidayStates.val;
    }

    const _schoolfreeStates = await adapter.getStateAsync('control.schoolfree');
    if (_schoolfreeStates) {
        SchoolfreeStr = _schoolfreeStates.val;
    }

    const _autoLivingStates = await adapter.getStateAsync('control.autoLiving');
    if (_autoLivingStates) {
        autoLivingStr = _autoLivingStates.val;
    }

    const _autoSleepStates = await adapter.getStateAsync('control.autoSleep');
    if (_autoSleepStates) {
        autoSleepStr = _autoSleepStates.val;
    }

    const _autoChildrenStates = await adapter.getStateAsync('control.autoChildren');
    if (_autoChildrenStates) {
        autoChildrenStr = _autoChildrenStates.val;
    }

    if (adapter.config.publicHolidays === true && (adapter.config.publicHolInstance != 'none' || adapter.config.publicHolInstance != '')) {
        const _publicHolidayStr = await adapter.getForeignStateAsync(adapter.config.publicHolInstance + '.heute.boolean');
        if (typeof _publicHolidayStr != undefined && _publicHolidayStr != null) {
            publicHolidayStr = _publicHolidayStr.val;
        }

        const _publicHolidayTomorowStr = await adapter.getForeignStateAsync(adapter.config.publicHolInstance + '.morgen.boolean');
        if (typeof _publicHolidayTomorowStr != undefined && _publicHolidayTomorowStr != null) {
            publicHolidayTomorowStr = _publicHolidayTomorowStr.val;
        }
    }

    if (adapter.config.schoolfree === true && (adapter.config.schoolfreeInstance != 'none' || adapter.config.schoolfreeInstance != '')) {
        const _schoolfreeStr = await adapter.getForeignStateAsync(adapter.config.schoolfreeInstance + '.info.today');
        if (typeof _schoolfreeStr != undefined && _schoolfreeStr != null) {
            schoolfreeStr = _schoolfreeStr.val;
        }
        const _schoolfreeTomorowStr = await adapter.getForeignStateAsync(adapter.config.schoolfreeInstance + '.info.tomorrow');
        if (typeof _schoolfreeTomorowStr != undefined && _schoolfreeTomorowStr != null) {
            schoolfreeTomorowStr = _schoolfreeTomorowStr.val;
        }
    }

    if (adapter.config.HolidayDP !== '') {
        adapter.log.debug('checking HolidayDP');
        const _HolidayDP = await adapter.getForeignStateAsync(adapter.config.HolidayDP);
        if (typeof _HolidayDP != undefined && _HolidayDP != null) {
            adapter.log.debug('got HolidayDP ' + _HolidayDP.val);
            await adapter.setStateAsync('control.Holiday', { val: _HolidayDP.val, ack: true });
        }
    }

    if (adapter.config.schoolfreeDP !== '') {
        adapter.log.debug('checking schoolfreeDP');
        const _schoolfreeDP = await adapter.getForeignStateAsync(adapter.config.schoolfreeDP);
        if (typeof _schoolfreeDP != undefined && _schoolfreeDP != null) {
            adapter.log.debug('got schoolfreeDP ' + _schoolfreeDP.val);
            await adapter.setStateAsync('control.schoolfree', { val: _schoolfreeDP.val, ack: true });
        }
    }
    const _ObjautoUp = await adapter.getForeignObjects(adapter.namespace + '.shutters.autoUp.*', 'state');
    if (_ObjautoUp) {
        ObjautoUp = _ObjautoUp;
    }

    const _ObjautoDown = await adapter.getForeignObjects(adapter.namespace + '.shutters.autoDown.*', 'state');
    if (_ObjautoDown) {
        ObjautoDown = _ObjautoDown;
    }

    const _ObjautoSun = await adapter.getForeignObjects(adapter.namespace + '.shutters.autoSun.*', 'state');
    if (_ObjautoSun) {
        ObjautoSun = _ObjautoSun;
    }

    const _ObjautoState = await adapter.getForeignObjects(adapter.namespace + '.shutters.autoState.*', 'state');
    if (_ObjautoState) {
        ObjautoState = _ObjautoState;
    }

    const _ObjautoLevel = await adapter.getForeignObjects(adapter.namespace + '.shutters.autoLevel.*', 'state');
    if (_ObjautoLevel) {
        ObjautoLevel = _ObjautoLevel;
    }

    timerMain = setTimeout(async function () {
        shutterDriveCalc();
        createShutter();
    }, 1000);
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ++++++++++++++++++ reset current Action in the night at 02:30 +++++++++++++++++++++++

const calc = schedule.scheduleJob('calcTimer', '30 2 * * *', async function () {
    shutterDriveCalc();

    const resultStates = shutterSettings;
    if (resultStates) {
        for (const i in resultStates) {
            const nameDevice = resultStates[i].shutterName.replace(/[.;, ]/g, '_');
            const _shutterState = await adapter.getForeignStateAsync(resultStates[i].name);

            if (typeof _shutterState != undefined && _shutterState != null) {
                // Case: Shutter in sunProtect mode. Auto-down in the evening before end of sunProtect. The sun is sill shining. Prevent that the shutter opens again with end of sunProtect. 
                // currentAction=sunprotect would be set in sunProtect(). But not if currentAction=down. So this is checked in sunProtect(). Reset here to enable possibility to set sunProtect in the morning ->
                resultStates[i].currentAction = 'none';
                resultStates[i].firstCompleteUp = true;

                await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: resultStates[i].currentAction, ack: true });
                adapter.log.debug(resultStates[i].shutterName + " set currentHeight to " + _shutterState.val);

                if (typeof _shutterState.val != undefined && _shutterState.val != null) {
                    resultStates[i].currentHeight = _shutterState.val;
                    await adapter.setStateAsync('shutters.autoLevel.' + nameDevice, { val: parseFloat(resultStates[i].currentHeight), ack: true });

                    if (parseFloat(resultStates[i].heightDown) < parseFloat(resultStates[i].heightUp)) {
                        adapter.log.debug(resultStates[i].shutterName + ' level conversion is disabled ...');
                    } else if (parseFloat(resultStates[i].heightDown) > parseFloat(resultStates[i].heightUp)) {
                        adapter.log.debug(resultStates[i].shutterName + ' level conversion is enabled');
                    }
                }
            }
        }
    }
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// +++++++++++++++++ Get longitude an latidude from system config ++++++++++++++++++++

async function GetSystemData() {
    if (typeof adapter.config.longitude == undefined || adapter.config.longitude == null || adapter.config.longitude.length == 0 || isNaN(adapter.config.longitude)
        || typeof adapter.config.latitude == undefined || adapter.config.latitude == null || adapter.config.latitude.length == 0 || isNaN(adapter.config.latitude)) {

        try {
            const obj = await adapter.getForeignObjectAsync('system.config', 'state');

            if (obj && obj.common && obj.common.longitude && obj.common.latitude) {
                adapter.config.longitude = obj.common.longitude;
                adapter.config.latitude = obj.common.latitude;

                adapter.log.debug(`longitude: ${adapter.config.longitude} | latitude: ${adapter.config.latitude}`);
            } else {
                adapter.log.error('system settings cannot be called up. Please check configuration!');
            }
        } catch (err) {
            adapter.log.warn('system settings cannot be called up. Please check configuration!');
        }
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// +++++++++++++++ calc the shutter time for all function ++++++++++++++++++

let sunsetStr, sunriseStr, goldenHour, goldenHourEnd, upTimeSleep, upTimeChildren, upTimeLiving, downTimeSleep, downTimeChildren;
let downTimeLiving, dayStr, HolidayStr, SchoolfreeStr, publicHolidayStr, publicHolidayTomorowStr, schoolfreeTomorowStr, schoolfreeStr;

function shutterDriveCalc() {
    adapter.log.debug('shutterDriveCalc');

    let times; // get today's sunlight times 

    try {
        times = SunCalc.getTimes(new Date(), adapter.config.latitude, adapter.config.longitude);
        adapter.log.debug('calculate astrodata ...');

        // format sunset/sunrise time from the Date object
        sunsetStr = ('0' + times.sunset.getHours()).slice(-2) + ':' + ('0' + times.sunset.getMinutes()).slice(-2);
        sunriseStr = ('0' + times.sunrise.getHours()).slice(-2) + ':' + ('0' + times.sunrise.getMinutes()).slice(-2);
        dayStr = times.sunrise.getDay();

        // format goldenhour/goldenhourend time from the Date object
        goldenHour = ('0' + times.goldenHour.getHours()).slice(-2) + ':' + ('0' + times.goldenHour.getMinutes()).slice(-2);
        goldenHourEnd = ('0' + times.goldenHourEnd.getHours()).slice(-2) + ':' + ('0' + times.goldenHourEnd.getMinutes()).slice(-2);
    } catch (e) {
        adapter.log.warn('cannot calculate astrodata ... please check your config for latitude und longitude!!');
    }

    adapter.log.debug('goldenHourEnd today: ' + goldenHourEnd);
    adapter.setState('info.GoldenHourEnd', { val: goldenHourEnd, ack: true });
    adapter.log.debug('goldenHour today: ' + goldenHour);
    adapter.setState('info.GoldenHour', { val: goldenHour, ack: true });

    adapter.log.debug('current day: ' + dayStr);
    adapter.log.debug('Sunrise today: ' + sunriseStr);
    adapter.setState('info.Sunrise', { val: sunriseStr, ack: true });
    adapter.log.debug('Sunset today: ' + sunsetStr);
    adapter.setState('info.Sunset', { val: sunsetStr, ack: true });

    sunriseStr = addMinutes(sunriseStr, adapter.config.astroDelayUp);       // Add Delay for Sunrise
    sunsetStr = addMinutes(sunsetStr, adapter.config.astroDelayDown);       // Add Delay for Sunset
    goldenHour = addMinutes(goldenHour, adapter.config.astroDelayDown);     // Add Delay for GoldenHour
    goldenHourEnd = addMinutes(goldenHourEnd, adapter.config.astroDelayUp); // Add Delay for GoldenHourEnd

    adapter.log.debug('Starting up shutters GoldenHour area: ' + goldenHourEnd);
    adapter.log.debug('Shutdown shutters GoldenHour area: ' + goldenHour);
    adapter.log.debug('Starting up shutters Sunrise area: ' + sunriseStr);
    adapter.log.debug('Shutdown shutters Sunset area: ' + sunsetStr);

    shutterGoldenHour(adapter, goldenHourEnd, goldenHour, shutterSettings);
    shutterSunriseSunset(adapter, sunriseStr, sunsetStr, shutterSettings);

    switch (adapter.config.livingAutomatic) {
        case 'livingSunriseSunset':
            astroTimeLivingUp = sunriseStr;
            astroTimeLivingDown = sunsetStr;
            break;
        case 'livingGoldenHour':
            astroTimeLivingUp = goldenHourEnd;
            astroTimeLivingDown = goldenHour;
            break;
    }
    switch (adapter.config.sleepAutomatic) {
        case 'sleepSunriseSunset':
            astroTimeSleepUp = sunriseStr;
            astroTimeSleepDown = sunsetStr;
            break;
        case 'sleepGoldenHour':
            astroTimeSleepUp = goldenHourEnd;
            astroTimeSleepDown = goldenHour;
            break;
    }
    switch (adapter.config.childrenAutomatic) {
        case 'childrenSunriseSunset':
            astroTimeChildrenUp = sunriseStr;
            astroTimeChildrenDown = sunsetStr;
            break;
        case 'childrenGoldenHour':
            astroTimeChildrenUp = goldenHourEnd;
            astroTimeChildrenDown = goldenHour;
            break;
    }
    let debugCnt = 0;

    // ******** Set Up-Time Living Area ********
    switch (adapter.config.livingAutomatic) {
        case 'livingTime':
            if (dayStr === 6 || dayStr === 0 || (HolidayStr) === true || (SchoolfreeStr) === true || (publicHolidayStr) === true || (schoolfreeStr === true && adapter.config.schoolfreeLivingArea == true)) {
                upTimeLiving = adapter.config.WE_shutterUpLivingMax;
                debugCnt = 1;
            } else {
                upTimeLiving = adapter.config.W_shutterUpLivingMax;
                debugCnt = 2;
            }
            break;
        default:
            if (dayStr === 6 || dayStr === 0 || (HolidayStr) === true || (SchoolfreeStr) === true || (publicHolidayStr) === true || (schoolfreeStr === true && adapter.config.schoolfreeLivingArea == true)) {

                if (IsLater(astroTimeLivingUp, adapter.config.WE_shutterUpLivingMax)) {
                    upTimeLiving = adapter.config.WE_shutterUpLivingMax;
                    debugCnt = 10;
                } else if (IsLater(astroTimeLivingUp, adapter.config.WE_shutterUpLivingMin) && IsEarlier(astroTimeLivingUp, adapter.config.WE_shutterUpLivingMax)) {
                    upTimeLiving = astroTimeLivingUp;
                    debugCnt = 11;
                } else if (IsEqual(adapter.config.WE_shutterUpLivingMin, adapter.config.WE_shutterUpLivingMax)) {
                    upTimeLiving = adapter.config.WE_shutterUpLivingMax;
                    debugCnt = 12;
                } else if (IsEqual(astroTimeLivingUp, adapter.config.WE_shutterUpLivingMax)) {
                    upTimeLiving = astroTimeLivingUp;
                    debugCnt = 13;
                } else if (IsEarlier(astroTimeLivingUp, adapter.config.WE_shutterUpLivingMin)) {
                    upTimeLiving = adapter.config.WE_shutterUpLivingMin;
                    debugCnt = 14;
                }
            } else {
                if (dayStr < 6 && dayStr > 0) {
                    if (IsLater(astroTimeLivingUp, adapter.config.W_shutterUpLivingMax)) {
                        upTimeLiving = adapter.config.W_shutterUpLivingMax;
                        debugCnt = 4;
                    } else if (IsLater(astroTimeLivingUp, adapter.config.W_shutterUpLivingMin) && IsEarlier(astroTimeLivingUp, adapter.config.W_shutterUpLivingMax)) {
                        upTimeLiving = astroTimeLivingUp;
                        debugCnt = 5;
                    } else if (IsEqual(adapter.config.W_shutterUpLivingMin, adapter.config.W_shutterUpLivingMax)) {
                        upTimeLiving = adapter.config.W_shutterUpLivingMax;
                        debugCnt = 6;
                    } else if (IsEqual(astroTimeLivingUp, adapter.config.W_shutterUpLivingMax)) {
                        upTimeLiving = astroTimeLivingUp;
                        debugCnt = 7;
                    } else if (IsEarlier(astroTimeLivingUp, adapter.config.W_shutterUpLivingMin)) {
                        upTimeLiving = adapter.config.W_shutterUpLivingMin;
                        debugCnt = 8;
                    }
                }
            }
            break;
    }
    adapter.setState('info.upTimeLiving', { val: upTimeLiving, ack: true });
    adapter.log.debug('Starting up shutters living area: ' + upTimeLiving + " debug " + debugCnt);
    shutterUpLiving(adapter, upTimeLiving, autoLivingStr, shutterSettings);

    // ******** Set Up-Time Sleep Area ********
    switch (adapter.config.sleepAutomatic) {
        case 'sleepTime':
            if (dayStr === 6 || dayStr === 0 || (HolidayStr) === true || (SchoolfreeStr) === true || (publicHolidayStr) === true || (schoolfreeStr === true && adapter.config.schoolfreeSleepArea == true)) {
                upTimeSleep = adapter.config.WE_shutterUpSleepMax;
                debugCnt = 1;
            } else {
                upTimeSleep = adapter.config.W_shutterUpSleepMax;
                debugCnt = 2;
            }
            break;
        default:
            if (dayStr === 6 || dayStr === 0 || (HolidayStr) === true || (SchoolfreeStr) === true || (publicHolidayStr) === true || (schoolfreeStr === true && adapter.config.schoolfreeSleepArea == true)) {

                if (IsLater(astroTimeSleepUp, adapter.config.WE_shutterUpSleepMax)) {
                    upTimeSleep = adapter.config.WE_shutterUpSleepMax;
                    debugCnt = 10;
                } else if (IsLater(astroTimeSleepUp, adapter.config.WE_shutterUpSleepMin) && IsEarlier(astroTimeSleepUp, adapter.config.WE_shutterUpSleepMax)) {
                    upTimeSleep = astroTimeSleepUp;
                    debugCnt = 11;
                } else if (IsEqual(adapter.config.WE_shutterUpSleepMin, adapter.config.WE_shutterUpSleepMax)) {
                    upTimeSleep = adapter.config.WE_shutterUpSleepMax;
                    debugCnt = 12;
                } else if (IsEqual(astroTimeSleepUp, adapter.config.WE_shutterUpSleepMax)) {
                    upTimeSleep = astroTimeSleepUp;
                    debugCnt = 13;
                } else if (IsEarlier(astroTimeSleepUp, adapter.config.WE_shutterUpSleepMin)) {
                    upTimeSleep = adapter.config.WE_shutterUpSleepMin;
                    debugCnt = 14;
                }


            } else {
                if (dayStr < 6 && dayStr > 0) {

                    if (IsLater(astroTimeSleepUp, adapter.config.W_shutterUpSleepMax)) {
                        upTimeSleep = adapter.config.W_shutterUpSleepMax;
                        debugCnt = 4;
                    } else if (IsLater(astroTimeSleepUp, adapter.config.W_shutterUpSleepMin) && IsEarlier(astroTimeSleepUp, adapter.config.W_shutterUpSleepMax)) {
                        upTimeSleep = astroTimeSleepUp;
                        debugCnt = 5;
                    } else if (IsEqual(adapter.config.W_shutterUpSleepMin, adapter.config.W_shutterUpSleepMax)) {
                        upTimeSleep = adapter.config.W_shutterUpSleepMax;
                        debugCnt = 6;
                    } else if (IsEqual(astroTimeSleepUp, adapter.config.W_shutterUpSleepMax)) {
                        upTimeSleep = astroTimeSleepUp;
                        debugCnt = 7;
                    } else if (IsEarlier(astroTimeSleepUp, adapter.config.W_shutterUpSleepMin)) {
                        upTimeSleep = adapter.config.W_shutterUpSleepMin;
                        debugCnt = 8;
                    }
                }
            }

            break;
    }
    adapter.setState('info.upTimeSleep', { val: upTimeSleep, ack: true });
    adapter.log.debug('Starting up shutters sleep area: ' + upTimeSleep + " debug " + debugCnt);
    shutterUpSleep(adapter, upTimeSleep, delayUp, autoSleepStr, shutterSettings)

    // ******** Set Up-Time Children Area ********

    switch (adapter.config.childrenAutomatic) {
        case 'childrenTime':
            if (dayStr === 6 || dayStr === 0 || (HolidayStr) === true || (SchoolfreeStr) === true || (publicHolidayStr) === true || (schoolfreeStr === true && adapter.config.schoolfreeChildrenArea == true)) {
                upTimeChildren = adapter.config.WE_shutterUpChildrenMax;
                debugCnt = 1;
            } else {
                upTimeChildren = adapter.config.W_shutterUpChildrenMax;
                debugCnt = 2;
            }
            break;
        default:
            if (dayStr === 6 || dayStr === 0 || (HolidayStr) === true || (SchoolfreeStr) === true || (publicHolidayStr) === true || (schoolfreeStr === true && adapter.config.schoolfreeChildrenArea == true)) {

                if (IsLater(astroTimeChildrenUp, adapter.config.WE_shutterUpChildrenMax)) {
                    upTimeChildren = adapter.config.WE_shutterUpChildrenMax;
                    debugCnt = 10;
                } else if (IsLater(astroTimeChildrenUp, adapter.config.WE_shutterUpChildrenMin) && IsEarlier(astroTimeChildrenUp, adapter.config.WE_shutterUpChildrenMax)) {
                    upTimeChildren = astroTimeChildrenUp;
                    debugCnt = 11;
                } else if (IsEqual(adapter.config.WE_shutterUpChildrenMin, adapter.config.WE_shutterUpChildrenMax)) {
                    upTimeChildren = adapter.config.WE_shutterUpChildrenMax;
                    debugCnt = 12;
                } else if (IsEqual(astroTimeChildrenUp, adapter.config.WE_shutterUpChildrenMax)) {
                    upTimeChildren = astroTimeChildrenUp;
                    debugCnt = 13;
                } else if (IsEarlier(astroTimeChildrenUp, adapter.config.WE_shutterUpChildrenMin)) {
                    upTimeChildren = adapter.config.WE_shutterUpChildrenMin;
                    debugCnt = 14;
                }


            } else {
                if (dayStr < 6 && dayStr > 0) {

                    if (IsLater(astroTimeChildrenUp, adapter.config.W_shutterUpChildrenMax)) {
                        upTimeChildren = adapter.config.W_shutterUpChildrenMax;
                        debugCnt = 4;
                    } else if (IsLater(astroTimeChildrenUp, adapter.config.W_shutterUpChildrenMin) && IsEarlier(astroTimeChildrenUp, adapter.config.W_shutterUpChildrenMax)) {
                        upTimeChildren = astroTimeChildrenUp;
                        debugCnt = 5;
                    } else if (IsEqual(adapter.config.W_shutterUpChildrenMin, adapter.config.W_shutterUpChildrenMax)) {
                        upTimeChildren = adapter.config.W_shutterUpChildrenMax;
                        debugCnt = 6;
                    } else if (IsEqual(astroTimeChildrenUp, adapter.config.W_shutterUpChildrenMax)) {
                        upTimeChildren = astroTimeChildrenUp;
                        debugCnt = 7;
                    } else if (IsEarlier(astroTimeChildrenUp, adapter.config.W_shutterUpChildrenMin)) {
                        upTimeChildren = adapter.config.W_shutterUpChildrenMin;
                        debugCnt = 8;
                    }
                }
            }

            break;
    }
    adapter.setState('info.upTimeChildren', { val: upTimeChildren, ack: true });
    adapter.log.debug('Starting up shutters children area: ' + upTimeChildren + " debug " + debugCnt);
    shutterUpChildren(adapter, upTimeChildren, delayUpChildren, autoChildrenStr, shutterSettings)

    // ******** Set Down-Time Living Area ********
    switch (adapter.config.livingAutomatic) {
        case 'livingTime':
            if (dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr) === true || (publicHolidayTomorowStr) === true || (schoolfreeTomorowStr === true && adapter.config.schoolfreeLivingArea == true)) {
                downTimeLiving = adapter.config.WE_shutterDownLiving;
                debugCnt = 1;
            } else {
                downTimeLiving = adapter.config.W_shutterDownLiving;
                debugCnt = 2;
            }
            break;
        default:
            if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr) === true || (publicHolidayTomorowStr) === true || (schoolfreeTomorowStr === true && adapter.config.schoolfreeLivingArea == true)) && IsEarlier(adapter.config.WE_shutterDownLiving, astroTimeLivingDown)) {
                downTimeLiving = adapter.config.WE_shutterDownLiving;
                debugCnt = 3;
            } else if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr) === true || (publicHolidayTomorowStr) === true || (schoolfreeTomorowStr === true && adapter.config.schoolfreeLivingArea == true)) && IsLater(adapter.config.WE_shutterDownLiving, astroTimeLivingDown)) {
                downTimeLiving = astroTimeLivingDown;
                debugCnt = 4;
            } else if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr) === true || (publicHolidayTomorowStr) === true || (schoolfreeTomorowStr === true && adapter.config.schoolfreeLivingArea == true)) && IsEqual(adapter.config.WE_shutterDownLiving, astroTimeLivingDown)) {
                downTimeLiving = astroTimeLivingDown;
                debugCnt = 5;

            } else if (dayStr < 5 && IsLater(astroTimeLivingDown, adapter.config.W_shutterDownLiving)) {
                downTimeLiving = adapter.config.W_shutterDownLiving;
                debugCnt = 6;
            } else if (dayStr < 5 && IsEarlier(astroTimeLivingDown, adapter.config.W_shutterDownLiving)) {
                downTimeLiving = astroTimeLivingDown;
                debugCnt = 7;
            } else if (dayStr < 5 && IsEqual(astroTimeLivingDown, adapter.config.W_shutterDownLiving)) {
                downTimeLiving = astroTimeLivingDown;
                debugCnt = 8;
            }
            break;
    }

    adapter.setState('info.downTimeLiving', { val: downTimeLiving, ack: true });
    adapter.log.debug('Shutdown shutters living area: ' + downTimeLiving + " debug " + debugCnt);
    shutterDownLiving(adapter, downTimeLiving, autoLivingStr, shutterSettings);

    // ******** Set Down-Time Children Area ******** 
    switch (adapter.config.childrenAutomatic) {
        case 'childrenTime':
            if (dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr) === true || (publicHolidayTomorowStr) === true || (schoolfreeTomorowStr === true && adapter.config.schoolfreeChildrenArea == true)) {
                downTimeChildren = adapter.config.WE_shutterDownChildren;
                debugCnt = 1;
            } else {
                downTimeChildren = adapter.config.W_shutterDownChildren;
                debugCnt = 2;
            }
            break;
        default:
            if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr) === true || (publicHolidayTomorowStr) === true || (schoolfreeTomorowStr === true && adapter.config.schoolfreeChildrenArea == true)) && (adapter.config.WE_shutterDownChildren) < (astroTimeChildrenDown)) {
                downTimeChildren = adapter.config.WE_shutterDownChildren;
                debugCnt = 3;
            } else if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr) === true || (publicHolidayTomorowStr || (schoolfreeTomorowStr === true && adapter.config.schoolfreeChildrenArea == true)) === true) && (adapter.config.WE_shutterDownChildren) > (astroTimeChildrenDown)) {
                downTimeChildren = astroTimeChildrenDown;
                debugCnt = 4;
            } else if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr) === true || (publicHolidayTomorowStr || (schoolfreeTomorowStr === true && adapter.config.schoolfreeChildrenArea == true)) === true) && (adapter.config.WE_shutterDownChildren) == (astroTimeChildrenDown)) {
                downTimeChildren = astroTimeChildrenDown;
                debugCnt = 5;

            } else if ((dayStr < 5 || dayStr === 0) && (astroTimeChildrenDown) > (adapter.config.W_shutterDownChildren)) {
                downTimeChildren = adapter.config.W_shutterDownChildren;
                debugCnt = 6;
            } else if ((dayStr < 5 || dayStr === 0) && (astroTimeChildrenDown) < (adapter.config.W_shutterDownChildren)) {
                downTimeChildren = astroTimeChildrenDown;
                debugCnt = 7;
            } else if ((dayStr < 5 || dayStr === 0) && (astroTimeChildrenDown) == (adapter.config.W_shutterDownChildren)) {
                downTimeChildren = astroTimeChildrenDown;
                debugCnt = 8;
            }
            break;
    }
    adapter.setState('info.downTimeChildren', { val: downTimeChildren, ack: true });
    adapter.log.debug('Shutdown shutters children area: ' + downTimeChildren + " debug " + debugCnt);
    shutterDownChildren(adapter, downTimeChildren, delayDownChildren, autoChildrenStr, shutterSettings);

    // ******** Set Down-Time Sleep Area ******** 
    switch (adapter.config.sleepAutomatic) {
        case 'sleepTime':
            if (dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr) === true || (publicHolidayTomorowStr) === true || (schoolfreeTomorowStr === true && adapter.config.schoolfreeSleepArea == true)) {
                downTimeSleep = adapter.config.WE_shutterDownSleep;
                debugCnt = 1;
            } else {
                downTimeSleep = adapter.config.W_shutterDownSleep;
                debugCnt = 2;
            }
            break;
        default:
            if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr) === true || (publicHolidayTomorowStr) === true || (schoolfreeTomorowStr === true && adapter.config.schoolfreeSleepArea == true)) && (adapter.config.WE_shutterDownSleep) < (astroTimeSleepDown)) {
                downTimeSleep = adapter.config.WE_shutterDownSleep;
                debugCnt = 3;
            } else if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr) === true || (publicHolidayTomorowStr) === true || (schoolfreeTomorowStr === true && adapter.config.schoolfreeSleepArea == true)) && (adapter.config.WE_shutterDownSleep) > (astroTimeSleepDown)) {
                downTimeSleep = astroTimeSleepDown;
                debugCnt = 4;
            } else if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr) === true || (publicHolidayTomorowStr) === true || (schoolfreeTomorowStr === true && adapter.config.schoolfreeSleepArea == true)) && (adapter.config.WE_shutterDownSleep) == (astroTimeSleepDown)) {
                downTimeSleep = astroTimeSleepDown;
                debugCnt = 5;

            } else if ((dayStr < 5 || dayStr === 0) && (astroTimeSleepDown) > (adapter.config.W_shutterDownSleep)) {
                downTimeSleep = adapter.config.W_shutterDownSleep;
                debugCnt = 6;
            } else if ((dayStr < 5 || dayStr === 0) && (astroTimeSleepDown) < (adapter.config.W_shutterDownSleep)) {
                downTimeSleep = astroTimeSleepDown;
                debugCnt = 7;
            } else if ((dayStr < 5 || dayStr === 0) && (astroTimeSleepDown) == (adapter.config.W_shutterDownSleep)) {
                downTimeSleep = astroTimeSleepDown;
                debugCnt = 8;
            }
            break;
    }
    adapter.setState('info.downTimeSleep', { val: downTimeSleep, ack: true });
    adapter.log.debug('Shutdown shutters sleep area: ' + downTimeSleep + " debug " + debugCnt);
    shutterDownSleep(adapter, downTimeSleep, delayDown, autoSleepStr, shutterSettings);
    shutterDownLate(adapter, shutterSettings);
    shutterDownComplete(adapter, delayDown, shutterSettings);
    delayCalc();
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ++++++++++++++++++ Calc current Sun position all 5 Min ++++++++++++++++++++++

let azimuth;
let elevation;

function sunPos() {
    let currentPos;
    try {
        currentPos = SunCalc.getPosition(new Date(), adapter.config.latitude, adapter.config.longitude);
        adapter.log.debug('calculate astrodata ...');
    } catch (e) {
        adapter.log.error('cannot calculate astrodata ... please check your config for latitude und longitude!!');
    }

    const currentAzimuth = currentPos.azimuth * 180 / Math.PI + 180; // get sunrise azimuth in degrees
    const currentAltitude = currentPos.altitude * 180 / Math.PI; // get sunrise altitude in degrees

    azimuth = Math.round(10 * currentAzimuth) / 10;
    elevation = Math.round(10 * currentAltitude) / 10;

    adapter.log.debug('Sun Azimut: ' + azimuth + '°');
    adapter.setState('info.Azimut', { val: azimuth, ack: true });
    adapter.log.debug('Sun Elevation: ' + elevation + '°');
    adapter.setState('info.Elevation', { val: elevation, ack: true });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ++++++++++++++++++++ Add delay Time ++++++++++++++++++++++++

function addMinutes(time, minsToAdd) {
    function D(J) { return (J < 10 ? '0' : '') + J; }
    const piece = time.split(':');
    const mins = piece[0] * 60 + +piece[1] + +minsToAdd;
    return D(mins % (24 * 60) / 60 | 0) + ':' + D(mins % 60);
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// +++++++++++++++++ calc the shutter delay +++++++++++++++++++

function delayCalc() {
    delayUp = 0;
    delayDown = 0;
    delayUpChildren = 0;
    delayDownChildren = 0;

    const resultFull = shutterSettings; // Full Result

    if (resultFull) {
        if ((upTimeLiving) === (upTimeSleep)) {
            const resLiving = resultFull.filter((/** @type {{ typeUp: string; }} */ d) => d.typeUp == 'living'); // Filter Area Living
            const result = resLiving.filter((/** @type {{ enabled: boolean; }} */ d) => d.enabled === true); // Filter enabled

            for (const i in result) {
                delayUp++;
            }
            if ((autoLivingStr) === true) {
                const resLivingAuto = resultFull.filter((/** @type {{ typeUp: string; }} */ d) => d.typeUp == 'living-auto'); // Filter Area Living
                const result2 = resLivingAuto.filter((/** @type {{ enabled: boolean; }} */ d) => d.enabled === true); // Filter enabled

                for (const i in result2) {
                    delayUp++;
                }
            }
        }

        if ((upTimeSleep) === (upTimeChildren)) {
            delayUpChildren = delayUp;

            const resLiving = resultFull.filter((/** @type {{ typeUp: string; }} */ d) => d.typeUp == 'sleep'); // Filter Area Sleep
            const result = resLiving.filter((/** @type {{ enabled: boolean; }} */ d) => d.enabled === true); // Filter enabled

            for (const i in result) {
                delayUpChildren++;
            }
            if ((autoSleepStr) === true) {
                const resLivingAuto = resultFull.filter((/** @type {{ typeUp: string; }} */ d) => d.typeUp == 'sleep-auto'); // Filter Area Sleep
                const result2 = resLivingAuto.filter((/** @type {{ enabled: boolean; }} */ d) => d.enabled === true); // Filter enabled

                for (const i in result2) {
                    delayUpChildren++;
                }
            }
        }
        if ((downTimeLiving) === (downTimeSleep)) {
            const resLiving2 = resultFull.filter((/** @type {{ typeDown: string; }} */ d) => d.typeDown == 'living'); // Filter Area Living
            const result3 = resLiving2.filter((/** @type {{ enabled: boolean; }} */ d) => d.enabled === true); // Filter enabled

            for (const i in result3) {
                delayDown++;
            }
            if ((autoLivingStr) === true) {
                const resLivingAuto2 = resultFull.filter((/** @type {{ typeDown: string; }} */ d) => d.typeDown == 'living-auto'); // Filter Area Living
                const result4 = resLivingAuto2.filter((/** @type {{ enabled: boolean; }} */ d) => d.enabled === true); // Filter enabled

                for (const i in result4) {
                    delayDown++;
                }
            }
        }

        if ((downTimeSleep) === (downTimeChildren)) {
            delayDownChildren = delayDown;

            const resLiving2 = resultFull.filter((/** @type {{ typeDown: string; }} */ d) => d.typeDown == 'sleep'); // Filter Area Sleep
            const result3 = resLiving2.filter((/** @type {{ enabled: boolean; }} */ d) => d.enabled === true); // Filter enabled

            for (const i in result3) {
                delayDownChildren++;
            }

            if ((autoSleepStr) === true) {
                const resLivingAuto2 = resultFull.filter((/** @type {{ typeDown: string; }} */ d) => d.typeDown == 'sleep-auto'); // Filter Area Sleep
                const result4 = resLivingAuto2.filter((/** @type {{ enabled: boolean; }} */ d) => d.enabled === true); // Filter enabled

                for (const i in result4) {
                    delayDownChildren++;
                }
            }
        }
    }

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// +++++++++++++++++ create states for all new shutter in the config +++++++++++++++++++

function createShutter() {
    const result = shutterSettings;
    if (result) {
        for (const i in result) {
            let objectName;

            if (result[i].shutterName !== '') {
                objectName = result[i].shutterName.replace(/[.;, ]/g, '_');
            } else if (result[i].shutterName == '') {
                objectName = result[i].name.replace(/[.;, ]/g, '_');
            }

            if (objectName && objectName !== '') {
                try {
                    // Create Object for auto up
                    adapter.setObjectNotExists('shutters.autoUp.' + objectName, {
                        "type": "state",
                        "common": {
                            "role": "switch",
                            "name": result[i].shutterName,
                            "type": "boolean",
                            "read": true,
                            "write": true,
                            "def": true
                        },
                        "native": {},
                    });

                    adapter.getState('shutters.autoUp.' + objectName, (state) => {
                        if ((state && state === null) || (state && state.val === null)) {
                            adapter.setState('shutters.autoUp.' + objectName, { val: true, ack: true });
                            adapter.log.debug('Create Object: shutters.autoUp.' + objectName);
                        }
                    });
                    // Create Object for auto down
                    adapter.setObjectNotExists('shutters.autoDown.' + objectName, {
                        "type": "state",
                        "common": {
                            "role": "switch",
                            "name": result[i].shutterName,
                            "type": "boolean",
                            "read": true,
                            "write": true,
                            "def": true
                        },
                        "native": {},
                    });

                    adapter.getState('shutters.autoDown.' + objectName, (state) => {
                        if ((state && state === null) || (state && state.val === null)) {
                            adapter.setState('shutters.autoDown.' + objectName, { val: true, ack: true });
                            adapter.log.debug('Create Object: shutters.autoDown.' + objectName);
                        }
                    });
                    // Create Object for auto sun
                    adapter.setObjectNotExists('shutters.autoSun.' + objectName, {
                        "type": "state",
                        "common": {
                            "role": "switch",
                            "name": result[i].shutterName,
                            "type": "boolean",
                            "read": true,
                            "write": true,
                            "def": true
                        },
                        "native": {},
                    });

                    adapter.getState('shutters.autoSun.' + objectName, (state) => {
                        if ((state && state === null) || (state && state.val === null)) {
                            adapter.setState('shutters.autoSun.' + objectName, { val: true, ack: true });
                            adapter.log.debug('Create Object: shutters.autoSun.' + objectName);
                        }
                    });
                    // Create Object for auto state
                    adapter.setObjectNotExists('shutters.autoState.' + objectName, {
                        "type": "state",
                        "common": {
                            "role": "indicator",
                            "name": result[i].shutterName,
                            "type": "string",
                            "read": true,
                            "write": false,
                            "def": ""
                        },
                        "native": {},
                    });

                    adapter.getState('shutters.autoState.' + objectName, (state) => {
                        if ((state && state === null) || (state && state.val === null)) {
                            adapter.setState('shutters.autoState.' + objectName, { val: 'none', ack: true });
                            adapter.log.debug('Create Object: shutters.autoState.' + objectName);
                        }
                    });
                    // Create Object for auto level
                    adapter.setObjectNotExists('shutters.autoLevel.' + objectName, {
                        "type": "state",
                        "common": {
                            "role": "indicator",
                            "name": result[i].shutterName,
                            "type": "number",
                            "unit": "%",
                            "read": true,
                            "write": false,
                            "def": ""
                        },
                        "native": {},
                    });

                    adapter.getState('shutters.autoLevel.' + objectName, (state) => {
                        if ((state && state === null) || (state && state.val === null)) {
                            adapter.log.debug('Create Object: shutters.autoLevel.' + objectName);
                        }
                        if (state) {
                            adapter.setState('shutters.autoLevel.' + objectName, { val: parseFloat(result[i].currentHeight), ack: true });
                        }
                    });
                } catch (e) {
                    adapter.log.warn('shutter cannot created ... Please check your shutter config: ' + e);
                }
            } else {
                adapter.log.warn('shutter cannot created ... Please check in your config the shutter Name');
            }
        }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // +++++++++++++++++++++ delete all states of deleting shutter ++++++++++++++++++

    // delete old shutter auto up
    for (const i in ObjautoUp) {
        const resID = ObjautoUp[i]._id;
        const objectID = resID.split('.');
        const resultID = objectID[4];

        const resultName = result.map(({ shutterName }) => ({ shutterName }));
        let fullRes = [];

        for (const i in resultName) {
            const res = resultName[i].shutterName.replace(/[.;, ]/g, '_');
            fullRes.push(res);
        }
        timerDelete = setTimeout(function () {
            if (fullRes.indexOf(resultID) === -1) {
                adapter.log.warn('DELETE: ' + resID);
                adapter.delObject(resID,
                    function (err) {
                        if (err) {
                            adapter.log.warn(err);
                        }
                    });
            }
        }, 1500);
    }
    // delete old shutter auto down
    for (const i in ObjautoDown) {
        const resID = ObjautoDown[i]._id;
        const objectID = resID.split('.');
        const resultID = objectID[4];

        const resultName = result.map(({ shutterName }) => ({ shutterName }));
        let fullRes = [];

        for (const i in resultName) {
            const res = resultName[i].shutterName.replace(/[.;, ]/g, '_');
            fullRes.push(res);
        }
        timerDelete1 = setTimeout(function () {
            if (fullRes.indexOf(resultID) === -1) {
                adapter.log.warn('DELETE: ' + resID);
                adapter.delObject(resID,
                    function (err) {
                        if (err) {
                            adapter.log.warn(err);
                        }
                    });
            }
        }, 1500);
    }
    // delete old shutter auto sun
    for (const i in ObjautoSun) {
        const resID = ObjautoSun[i]._id;
        const objectID = resID.split('.');
        const resultID = objectID[4];

        const resultName = result.map(({ shutterName }) => ({ shutterName }));
        let fullRes = [];

        for (const i in resultName) {
            const res = resultName[i].shutterName.replace(/[.;, ]/g, '_');
            fullRes.push(res);
        }
        timerDelete2 = setTimeout(function () {
            if (fullRes.indexOf(resultID) === -1) {
                adapter.log.warn('DELETE: ' + resID);
                adapter.delObject(resID,
                    function (err) {
                        if (err) {
                            adapter.log.warn(err);
                        }
                    });
            }
        }, 1500);
    }
    // delete old shutter auto state
    for (const i in ObjautoState) {
        const resID = ObjautoState[i]._id;
        const objectID = resID.split('.');
        const resultID = objectID[4];

        const resultName = result.map(({ shutterName }) => ({ shutterName }));
        let fullRes = [];

        for (const i in resultName) {
            const res = resultName[i].shutterName.replace(/[.;, ]/g, '_');
            fullRes.push(res);
        }
        timerDelete3 = setTimeout(function () {
            if (fullRes.indexOf(resultID) === -1) {
                adapter.log.warn('DELETE: ' + resID);
                adapter.delObject(resID,
                    function (err) {
                        if (err) {
                            adapter.log.warn(err);
                        }
                    });
            }
        }, 1500);
    }
    // delete old shutter auto level
    for (const i in ObjautoLevel) {
        const resID = ObjautoLevel[i]._id;
        const objectID = resID.split('.');
        const resultID = objectID[4];

        const resultName = result.map(({ shutterName }) => ({ shutterName }));
        let fullRes = [];

        for (const i in resultName) {
            const res = resultName[i].shutterName.replace(/[.;, ]/g, '_');
            fullRes.push(res);
        }
        timerDelete4 = setTimeout(function () {
            if (fullRes.indexOf(resultID) === -1) {
                adapter.log.warn('DELETE: ' + resID);
                adapter.delObject(resID,
                    function (err) {
                        if (err) {
                            adapter.log.warn(err);
                        }
                    });
            }
        }, 1500);
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// +++++++++++++++++++ Is Later function ++++++++++++++++++++++

/**
 * @param {string} timeVal
 * @param {string} timeLimit
 */
function IsLater(timeVal, timeLimit) {
    let ret = false;
    try {
        adapter.log.debug('check IsLater : ' + timeVal + " " + timeLimit);

        if (typeof timeVal === "string" && typeof timeLimit === "string") {
            const valIn = timeVal.split(":");
            const valLimits = timeLimit.split(":");

            if (valIn.length > 1 && valLimits.length > 1) {

                if (parseInt(valIn[0]) > parseInt(valLimits[0])
                    || (parseInt(valIn[0]) == parseInt(valLimits[0]) && parseInt(valIn[1]) > parseInt(valLimits[1]))) {
                    ret = true;
                    adapter.log.debug('yes, IsLater : ' + timeVal + " " + timeLimit);
                }
            }
            else {
                adapter.log.error('string does not contain : ' + timeVal + " " + timeLimit);
            }
        }
        else {
            adapter.log.error('not a string ' + typeof timeVal + " " + typeof timeLimit);
        }
    }
    catch (e) {
        adapter.log.error("exception in IsLater [" + e + "]");
    }
    return ret;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// +++++++++++++++++ Is Earlier function +++++++++++++++++++++

/**
 * @param {string } timeVal
 * @param {string } [timeLimit]
 */
function IsEarlier(timeVal, timeLimit) {
    let ret = false;
    try {
        adapter.log.debug('check IsEarlier : ' + timeVal + " " + timeLimit);

        if (typeof timeVal === "string" && typeof timeLimit === "string") {
            const valIn = timeVal.split(":");
            const valLimits = timeLimit.split(":");

            if (valIn.length > 1 && valLimits.length > 1) {

                if (parseInt(valIn[0]) < parseInt(valLimits[0])
                    || (parseInt(valIn[0]) == parseInt(valLimits[0]) && parseInt(valIn[1]) < parseInt(valLimits[1]))) {
                    ret = true;
                    adapter.log.debug('yes, IsEarlier : ' + timeVal + " " + timeLimit);
                }
            }
            else {
                adapter.log.error('string does not contain : ' + timeVal + " " + timeLimit);
            }
        }
        else {
            adapter.log.error('not a string ' + typeof timeVal + " " + typeof timeLimit);
        }
    }
    catch (e) {
        adapter.log.error("exception in IsEarlier [" + e + "]");
    }
    return ret;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ++++++++++++++++++++++++++ is Equal function ++++++++++++++++++++++
/**
 * @param {string} timeVal
 * @param {string} timeLimit
 */
function IsEqual(timeVal, timeLimit) {
    let ret = false;
    try {
        adapter.log.debug('check IsEqual : ' + timeVal + " " + timeLimit);

        if (typeof timeVal === "string" && typeof timeLimit === "string") {
            const valIn = timeVal.split(":");
            const valLimits = timeLimit.split(":");

            if (valIn.length > 1 && valLimits.length > 1) {

                if (parseInt(valIn[0]) === parseInt(valLimits[0]) && parseInt(valIn[1]) === parseInt(valLimits[1])) {
                    ret = true;
                    adapter.log.debug('yes, IsEqual : ' + timeVal + " " + timeLimit);
                }
            }
            else {
                adapter.log.error('string does not contain : ' + timeVal + " " + timeLimit);
            }
        }
        else {
            adapter.log.error('not a string ' + typeof timeVal + " " + typeof timeLimit);
        }
    }
    catch (e) {
        adapter.log.error("exception in IsEqual [" + e + "]");
    }
    return ret;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// +++++++++++++++++++ main on start of Adapter ++++++++++++++++++++

function main(adapter) {

    adapter.getForeignObject('system.config', (obj) => {
        if (obj) {
            checkStates();
        }
    });

    // read shutter settings from config
    shutterSettings = adapter.config.events;
    saveCurrentStates(true);
    timer = setTimeout(function () {
        checkActualStates();
        const calcPos = schedule.scheduleJob('calcPosTimer', '*/5 * * * *', function () {
            sunPos();
        });
    }, 2000);

    GetSystemData();

    adapter.subscribeStates('control.*');
    adapter.subscribeStates('info.Elevation');
    adapter.subscribeStates('info.Azimut');

    if (adapter.config.publicHolidays === true && (adapter.config.publicHolInstance + '.heute.*')) {
        adapter.subscribeForeignStates(adapter.config.publicHolInstance + '.heute.*');
    }
    if (adapter.config.publicHolidays === true && (adapter.config.publicHolInstance + '.morgen.*')) {
        adapter.subscribeForeignStates(adapter.config.publicHolInstance + '.morgen.*');
    }

    if (adapter.config.schoolfree === true && (adapter.config.schoolfreeInstance + '.info.*')) {
        adapter.subscribeForeignStates(adapter.config.schoolfreeInstance + '.info.*');
    }

    if (adapter.config.HolidayDP !== '') {
        adapter.subscribeForeignStates(adapter.config.HolidayDP);
        adapter.log.info('subscribe ' + adapter.config.HolidayDP);
    }

    if (adapter.config.schoolfreeDP !== '') {
        adapter.subscribeForeignStates(adapter.config.schoolfreeDP);
        adapter.log.info('subscribe ' + adapter.config.schoolfreeDP);
    }

    if (adapter.config.triggerAutoLiving != '') {
        adapter.subscribeForeignStates(adapter.config.triggerAutoLiving);
    }
    if (adapter.config.triggerAutoSleep != '') {
        adapter.subscribeForeignStates(adapter.config.triggerAutoSleep);
    }
    if (adapter.config.triggerAutoChildren != '') {
        adapter.subscribeForeignStates(adapter.config.triggerAutoChildren);
    }
    if (adapter.config.lightsensorUpDown != '') {
        adapter.subscribeForeignStates(adapter.config.lightsensorUpDown);
        adapter.getForeignState(adapter.config.lightsensorUpDown, (state) => {
            if (state && state.val && state.val !== null) {
                brightnessDown = brightnessState(adapter, state.val, brightnessDown);
                adapter.log.debug('Brightness State Down is: ' + brightnessDown);
            }
        });
    }

    if (adapter.config.alarmWind1 != '') {
        adapter.subscribeForeignStates(adapter.config.alarmWind1);
    }
    if (adapter.config.alarmWind2 != '') {
        adapter.subscribeForeignStates(adapter.config.alarmWind2);
    }
    if (adapter.config.alarmRain != '') {
        adapter.subscribeForeignStates(adapter.config.alarmRain);
    }
    if (adapter.config.alarmFrost != '') {
        adapter.subscribeForeignStates(adapter.config.alarmFrost);
    }
    if (adapter.config.alarmFire != '') {
        adapter.subscribeForeignStates(adapter.config.alarmFire);
    }

    //adapter.log.debug('all shutters ' + JSON.stringify(result));
    if (shutterSettings) {
        const res = shutterSettings.map(({ triggerID }) => ({ triggerID }));
        const resTriggerActive = res.filter((/** @type {{ triggerID: string; }} */ d) => d.triggerID != '');

        for (const i in resTriggerActive) {
            if (resTrigger.indexOf(resTriggerActive[i].triggerID) === -1) {
                resTrigger.push(resTriggerActive[i].triggerID);
            }
        }
        resTrigger.forEach(function (element) {
            adapter.subscribeForeignStates(element);
            adapter.log.debug('trigger for shuttercontrol: ' + element);
        });

        const resInsideTemp = shutterSettings.map(({ tempSensor }) => ({ tempSensor }));
        const rescurrentInsideTemp = resInsideTemp.filter((/** @type {{ tempSensor: string; }} */ d) => d.tempSensor != '');

        for (const i in rescurrentInsideTemp) {
            if (resSunInsideTemp.indexOf(rescurrentInsideTemp[i].tempSensor) === -1) {
                resSunInsideTemp.push(rescurrentInsideTemp[i].tempSensor);
            }
        }
        resSunInsideTemp.forEach(function (element) {
            adapter.subscribeForeignStates(element);
            adapter.log.debug('trigger for inside temperature: ' + element);
        });

        const resOutsideTemp = shutterSettings.map(({ outsideTempSensor }) => ({ outsideTempSensor }));
        const rescurrentOutsideTemp = resOutsideTemp.filter((/** @type {{ outsideTempSensor: string; }} */ d) => d.outsideTempSensor != '');

        for (const i in rescurrentOutsideTemp) {
            if (resSunOutsideTemp.indexOf(rescurrentOutsideTemp[i].outsideTempSensor) === -1) {
                resSunOutsideTemp.push(rescurrentOutsideTemp[i].outsideTempSensor);
            }
        }
        resSunOutsideTemp.forEach(function (element) {
            adapter.subscribeForeignStates(element);
            adapter.log.debug('trigger for outside temperature: ' + element);
        });

        const resLight = shutterSettings.map(({ lightSensor }) => ({ lightSensor }));
        const rescurrentLight = resLight.filter((/** @type {{ lightSensor: string; }} */ d) => d.lightSensor != '');

        for (const i in rescurrentLight) {
            if (resSunLight.indexOf(rescurrentLight[i].lightSensor) === -1) {
                resSunLight.push(rescurrentLight[i].lightSensor);
            }
        }
        resSunLight.forEach(function (element) {
            adapter.subscribeForeignStates(element);
            adapter.log.debug('trigger for Light Sensor: ' + element);
        });

        const resShutter = shutterSettings.map(({ name }) => ({ name }));
        const rescurrentShutter = resShutter.filter((/** @type {{ name: string; }} */ d) => d.name != '');

        for (const i in rescurrentShutter) {
            if (resShutterState.indexOf(rescurrentShutter[i].name) === -1) {
                resShutterState.push(rescurrentShutter[i].name);
            }
        }
        resShutterState.forEach(function (element) {
            adapter.subscribeForeignStates(element);
            adapter.log.debug('Shutter State: ' + element);
        });

        for (const s in shutterSettings) {
            adapter.getForeignState(shutterSettings[s].name, (state) => {
                if (typeof state != undefined && state != null) {
                    shutterSettings[s].currentHeight = (state.val);
                    shutterSettings[s].oldHeight = (state.val);
                    shutterSettings[s].triggerHeight = (state.val);

                    adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);

                    if (parseFloat(shutterSettings[s].heightDown) < parseFloat(shutterSettings[s].heightUp)) {
                        adapter.log.debug(shutterSettings[s].shutterName + ' level conversion is disabled ...');
                    } else if (parseFloat(shutterSettings[s].heightDown) > parseFloat(shutterSettings[s].heightUp)) {
                        adapter.log.debug(shutterSettings[s].shutterName + ' level conversion is enabled');
                    }
                }
            });
        }
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ++++++++++++++++++ start option of Adapter ++++++++++++++++++++++
// If started as allInOne/compact mode => return function to create instance
// @ts-ignore
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}