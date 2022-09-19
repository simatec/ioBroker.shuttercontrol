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
let timer, timerSleep;

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
const lastLigthSensorValue = {};

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
            clearTimeout(timerSleep);
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

    adapter.on('stateChange', async (id, state) => {
        if (state) {
            if (adapter.config.HolidayDP !== '') {
                if (id.includes(adapter.config.HolidayDP)) {
                    adapter.log.debug('HolidayDP changed to ' + state.val);
                    await adapter.setStateAsync('control.Holiday', { val: state.val, ack: true })
                        .catch((e) => adapter.log.warn(e));
                }
            }
            if (adapter.config.schoolfreeDP !== '') {
                if (id.includes(adapter.config.schoolfreeDP)) {
                    adapter.log.debug('schoolfreeDP changed to ' + state.val);
                    await adapter.setStateAsync('control.schoolfree', { val: state.val, ack: true })
                        .catch((e) => adapter.log.warn(e));
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
                await adapter.setStateAsync('control.autoLiving', { val: state.val, ack: true })
                    .catch((e) => adapter.log.warn(e));
                adapter.log.debug('Auto Living is: ' + state.val);
            }
            if (id === adapter.config.triggerAutoSleep) {
                await adapter.setStateAsync('control.autoSleep', { val: state.val, ack: true })
                    .catch((e) => adapter.log.warn(e));
                adapter.log.debug('Auto Sleep is: ' + state.val);
            }
            if (id === adapter.config.triggerAutoChildren) {
                await adapter.setStateAsync('control.autoChildren', { val: state.val, ack: true })
                    .catch((e) => adapter.log.warn(e));
                adapter.log.debug('Auto Children is: ' + state.val);
            }
            if (id === adapter.config.lightsensorUpDown) {
                shutterBrightnessSensor(adapter, state.val, shutterSettings, brightnessDown);
                adapter.log.debug('Brightness sensor value: ' + state.val);

                await sleep(10000);
                brightnessDown = brightnessState(adapter, state.val, brightnessDown);
                adapter.log.debug('Brightness State Down is: ' + brightnessDown);
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

            resTrigger.forEach(async function (resultTriggerID) {
                if (id === resultTriggerID && state.ts === state.lc) {
                    resTriggerChange = resultTriggerID;
                    adapter.log.debug('TriggerID changed: ' + resultTriggerID + ' Value: ' + state.val);
                    triggerChange(resTriggerChange, adapter, shutterSettings);
                }
            });
            resSunInsideTemp.forEach(async function (resSunInsideTempID) {
                if (id === resSunInsideTempID && state.ts === state.lc) {
                    adapter.log.debug('insidetemperature changed: ' + resSunInsideTempID + ' Value: ' + state.val);
                    sunProtect(adapter, elevation, azimuth, shutterSettings);
                }
            });
            resSunOutsideTemp.forEach(async function (resSunOutsideTempID) {
                if (id === resSunOutsideTempID && state.ts === state.lc) {
                    adapter.log.debug('outsidetemperature changed: ' + resSunOutsideTempID + ' Value: ' + state.val);
                    sunProtect(adapter, elevation, azimuth, shutterSettings);
                }
            });
            resSunLight.forEach(async function (resSunLightID) {
                if (id === resSunLightID && state.ts === state.lc) {
                    // @ts-ignore
                    if (Math.round((new Date(state.lc) - new Date(lastLigthSensorValue[`${resSunLightID}`].ts)) / 1000 / 60) > 2) {
                        adapter.log.debug('Lightsensor changed: ' + resSunLightID + ' Value: ' + state.val);
                        sunProtect(adapter, elevation, azimuth, shutterSettings);
                        lastLigthSensorValue[`${resSunLightID}`].ts = state.lc;
                    }
                }
            });
            resShutterState.forEach(async function (resShutterID) {
                if (id === resShutterID && state.ts === state.lc) {
                    const result = shutterSettings.filter((/** @type {{ name: any; }} */ d) => d.name == resShutterID);

                    if (adapter.config.currentShutterState == true && adapter.config.currentShutterStateTime) {
                        waitTime4StateCheck = (adapter.config.currentShutterStateTime ? adapter.config.currentShutterStateTime * 1000 : 60000);
                    }
                    adapter.log.debug(`#0 wait for shutter check started`);
                    await sleep(waitTime4StateCheck);
                    adapter.log.debug(`#0 wait for shutter check end`);

                    for (const i in result) {
                        for (const s in shutterSettings) {
                            if (shutterSettings[s].shutterName == result[i].shutterName) {
                                const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                if (typeof _shutterState != undefined && _shutterState != null && shutterSettings[s].oldHeight != _shutterState.val) {
                                    adapter.log.debug('Shutter state changed: ' + shutterSettings[s].shutterName + ' old value = ' + shutterSettings[s].oldHeight + ' new value = ' + _shutterState.val);
                                }
                                if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != shutterSettings[s].currentHeight && _shutterState.val != shutterSettings[s].oldHeight && adapter.config.currentShutterState == true) {

                                    shutterSettings[s].currentAction = 'Manu_Mode';
                                    shutterSettings[s].triggerAction = 'Manu_Mode';

                                    adapter.log.debug(`#1 shutterName: ${shutterSettings[s].shutterName}`);
                                    adapter.log.debug(`#1 shutterState: ${_shutterState.val} %`);
                                    adapter.log.debug(`#1 currentAction: ${shutterSettings[s].currentAction}`);
                                    adapter.log.debug(`#1 triggerAction: ${shutterSettings[s].triggerAction}`);
                                    adapter.log.debug(`#1 currentHeight: ${shutterSettings[s].currentHeight} %`);
                                    adapter.log.debug(`#1 oldHeight: ${shutterSettings[s].oldHeight} %`);
                                    adapter.log.debug(`#1 currentShutterState: ${adapter.config.currentShutterState === true ? 'activated' : 'disabled'}`);
                                    adapter.log.debug(`#1 currentShutterStateTime: ${adapter.config.currentShutterStateTime} seconds`);

                                    await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true })
                                        .catch((e) => adapter.log.warn(e));

                                    adapter.log.debug(shutterSettings[s].shutterName + ' drived manually to ' + _shutterState.val + '. Old value = ' + shutterSettings[s].oldHeight + '. New value = ' + _shutterState.val);
                                    adapter.log.debug(shutterSettings[s].shutterName + ' Updated trigger action to ' + shutterSettings[s].triggerAction + ' to prevent moving after window close ');
                                    await shutterState(shutterSettings[s].name, adapter, shutterSettings, false);
                                } else if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != shutterSettings[s].currentHeight && _shutterState.val != shutterSettings[s].oldHeight && adapter.config.currentShutterState == false) {
                                    shutterSettings[s].currentAction = 'Manu_Mode';
                                    shutterSettings[s].triggerAction = 'Manu_Mode';

                                    adapter.log.debug(`#2 shutterName: ${shutterSettings[s].shutterName}`);
                                    adapter.log.debug(`#2 shutterState: ${_shutterState.val} %`);
                                    adapter.log.debug(`#2 currentAction: ${shutterSettings[s].currentAction}`);
                                    adapter.log.debug(`#2 triggerAction: ${shutterSettings[s].triggerAction}`);
                                    adapter.log.debug(`#2 currentHeight: ${shutterSettings[s].currentHeight} %`);
                                    adapter.log.debug(`#2 oldHeight: ${shutterSettings[s].oldHeight} %`);
                                    adapter.log.debug(`#2 currentShutterState: ${adapter.config.currentShutterState === true ? 'activated' : 'disabled'}`);
                                    adapter.log.debug(`#2 currentShutterStateTime: ${adapter.config.currentShutterStateTime} seconds`);

                                    await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true })
                                        .catch((e) => adapter.log.warn(e));

                                    adapter.log.debug(shutterSettings[s].shutterName + ' Updated trigger action to ' + shutterSettings[s].triggerAction + ' to prevent moving after window close ');
                                    adapter.log.debug(shutterSettings[s].shutterName + ' drived manually to ' + _shutterState.val + '. Old value = ' + shutterSettings[s].oldHeight + '. New value = ' + _shutterState.val);
                                    await shutterState(shutterSettings[s].name, adapter, shutterSettings, false);
                                } else if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val == shutterSettings[s].currentHeight) {
                                    adapter.log.debug(shutterSettings[s].shutterName + ' Old value = ' + shutterSettings[s].oldHeight + '. New value = ' + _shutterState.val + '. automatic is active');
                                    await shutterState(shutterSettings[s].name, adapter, shutterSettings, false);
                                }
                                await sleep(1000);
                                saveCurrentStates(false);


                                //Shutter is closed -> opened manually to heightUp (should be 100% or 0%) before it has been opened automatically -> enable possibility to activate sunprotect height if required --> if sunprotect is required: shutter is set to sunProtect height
                                if (shutterSettings[s].firstCompleteUp == true && state.val == shutterSettings[s].heightUp && shutterSettings[s].currentAction != 'up' && shutterSettings[s].currentAction != 'triggered' && shutterSettings[s].currentAction != 'triggered_Tilted') {
                                    shutterSettings[s].currentHeight = state.val;
                                    shutterSettings[s].currentAction = 'none'; //reset mode. e.g. mode can be set to sunProtect later if window is closed
                                    shutterSettings[s].firstCompleteUp = false;

                                    await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true })
                                        .catch((e) => adapter.log.warn(e));
                                    await adapter.setStateAsync('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true })
                                        .catch((e) => adapter.log.warn(e));

                                    adapter.log.debug(shutterSettings[s].shutterName + ' opened manually to ' + shutterSettings[s].heightUp + '. Old value = ' + shutterSettings[s].oldHeight + '. New value = ' + state.val + '. Possibility to activate sunprotect enabled.');
                                }
                                if (shutterSettings[s].firstCompleteUp == true && shutterSettings[s].currentAction != 'triggered' && shutterSettings[s].currentAction != 'triggered_Tilted' && shutterSettings[s].currentAction != 'none' && (state.val == shutterSettings[s].heightUp || state.val == shutterSettings[s].heightDownSun)) {
                                    shutterSettings[s].firstCompleteUp = false; //reset firstCompleteUp if shutter has been moved up
                                }
                                //save old height
                                await sleep(60000 + waitTime4StateCheck);
                                shutterSettings[s].oldHeight = state.val;    //set old Height after 60 Sek - after 60 Sek end position should be reached
                                saveCurrentStates(false);
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

// +++++++++++++++++ Check all shutter values ​​and set default values ​​if values ​​are not available ++++++++++++++++++++++++++++

async function shutterConfigCheck() {
    return new Promise(async (resolve) => {
        let num = 0;

        if (shutterSettings) {
            adapter.log.debug('shutter Config Check started');

            try {
                for (const s in shutterSettings) {
                    shutterSettings[s].triggerState = shutterSettings[s].triggerState ? shutterSettings[s].triggerState : 'none';
                    shutterSettings[s].triggerStateTilted = shutterSettings[s].triggerStateTilted ? shutterSettings[s].triggerStateTilted : 'none';
                    shutterSettings[s].typeUp = shutterSettings[s].typeUp ? shutterSettings[s].typeUp : 'sunrise';
                    shutterSettings[s].typeDown = shutterSettings[s].typeDown ? shutterSettings[s].typeDown : 'sunset';
                    shutterSettings[s].heightUp = shutterSettings[s].heightUp ? shutterSettings[s].heightUp : '100';
                    shutterSettings[s].heightDown = shutterSettings[s].heightDown ? shutterSettings[s].heightDown : '0';
                    shutterSettings[s].triggerDrive = shutterSettings[s].triggerDrive ? shutterSettings[s].triggerDrive : '100';
                    shutterSettings[s].triggerDriveTildet = shutterSettings[s].triggerDriveTildet ? shutterSettings[s].triggerDriveTildet : shutterSettings[s].triggerDrive;
                    shutterSettings[s].triggerChange = shutterSettings[s].triggerChange ? shutterSettings[s].triggerChange : 'off';
                    shutterSettings[s].elevation = shutterSettings[s].elevation ? shutterSettings[s].elevation : '8';
                    shutterSettings[s].type = shutterSettings[s].type ? shutterSettings[s].type : 'in- & outside temperature and direction';
                    shutterSettings[s].heightDownSun = shutterSettings[s].heightDownSun ? shutterSettings[s].heightDownSun : '30';
                    shutterSettings[s].direction = shutterSettings[s].direction ? shutterSettings[s].direction : '120';
                    shutterSettings[s].directionRange = shutterSettings[s].directionRange ? shutterSettings[s].directionRange : '50';
                    shutterSettings[s].tempInside = shutterSettings[s].tempInside ? shutterSettings[s].tempInside : '23';
                    shutterSettings[s].tempOutside = shutterSettings[s].tempOutside ? shutterSettings[s].tempOutside : '23';
                    shutterSettings[s].valueLight = shutterSettings[s].valueLight ? shutterSettings[s].valueLight : '15';
                    shutterSettings[s].autoDrive = shutterSettings[s].autoDrive ? shutterSettings[s].autoDrive : 'off';
                    shutterSettings[s].hysteresisOutside = shutterSettings[s].hysteresisOutside ? shutterSettings[s].hysteresisOutside : '5';
                    shutterSettings[s].hysteresisInside = shutterSettings[s].hysteresisInside ? shutterSettings[s].hysteresisInside : '5';
                    shutterSettings[s].hysteresisLight = shutterSettings[s].hysteresisLight ? shutterSettings[s].hysteresisLight : '5';
                    shutterSettings[s].XmasLevel = shutterSettings[s].XmasLevel ? shutterSettings[s].XmasLevel : '0';
                    shutterSettings[s].betweenPositionLevel = shutterSettings[s].betweenPositionLevel ? shutterSettings[s].betweenPositionLevel : '50';
                    shutterSettings[s].trigDelyUp = shutterSettings[s].trigDelyUp ? shutterSettings[s].trigDelyUp : '0';
                    shutterSettings[s].trigDelyDown = shutterSettings[s].trigDelyDown ? shutterSettings[s].trigDelyDown : '0';
                    shutterSettings[s].sunProtectEndDely = shutterSettings[s].sunProtectEndDely ? shutterSettings[s].sunProtectEndDely : '0';

                    shutterSettings[s].LateDown = shutterSettings[s].LateDown != null ? shutterSettings[s].LateDown : false;
                    shutterSettings[s].inSummerNotDown = shutterSettings[s].inSummerNotDown != null ? shutterSettings[s].inSummerNotDown : false;
                    shutterSettings[s].KeepSunProtect = shutterSettings[s].KeepSunProtect != null ? shutterSettings[s].KeepSunProtect : false;
                    shutterSettings[s].driveAfterClose = shutterSettings[s].driveAfterClose != null ? shutterSettings[s].driveAfterClose : false;
                    shutterSettings[s].useXmasLevel = shutterSettings[s].useXmasLevel != null ? shutterSettings[s].useXmasLevel : false;
                    shutterSettings[s].betweenPosition = shutterSettings[s].betweenPosition != null ? shutterSettings[s].betweenPosition : false;
                    shutterSettings[s].enableAlarmWind1 = shutterSettings[s].enableAlarmWind1 != null ? shutterSettings[s].enableAlarmWind1 : false;
                    shutterSettings[s].enableAlarmWind2 = shutterSettings[s].enableAlarmWind2 != null ? shutterSettings[s].enableAlarmWind2 : false;
                    shutterSettings[s].enableAlarmRain = shutterSettings[s].enableAlarmRain != null ? shutterSettings[s].enableAlarmRain : false;
                    shutterSettings[s].enableAlarmFrost = shutterSettings[s].enableAlarmFrost != null ? shutterSettings[s].enableAlarmFrost : false;
                    shutterSettings[s].enableAlarmFire = shutterSettings[s].enableAlarmFire != null ? shutterSettings[s].enableAlarmFire : false;

                    if (num == parseFloat(s)) {
                        adapter.log.debug('shutter Config Check successfully completed');
                        // @ts-ignore
                        resolve();
                    } else {
                        num++;
                    }
                }
            } catch (e) {
                adapter.log.warn(`It is not possible to check the shutter configuration: ${e}`);
                // @ts-ignore
                resolve();
            }
        }
    });
}

// +++++++++++++++++ save states on start and shutter change ++++++++++++++++++++++++++++

async function saveCurrentStates(onStart) {
    if (onStart) {
        await shutterConfigCheck();
    }

    let currentStates = {};
    let shutterName = [];
    let num = 0;

    const _currentStates = await adapter.getStateAsync('shutters.currentStates').catch((e) => adapter.log.warn(e));
    if (_currentStates && _currentStates.val && _currentStates.val !== null) {
        try {
            currentStates = JSON.parse(_currentStates.val);
        } catch (err) {
            adapter.log.debug('settings cannot be read from the state');
            currentStates = {};
        }
    }

    for (const s in shutterSettings) {
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

            for (const i in currentStates) {
                if (shutterName.indexOf(currentStates[i].shutterName) === -1) {
                    const name = currentStates[i].shutterName.replace(/[.;, ]/g, '_')
                    adapter.log.debug(name + ': settings deleted');
                    delete currentStates[`${name}`];
                }

                await sleep(2000);
                await adapter.setStateAsync('shutters.currentStates', { val: JSON.stringify(currentStates), ack: true })
                    .catch((e) => adapter.log.warn(e));
            }
        } else if (num == shutterSettings.length && !onStart) {
            await adapter.setStateAsync('shutters.currentStates', { val: JSON.stringify(currentStates), ack: true })
                .catch((e) => adapter.log.warn(e));
        }
        await sleep(100);
    }
}

// +++++++++++++++++ Check States of Trigger after start ++++++++++++++++++++++++++++

async function checkStates() {
    const _holidayStates = await adapter.getStateAsync('control.Holiday').catch((e) => adapter.log.warn(e));
    if ((_holidayStates && _holidayStates === null) || (_holidayStates && _holidayStates.val === null)) {
        await adapter.setStateAsync('control.Holiday', { val: false, ack: true })
            .catch((e) => adapter.log.warn(e));
    }

    const _schoolfreeStates = await adapter.getStateAsync('control.schoolfree').catch((e) => adapter.log.warn(e));
    if ((_schoolfreeStates && _schoolfreeStates === null) || (_schoolfreeStates && _schoolfreeStates.val === null)) {
        await adapter.setStateAsync('control.schoolfree', { val: false, ack: true })
            .catch((e) => adapter.log.warn(e));
    }

    const _autoLivingStates = await adapter.getStateAsync('control.autoLiving').catch((e) => adapter.log.warn(e));
    if ((_autoLivingStates && _autoLivingStates === null) || (_autoLivingStates && _autoLivingStates.val === null)) {
        await adapter.setStateAsync('control.autoLiving', { val: false, ack: true })
            .catch((e) => adapter.log.warn(e));
    }

    const _autoSleepStates = await adapter.getStateAsync('control.autoSleep').catch((e) => adapter.log.warn(e));
    if ((_autoSleepStates && _autoSleepStates === null) || (_autoSleepStates && _autoSleepStates.val === null)) {
        await adapter.setStateAsync('control.autoSleep', { val: false, ack: true })
            .catch((e) => adapter.log.warn(e));
    }

    const _autoChildrenStates = await adapter.getStateAsync('control.autoChildren').catch((e) => adapter.log.warn(e));
    if ((_autoChildrenStates && _autoChildrenStates === null) || (_autoChildrenStates && _autoChildrenStates.val === null)) {
        await adapter.setStateAsync('control.autoChildren', { val: false, ack: true })
            .catch((e) => adapter.log.warn(e));
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// +++++++++++++++++++ check all current States an changes +++++++++++++++++++++++++

async function checkActualStates() {
    const _holidayStates = await adapter.getStateAsync('control.Holiday').catch((e) => adapter.log.warn(e));
    if (_holidayStates) {
        HolidayStr = _holidayStates.val;
    }

    const _schoolfreeStates = await adapter.getStateAsync('control.schoolfree').catch((e) => adapter.log.warn(e));
    if (_schoolfreeStates) {
        SchoolfreeStr = _schoolfreeStates.val;
    }

    const _autoLivingStates = await adapter.getStateAsync('control.autoLiving').catch((e) => adapter.log.warn(e));
    if (_autoLivingStates) {
        autoLivingStr = _autoLivingStates.val;
    }

    const _autoSleepStates = await adapter.getStateAsync('control.autoSleep').catch((e) => adapter.log.warn(e));
    if (_autoSleepStates) {
        autoSleepStr = _autoSleepStates.val;
    }

    const _autoChildrenStates = await adapter.getStateAsync('control.autoChildren').catch((e) => adapter.log.warn(e));
    if (_autoChildrenStates) {
        autoChildrenStr = _autoChildrenStates.val;
    }

    if (adapter.config.publicHolidays === true && (adapter.config.publicHolInstance != 'none' || adapter.config.publicHolInstance != '')) {
        const _publicHolidayStr = await adapter.getForeignStateAsync(adapter.config.publicHolInstance + '.heute.boolean').catch((e) => adapter.log.warn(e));
        if (typeof _publicHolidayStr != undefined && _publicHolidayStr != null) {
            publicHolidayStr = _publicHolidayStr.val;
        }

        const _publicHolidayTomorowStr = await adapter.getForeignStateAsync(adapter.config.publicHolInstance + '.morgen.boolean').catch((e) => adapter.log.warn(e));
        if (typeof _publicHolidayTomorowStr != undefined && _publicHolidayTomorowStr != null) {
            publicHolidayTomorowStr = _publicHolidayTomorowStr.val;
        }
    }

    if (adapter.config.schoolfree === true && (adapter.config.schoolfreeInstance != 'none' || adapter.config.schoolfreeInstance != '')) {
        const _schoolfreeStr = await adapter.getForeignStateAsync(adapter.config.schoolfreeInstance + '.info.today').catch((e) => adapter.log.warn(e));
        if (typeof _schoolfreeStr != undefined && _schoolfreeStr != null) {
            schoolfreeStr = _schoolfreeStr.val;
        }
        const _schoolfreeTomorowStr = await adapter.getForeignStateAsync(adapter.config.schoolfreeInstance + '.info.tomorrow').catch((e) => adapter.log.warn(e));
        if (typeof _schoolfreeTomorowStr != undefined && _schoolfreeTomorowStr != null) {
            schoolfreeTomorowStr = _schoolfreeTomorowStr.val;
        }
    }

    if (adapter.config.HolidayDP !== '') {
        adapter.log.debug('checking HolidayDP');
        const _HolidayDP = await adapter.getForeignStateAsync(adapter.config.HolidayDP).catch((e) => adapter.log.warn(e));
        if (typeof _HolidayDP != undefined && _HolidayDP != null) {
            adapter.log.debug('got HolidayDP ' + _HolidayDP.val);
            await adapter.setStateAsync('control.Holiday', { val: _HolidayDP.val, ack: true })
                .catch((e) => adapter.log.warn(e));
        }
    }

    if (adapter.config.schoolfreeDP !== '') {
        adapter.log.debug('checking schoolfreeDP');
        const _schoolfreeDP = await adapter.getForeignStateAsync(adapter.config.schoolfreeDP).catch((e) => adapter.log.warn(e));
        if (typeof _schoolfreeDP != undefined && _schoolfreeDP != null) {
            adapter.log.debug('got schoolfreeDP ' + _schoolfreeDP.val);
            await adapter.setStateAsync('control.schoolfree', { val: _schoolfreeDP.val, ack: true })
                .catch((e) => adapter.log.warn(e));
        }
    }
    const _ObjautoUp = await adapter.getForeignObjectsAsync(adapter.namespace + '.shutters.autoUp.*', 'state').catch((e) => adapter.log.warn(e));
    if (_ObjautoUp) {
        ObjautoUp = _ObjautoUp;
    }

    const _ObjautoDown = await adapter.getForeignObjectsAsync(adapter.namespace + '.shutters.autoDown.*', 'state').catch((e) => adapter.log.warn(e));
    if (_ObjautoDown) {
        ObjautoDown = _ObjautoDown;
    }

    const _ObjautoSun = await adapter.getForeignObjectsAsync(adapter.namespace + '.shutters.autoSun.*', 'state').catch((e) => adapter.log.warn(e));
    if (_ObjautoSun) {
        ObjautoSun = _ObjautoSun;
    }

    const _ObjautoState = await adapter.getForeignObjectsAsync(adapter.namespace + '.shutters.autoState.*', 'state').catch((e) => adapter.log.warn(e));
    if (_ObjautoState) {
        ObjautoState = _ObjautoState;
    }

    const _ObjautoLevel = await adapter.getForeignObjectsAsync(adapter.namespace + '.shutters.autoLevel.*', 'state').catch((e) => adapter.log.warn(e));
    if (_ObjautoLevel) {
        ObjautoLevel = _ObjautoLevel;
    }

    await sleep(1000);
    shutterDriveCalc();
    createShutter();
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ++++++++++++++++++ reset current Action in the night at 02:30 +++++++++++++++++++++++

const calc = schedule.scheduleJob('calcTimer', '30 2 * * *', async function () {
    shutterDriveCalc();

    const resultStates = shutterSettings;
    if (resultStates) {
        for (const i in resultStates) {
            const nameDevice = resultStates[i].shutterName.replace(/[.;, ]/g, '_');
            const _shutterState = await adapter.getForeignStateAsync(resultStates[i].name).catch((e) => adapter.log.warn(e));

            if (typeof _shutterState != undefined && _shutterState != null) {
                // Case: Shutter in sunProtect mode. Auto-down in the evening before end of sunProtect. The sun is sill shining. Prevent that the shutter opens again with end of sunProtect. 
                // currentAction=sunprotect would be set in sunProtect(). But not if currentAction=down. So this is checked in sunProtect(). Reset here to enable possibility to set sunProtect in the morning ->
                resultStates[i].currentAction = 'none';
                resultStates[i].firstCompleteUp = true;

                await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: resultStates[i].currentAction, ack: true })
                    .catch((e) => adapter.log.warn(e));
                adapter.log.debug(resultStates[i].shutterName + " set currentHeight to " + _shutterState.val);

                if (typeof _shutterState.val != undefined && _shutterState.val != null) {
                    resultStates[i].currentHeight = _shutterState.val;
                    await adapter.setStateAsync('shutters.autoLevel.' + nameDevice, { val: parseFloat(resultStates[i].currentHeight), ack: true })
                        .catch((e) => adapter.log.warn(e));

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
    adapter.log.debug('Travel times of the shutters are calculated');

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
            if (dayStr === 6 || dayStr === 0 || (HolidayStr) === true || (SchoolfreeStr === true && adapter.config.schoolfreeLivingArea == true) || (publicHolidayStr) === true || (schoolfreeStr === true && adapter.config.schoolfreeLivingArea == true)) {
                upTimeLiving = adapter.config.WE_shutterUpLivingMax;
                debugCnt = 1;
            } else {
                upTimeLiving = adapter.config.W_shutterUpLivingMax;
                debugCnt = 2;
            }
            break;
        default:
            if (dayStr === 6 || dayStr === 0 || (HolidayStr) === true || (SchoolfreeStr === true && adapter.config.schoolfreeLivingArea == true) || (publicHolidayStr) === true || (schoolfreeStr === true && adapter.config.schoolfreeLivingArea == true)) {

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
            if (dayStr === 6 || dayStr === 0 || (HolidayStr) === true || (SchoolfreeStr === true && adapter.config.schoolfreeSleepArea == true) || (publicHolidayStr) === true || (schoolfreeStr === true && adapter.config.schoolfreeSleepArea == true)) {
                upTimeSleep = adapter.config.WE_shutterUpSleepMax;
                debugCnt = 1;
            } else {
                upTimeSleep = adapter.config.W_shutterUpSleepMax;
                debugCnt = 2;
            }
            break;
        default:
            if (dayStr === 6 || dayStr === 0 || (HolidayStr) === true || (SchoolfreeStr === true && adapter.config.schoolfreeSleepArea == true) || (publicHolidayStr) === true || (schoolfreeStr === true && adapter.config.schoolfreeSleepArea == true)) {

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
            if (dayStr === 6 || dayStr === 0 || (HolidayStr) === true || (SchoolfreeStr === true && adapter.config.schoolfreeChildrenArea == true) || (publicHolidayStr) === true || (schoolfreeStr === true && adapter.config.schoolfreeChildrenArea == true)) {
                upTimeChildren = adapter.config.WE_shutterUpChildrenMax;
                debugCnt = 1;
            } else {
                upTimeChildren = adapter.config.W_shutterUpChildrenMax;
                debugCnt = 2;
            }
            break;
        default:
            if (dayStr === 6 || dayStr === 0 || (HolidayStr) === true || (SchoolfreeStr === true && adapter.config.schoolfreeChildrenArea == true) || (publicHolidayStr) === true || (schoolfreeStr === true && adapter.config.schoolfreeChildrenArea == true)) {

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
            if (dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr === true && adapter.config.schoolfreeLivingArea == true) || (publicHolidayTomorowStr) === true || (schoolfreeTomorowStr === true && adapter.config.schoolfreeLivingArea == true)) {
                downTimeLiving = adapter.config.WE_shutterDownLiving;
                debugCnt = 1;
            } else {
                downTimeLiving = adapter.config.W_shutterDownLiving;
                debugCnt = 2;
            }
            break;
        default:
            if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr === true && adapter.config.schoolfreeLivingArea == true) || (publicHolidayTomorowStr) === true || (schoolfreeTomorowStr === true && adapter.config.schoolfreeLivingArea == true)) && IsEarlier(adapter.config.WE_shutterDownLiving, astroTimeLivingDown)) {
                downTimeLiving = adapter.config.WE_shutterDownLiving;
                debugCnt = 3;
            } else if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr === true && adapter.config.schoolfreeLivingArea == true) || (publicHolidayTomorowStr) === true || (schoolfreeTomorowStr === true && adapter.config.schoolfreeLivingArea == true)) && IsLater(adapter.config.WE_shutterDownLiving, astroTimeLivingDown)) {
                downTimeLiving = astroTimeLivingDown;
                debugCnt = 4;
            } else if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr === true && adapter.config.schoolfreeLivingArea == true) || (publicHolidayTomorowStr) === true || (schoolfreeTomorowStr === true && adapter.config.schoolfreeLivingArea == true)) && IsEqual(adapter.config.WE_shutterDownLiving, astroTimeLivingDown)) {
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
            if (dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr === true && adapter.config.schoolfreeChildrenArea == true) || (publicHolidayTomorowStr) === true || (schoolfreeTomorowStr === true && adapter.config.schoolfreeChildrenArea == true)) {
                downTimeChildren = adapter.config.WE_shutterDownChildren;
                debugCnt = 1;
            } else {
                downTimeChildren = adapter.config.W_shutterDownChildren;
                debugCnt = 2;
            }
            break;
        default:
            if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr === true && adapter.config.schoolfreeChildrenArea == true) || (publicHolidayTomorowStr) === true || (schoolfreeTomorowStr === true && adapter.config.schoolfreeChildrenArea == true)) && (adapter.config.WE_shutterDownChildren) < (astroTimeChildrenDown)) {
                downTimeChildren = adapter.config.WE_shutterDownChildren;
                debugCnt = 3;
            } else if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr === true && adapter.config.schoolfreeChildrenArea == true) || (publicHolidayTomorowStr || (schoolfreeTomorowStr === true && adapter.config.schoolfreeChildrenArea == true)) === true) && (adapter.config.WE_shutterDownChildren) > (astroTimeChildrenDown)) {
                downTimeChildren = astroTimeChildrenDown;
                debugCnt = 4;
            } else if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr === true && adapter.config.schoolfreeChildrenArea == true) || (publicHolidayTomorowStr || (schoolfreeTomorowStr === true && adapter.config.schoolfreeChildrenArea == true)) === true) && (adapter.config.WE_shutterDownChildren) == (astroTimeChildrenDown)) {
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
            if (dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr === true && adapter.config.schoolfreeSleepArea == true) || (publicHolidayTomorowStr) === true || (schoolfreeTomorowStr === true && adapter.config.schoolfreeSleepArea == true)) {
                downTimeSleep = adapter.config.WE_shutterDownSleep;
                debugCnt = 1;
            } else {
                downTimeSleep = adapter.config.W_shutterDownSleep;
                debugCnt = 2;
            }
            break;
        default:
            if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr === true && adapter.config.schoolfreeSleepArea == true) || (publicHolidayTomorowStr) === true || (schoolfreeTomorowStr === true && adapter.config.schoolfreeSleepArea == true)) && (adapter.config.WE_shutterDownSleep) < (astroTimeSleepDown)) {
                downTimeSleep = adapter.config.WE_shutterDownSleep;
                debugCnt = 3;
            } else if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr === true && adapter.config.schoolfreeSleepArea == true) || (publicHolidayTomorowStr) === true || (schoolfreeTomorowStr === true && adapter.config.schoolfreeSleepArea == true)) && (adapter.config.WE_shutterDownSleep) > (astroTimeSleepDown)) {
                downTimeSleep = astroTimeSleepDown;
                debugCnt = 4;
            } else if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (SchoolfreeStr === true && adapter.config.schoolfreeSleepArea == true) || (publicHolidayTomorowStr) === true || (schoolfreeTomorowStr === true && adapter.config.schoolfreeSleepArea == true)) && (adapter.config.WE_shutterDownSleep) == (astroTimeSleepDown)) {
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

// +++++++++++++++++ create states for all new shutter in the config +++++++++++++++++++

async function createShutter() {
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
                    await adapter.setObjectNotExistsAsync('shutters.autoUp.' + objectName, {
                        "type": "state",
                        "common": {
                            "role": "switch",
                            "name": result[i].shutterName,
                            "type": "boolean",
                            "read": true,
                            "write": true
                        },
                        "native": {},
                    });

                    const _autoUpState = await adapter.getStateAsync('shutters.autoUp.' + objectName).catch((e) => adapter.log.warn(e));
                    if (!_autoUpState) {
                        await adapter.setStateAsync('shutters.autoUp.' + objectName, { val: true, ack: true })
                            .catch((e) => adapter.log.warn(e));
                        adapter.log.debug('Create Object: shutters.autoUp.' + objectName);
                    }

                    // Create Object for auto down
                    await adapter.setObjectNotExistsAsync('shutters.autoDown.' + objectName, {
                        "type": "state",
                        "common": {
                            "role": "switch",
                            "name": result[i].shutterName,
                            "type": "boolean",
                            "read": true,
                            "write": true
                        },
                        "native": {},
                    });

                    const _autoDownState = await adapter.getStateAsync('shutters.autoDown.' + objectName).catch((e) => adapter.log.warn(e));
                    if (!_autoDownState) {
                        await adapter.setStateAsync('shutters.autoDown.' + objectName, { val: true, ack: true })
                            .catch((e) => adapter.log.warn(e));
                        adapter.log.debug('Create Object: shutters.autoDown.' + objectName);
                    }

                    // Create Object for auto sun
                    await adapter.setObjectNotExistsAsync('shutters.autoSun.' + objectName, {
                        "type": "state",
                        "common": {
                            "role": "switch",
                            "name": result[i].shutterName,
                            "type": "boolean",
                            "read": true,
                            "write": true
                        },
                        "native": {},
                    });

                    const _autoSunState = await adapter.getStateAsync('shutters.autoSun.' + objectName).catch((e) => adapter.log.warn(e));
                    if (!_autoSunState) {
                        await adapter.setStateAsync('shutters.autoSun.' + objectName, { val: true, ack: true })
                            .catch((e) => adapter.log.warn(e));
                        adapter.log.debug('Create Object: shutters.autoSun.' + objectName);
                    }

                    // Create Object for auto state
                    await adapter.setObjectNotExistsAsync('shutters.autoState.' + objectName, {
                        "type": "state",
                        "common": {
                            "role": "text",
                            "name": result[i].shutterName,
                            "type": "string",
                            "read": true,
                            "write": false
                        },
                        "native": {},
                    });

                    const _autoState = await adapter.getStateAsync('shutters.autoState.' + objectName).catch((e) => adapter.log.warn(e));
                    if (!_autoState) {
                        await adapter.setStateAsync('shutters.autoState.' + objectName, { val: 'none', ack: true })
                            .catch((e) => adapter.log.warn(e));
                        adapter.log.debug('Create Object: shutters.autoState.' + objectName);
                    }

                    // Create Object for auto level
                    await adapter.setObjectNotExistsAsync('shutters.autoLevel.' + objectName, {
                        "type": "state",
                        "common": {
                            "role": "value",
                            "name": result[i].shutterName,
                            "type": "number",
                            "unit": "%",
                            "read": true,
                            "write": false
                        },
                        "native": {},
                    });

                    const _autoLevel = await adapter.getStateAsync('shutters.autoLevel.' + objectName).catch((e) => adapter.log.warn(e));
                    if (!_autoLevel) {
                        adapter.log.debug('Create Object: shutters.autoLevel.' + objectName);
                        await adapter.setStateAsync('shutters.autoLevel.' + objectName, { val: result[i].currentHeight ? parseFloat(result[i].currentHeight) : 0, ack: true })
                            .catch((e) => adapter.log.warn(e));
                    }
                } catch (e) {
                    adapter.log.warn('shutter cannot created ... Please check your shutter config: ' + e);
                }
            } else {
                adapter.log.warn('shutter cannot created ... Please check in your config the shutter Name');
            }
        }
        detectedOldShutter(result);
    }
}


// +++++++++++++++++++++ delete all states of deleting shutter ++++++++++++++++++

function deleteShutter(fullRes, resultID, resID) {
    if (fullRes.indexOf(resultID) === -1) {
        adapter.log.info('DELETE: ' + resID);
        try {
            adapter.delObject(resID, function (err) {
                if (err) {
                    adapter.log.warn(err);
                }
            });
        } catch (e) {
            adapter.log.warn(`shutter cannot deleted: ${e}`);
        }
    }
}

// +++++++++++++++++++++ detected all states of deleting shutter ++++++++++++++++++

async function detectedOldShutter(result) {
    if (result) {

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
            if (fullRes.indexOf(resultID) === -1) {
                await sleep(1000);
                deleteShutter(fullRes, resultID, resID);
            }
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
            if (fullRes.indexOf(resultID) === -1) {
                await sleep(1000);
                deleteShutter(fullRes, resultID, resID);
            }
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
            if (fullRes.indexOf(resultID) === -1) {
                await sleep(1000);
                deleteShutter(fullRes, resultID, resID);
            }
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
            if (fullRes.indexOf(resultID) === -1) {
                await sleep(1000);
                deleteShutter(fullRes, resultID, resID);
            }
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
            if (fullRes.indexOf(resultID) === -1) {
                await sleep(1000);
                deleteShutter(fullRes, resultID, resID);
            }
        }
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

async function sleep(ms) {
    return new Promise(async (resolve) => {
        // @ts-ignore
        timerSleep = setTimeout(async () => resolve(), ms);
    });
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
                lastLigthSensorValue[`${rescurrentLight[i].lightSensor}`] = { "ts": 0 };
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