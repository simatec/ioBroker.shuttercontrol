/* jshint -W097 */
/* jshint strict: false */
/*jslint node: true */
'use strict';

const utils = require('@iobroker/adapter-core');
const schedule = require('node-schedule');
const SunCalc = require('suncalc2');

const sunProtect = require('./lib/sunProtect.js');                      // SunProtect
const triggerChange = require('./lib/triggerChange.js');                // triggerChange
const elevationDown = require('./lib/elevationDown.js');                // elevationDown
const shutterGoldenHour = require('./lib/shutterGoldenHour.js');        // shutterGoldenHour
const shutterUpLiving = require('./lib/shutterUpLiving.js');            // shutterUpLiving
const shutterSunriseSunset = require('./lib/shutterSunriseSunset.js');  // shutterSunriseSunset
const shutterDownLiving = require('./lib/shutterDownLiving.js');        // shutterDownLiving
const shutterUpSleep = require('./lib/shutterUpSleep.js');              // shutterUpSleep
const shutterDownLate = require('./lib/shutterDownLate.js');            // shutterDownLate
const shutterDownSleep = require('./lib/shutterDownSleep.js');          // shutterDownSleep
const buttonAction = require('./lib/buttonAction.js');                  // buttonAction

/**
 * The adapter instance
 * @type {ioBroker.Adapter}
 */
let adapter;
const adapterName = require('./package.json').name.split('.').pop();


/** @type {boolean} */
let autoLivingStr;
/** @type {boolean} */
let autoSleepStr;
/** @type {number | undefined} */
let delayUp;
/** @type {number | undefined} */
let delayDown;
/** @type {string} */
let astroTimeLivingUp;
/** @type {string} */
let astroTimeLivingDown;
/** @type {string} */
let astroTimeSleepUp;
/** @type {string} */
let astroTimeSleepDown;
/** @type {any[]} */
let resTrigger = [];
/** @type {any[]} */
let resSunInsideTemp = [];
/** @type {any[]} */
let resSunOutsideTemp = [];
/** @type {any[]} */
let resSunLight = [];
/** @type {any} */
let resTriggerChange;
let resShutterChange;
/** @type {any[]} */
let ObjautoUp = [];
/** @type {any[]} */
let ObjautoDown = [];
/** @type {any[]} */
let ObjautoSun = [];
/** @type {any[]} */
let ObjautoState = [];
/** @type {any[]} */
let ObjautoLevel = [];
/** @type {any[]} */
let resShutterState = [];
/** @type {number | undefined} */
let timer;

/**
 * +++++++++++++++++++++++++++ Starts the adapter instance ++++++++++++++++++++++++++++++++
 * 
 * @param {Partial<ioBroker.AdapterOptions>} [options]
 */
function startAdapter(options) {

    options = options || {};
    Object.assign(options, { name: adapterName });

    adapter = new utils.Adapter(options);

    // start here!
    adapter.on('ready', () => main(adapter));

    // +++++++++++++++++++++++++ is called when adapter shuts down +++++++++++++++++++++++++
    /**
     * @param {() => void} callback
     */
    adapter.on('unload', (callback) => {
        try {
            adapter.log.info('cleaned everything up...');
            clearTimeout(timer);
            schedule.cancelJob('shutterUpGoldenHourEnd');
            schedule.cancelJob('calcTimer');
            schedule.cancelJob('shutterDownGoldenHour');
            schedule.cancelJob('shutterUpSunrise');
            schedule.cancelJob('shutterDownSunset');
            schedule.cancelJob('shutterUpLiving');
            schedule.cancelJob('shutterDownLiving');
            schedule.cancelJob('shutterUpSleep');
            schedule.cancelJob('shutterDownLate');
            schedule.cancelJob('shutterDownSleep');
            schedule.cancelJob('calcPosTimer');
            callback();
        } catch (e) {
            callback(e);
        }
    });
    // ++++++++++++++++++ is called if a subscribed state changes ++++++++++++++++++
    /**
     * @param {string} id
     * @param {{ val: string; ts: any; lc: any; }} state
     */
    adapter.on('stateChange', (id, state) => {
        if (state) {
            if (adapter.config.HolidayDP !== '') {
                if (id.includes(adapter.config.HolidayDP)) {
                    adapter.log.debug('HolidayDP changed to ' + JSON.stringify(state.val));
                    adapter.setState('control.Holiday', { val: state.val, ack: true });
                }
            }
            if (id === adapter.namespace + '.control.Holiday') {
                HolidayStr = state.val;
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
            if (id === adapter.config.triggerAutoLiving) {
                adapter.setState('control.autoLiving', { val: state.val, ack: true });
                adapter.log.debug('Auto Living is: ' + state.val);
            }
            if (id === adapter.config.triggerAutoSleep) {
                adapter.setState('control.autoSleep', { val: state.val, ack: true });
                adapter.log.debug('Auto Sleep is: ' + state.val);
            }
            resTrigger.forEach(function (resultTriggerID) {
                if (id === resultTriggerID && state.ts === state.lc) {
                    resTriggerChange = resultTriggerID;
                    adapter.log.debug('TriggerID changed: ' + resultTriggerID + ' Value: ' + state.val);
                    triggerChange(resTriggerChange, adapter);
                }
            });
            resSunInsideTemp.forEach(function (resSunInsideTempID) {
                if (id === resSunInsideTempID && state.ts === state.lc) {
                    adapter.log.debug('insidetemperature changed: ' + resSunInsideTempID + ' Value: ' + state.val);
                    sunProtect(adapter, elevation, azimuth);
                }
            });
            resSunOutsideTemp.forEach(function (resSunOutsideTempID) {
                if (id === resSunOutsideTempID && state.ts === state.lc) {
                    adapter.log.debug('outsidetemperature changed: ' + resSunOutsideTempID + ' Value: ' + state.val);
                    sunProtect(adapter, elevation, azimuth);
                }
            });
            resSunLight.forEach(function (resSunLightID) {
                if (id === resSunLightID && state.ts === state.lc) {
                    adapter.log.debug('Lightsensor changed: ' + resSunLightID + ' Value: ' + state.val);
                    sunProtect(adapter, elevation, azimuth);
                }
            });
            resShutterState.forEach(function (resShutterID) {
                if (id === resShutterID && state.ts === state.lc) {
                    resShutterChange = resShutterID;
                    const resultID = adapter.config.events;
                    const result = resultID.filter(d => d.name == resShutterID);
                    for (const i in result) {
                        let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                        adapter.getForeignState(result[i].name, (err, state) => {
                            if (typeof state != undefined && state != null) {
                                adapter.log.debug('Shutter state changed: ' + result[i].shutterName + ' old value = ' + result[i].oldHeight + ' new value = ' + state.val);
                            }
                            if (typeof state != undefined && state != null && state.val != result[i].currentHeight) {
                                adapter.setState('shutters.autoState.' + nameDevice, { val: 'Manu_Mode', ack: true });
                                adapter.log.debug(result[i].shutterName + ' drived manually to 100%. Old value = ' + result[i].oldHeight + '. New value = ' + state.val + '. Possibility to activate sunprotect enabled.');
                            } else if (typeof state != undefined && state != null && state.val == result[i].currentHeight) {
                                adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                adapter.log.debug(result[i].shutterName + ' Old value = ' + result[i].oldHeight + '. New value = ' + state.val + '. automatic is active');
                            }
                        });
                        //Shutter is closed -> opened manually to 100% before it has been opened automatically -> 
                        // enable possibility to activate sunprotect height if required --> 
                        // if sunprotect is required: shutter is set to sunProtect height
                        if (result[i].firstCompleteUp == true && state.val == 100 && result[i].currentAction != 'up') {
                            result[i].currentHeight = state.val;
                            result[i].currentAction = 'none'; //reset mode. e.g. mode can be set to sunProtect later.
                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                            result[i].firstCompleteUp = false;
                            adapter.log.debug(result[i].shutterName + ' opened manually to 100%. Old value = ' + result[i].oldHeight + '. New value = ' + state.val + '. Possibility to activate sunprotect enabled.');
                        }
                        if (result[i].firstCompleteUp == true && (state.val == 100 || state.val == result[i].heightUp || state.val == result[i].heightDownSun)) {
                            result[i].firstCompleteUp = false; //reset firstCompleteUp if shutter has been moved up
                        }
                        //save old height
                        setTimeout(function () {
                            result[i].oldHeight = state.val;    //set old Height after 60 Sek - after 60 Sek end position should be reached
                        }, 60000);
                    }
                }
            });
            if (id === adapter.namespace + '.info.Azimut') {
                sunProtect(adapter, elevation, azimuth);
            }
            if (id === adapter.namespace + '.info.Elevation') {
                elevationDown(adapter, elevation, azimuth);
            }
            if (id === adapter.namespace + '.control.closeAll') {
                let buttonState = 'closeAll';
                buttonAction(adapter, buttonState);
            }
            if (id === adapter.namespace + '.control.openAll') {
                let buttonState = 'openAll';
                buttonAction(adapter, buttonState);
            }
            if (id === adapter.namespace + '.control.closeLiving') {
                let buttonState = 'closeLiving';
                buttonAction(adapter, buttonState);
            }
            if (id === adapter.namespace + '.control.openLiving') {
                let buttonState = 'openLiving';
                buttonAction(adapter, buttonState);
            }
            if (id === adapter.namespace + '.control.closeSleep') {
                let buttonState = 'closeSleep';
                buttonAction(adapter, buttonState);
            }
            if (id === adapter.namespace + '.control.openSleep') {
                let buttonState = 'openSleep';
                buttonAction(adapter, buttonState);
            }
            if (id === adapter.namespace + '.control.sunProtect') {
                let buttonState = 'sunProtect';
                buttonAction(adapter, buttonState);
            }
        }
    });
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// +++++++++++++++++ Check States of Trigger after start ++++++++++++++++++++++++++++
function checkStates() {
    /**
     * @param {any} err
     * @param {{ val: null; } | null} state
     */
    adapter.getState('control.Holiday', (err, state) => {
        if ((state && state === null) || (state && state.val === null)) {
            adapter.setState('control.Holiday', { val: false, ack: true });
        }
    });
    /**
     * @param {any} err
     * @param {{ val: null; } | null} state
     */
    adapter.getState('control.autoLiving', (err, state) => {
        if ((state && state === null) || (state && state.val === null)) {
            adapter.setState('control.autoLiving', { val: false, ack: true });
        }
    });
    /**
     * @param {any} err
     * @param {{ val: null; } | null} state
     */
    adapter.getState('control.autoSleep', (err, state) => {
        if ((state && state === null) || (state && state.val === null)) {
            adapter.setState('control.autoSleep', { val: false, ack: true });
        }
    });
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// +++++++++++++++++++ check all current States an changes +++++++++++++++++++++++++

function checkActualStates() {
    /**
     * @param {any} err
     * @param {{ val: any; }} state
     */
    adapter.getState('control.Holiday', (err, state) => {
        if (state) {
            HolidayStr = state.val;
        }
    });
    /**
     * @param {any} err
     * @param {{ val: any; }} state
     */
    adapter.getState('control.autoLiving', (err, state) => {
        if (state) {
            autoLivingStr = state.val;
        }
    });
    /**
     * @param {any} err
     * @param {{ val: any; }} state
     */
    adapter.getState('control.autoSleep', (err, state) => {
        if (state) {
            autoSleepStr = state.val;
        }
    });
    if (adapter.config.publicHolidays === true && (adapter.config.publicHolInstance != 'none' || adapter.config.publicHolInstance != '')) {
        /**
         * @param {any} err
         * @param {{ val: any; }} state
         */
        adapter.getForeignState(adapter.config.publicHolInstance + '.heute.boolean', (err, state) => {
            if (typeof state != undefined && state != null) {
                publicHolidayStr = state.val;
            }
        });
        /**
         * @param {any} err
         * @param {{ val: any; }} state
         */
        adapter.getForeignState(adapter.config.publicHolInstance + '.morgen.boolean', (err, state) => {
            if (typeof state != undefined && state != null) {
                publicHolidayTomorowStr = state.val;
            }
        });
    }
    if (adapter.config.HolidayDP !== '') {
        adapter.log.debug('checking HolidayDP');
        adapter.getForeignState(adapter.config.HolidayDP, (err, state) => {
            if (err) {
                adapter.log.error('error check HolidayDP' + err);
            }
            else if (typeof state != undefined && state != null) {
                adapter.log.debug('got HolidayDP ' + JSON.stringify(state.val));
                adapter.setState('.control.Holiday', { val: state.val, ack: true });
            }
        });
    }
    adapter.getForeignObjects(adapter.namespace + ".shutters.autoUp.*", 'state', /**
         * @param {any} err
         * @param {any[]} list
         */
        function (err, list) {
            if (err) {
                adapter.log.error(err);
            } else {
                ObjautoUp = list;
            }
        });
    adapter.getForeignObjects(adapter.namespace + ".shutters.autoDown.*", 'state', /**
         * @param {any} err
         * @param {any[]} list
         */
        function (err, list) {
            if (err) {
                adapter.log.error(err);
            } else {
                ObjautoDown = list;
            }
        });
    adapter.getForeignObjects(adapter.namespace + ".shutters.autoSun.*", 'state', /**
         * @param {any} err
         * @param {any[]} list
         */
        function (err, list) {
            if (err) {
                adapter.log.error(err);
            } else {
                ObjautoSun = list;
            }
        });
    adapter.getForeignObjects(adapter.namespace + ".shutters.autoState.*", 'state', /**
        * @param {any} err
        * @param {any[]} list
        */
        function (err, list) {
            if (err) {
                adapter.log.error(err);
            } else {
                ObjautoState = list;
            }
        });
    adapter.getForeignObjects(adapter.namespace + ".shutters.autoLevel.*", 'state', /**
        * @param {any} err
        * @param {any[]} list
        */
        function (err, list) {
            if (err) {
                adapter.log.error(err);
            } else {
                ObjautoLevel = list;
            }
        });
    setTimeout(function () {
        shutterDriveCalc();
        createShutter();
    }, 1000);
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ++++++++++++++++++ reset current Action in the night at 02:30 +++++++++++++++++++++++

const calc = schedule.scheduleJob('calcTimer', '30 2 * * *', function () {
    shutterDriveCalc();
    //Reset currentAction in the night
    const resultStates = adapter.config.events;
    if (resultStates) {
        for (const i in resultStates) {
            let nameDevice = resultStates[i].shutterName.replace(/[.;, ]/g, '_');

            adapter.getForeignState(resultStates[i].name, (err, state) => {
                if (typeof state != undefined && state != null) {
                    //Case: Shutter in sunProtect mode. Auto-down in the evening before end of sunProtect. 
                    //The sun is sill shining. Prevent that the shutter opens again with end of sunProtect. 
                    //currentAction=sunprotect would be set in sunProtect(). But not if currentAction=down. 
                    //So this is checked in sunProtect(). Reset here to enable possibility to set sunProtect in the morning ->
                    resultStates[i].currentAction = 'none';
                    adapter.setState('shutters.autoState.' + nameDevice, { val: resultStates[i].currentAction, ack: true });
                    resultStates[i].firstCompleteUp = true;

                    adapter.log.debug(resultStates[i].shutterName + " set currentHeight to" + state.val);
                    if (typeof state.val != undefined && state.val != null) {
                        resultStates[i].currentHeight = state.val;
                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: resultStates[i].currentHeight, ack: true });
                    
                        if (parseFloat(resultStates[i].heightDown) < parseFloat(resultStates[i].heightUp)) {
                            adapter.log.debug(resultStates[i].shutterName + ' level conversion is disabled ...');
                        } else if (parseFloat(resultStates[i].heightDown) > parseFloat(resultStates[i].heightUp)) {
                        adapter.log.debug(resultStates[i].shutterName + ' level conversion is enabled');
                        }
                    }


                }
            });
        }
    }
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// +++++++++++++++++ Get longitude an latidude from system config ++++++++++++++++++++

function GetSystemData() {
    //get longitude/latitude from system if not set or not valid
    //do not change if we have already a valid value
    //so we could use different settings compared to system if necessary
    if (typeof adapter.config.longitude == undefined || adapter.config.longitude == null || adapter.config.longitude.length == 0 || isNaN(adapter.config.longitude)
        || typeof adapter.config.latitude == undefined || adapter.config.latitude == null || adapter.config.latitude.length == 0 || isNaN(adapter.config.latitude)) {

        adapter.log.debug("longitude/longitude not set, get data from system " + typeof adapter.config.longitude + " " + adapter.config.longitude + "/" + typeof adapter.config.latitude + " " + adapter.config.latitude);

        adapter.getForeignObject("system.config", (err, state) => {

            if (err) {
                adapter.log.error(err);
            } else {
                adapter.config.longitude = state.common.longitude;
                adapter.config.latitude = state.common.latitude;
                adapter.log.info("system  longitude " + adapter.config.longitude + " latitude " + adapter.config.latitude);
            }
        });
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// +++++++++++++++ calc the shutter time for all function ++++++++++++++++++

/** @type {string} */
let sunsetStr;
/** @type {string} */
let sunriseStr;
/** @type {string} */
let goldenHour;
/** @type {string} */
let goldenHourEnd;
/** @type {string} */
let upTimeSleep;
/** @type {string} */
let upTimeLiving;
/** @type {string} */
let downTimeSleep;
/** @type {string} */
let downTimeLiving;
/** @type {string | number} */
let dayStr;
/** @type {any} */
let HolidayStr;
/** @type {any} */
let publicHolidayStr;
/** @type {any} */
let publicHolidayTomorowStr;


function shutterDriveCalc() {
    adapter.log.debug('shutterDriveCalc');

    // get today's sunlight times 
    let times;
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

    addMinutesSunrise(sunriseStr, adapter.config.astroDelayUp); // Add Delay for Sunrise
    addMinutesSunset(sunsetStr, adapter.config.astroDelayDown); // Add Delay for Sunset
    addMinutesGoldenHour(goldenHour, adapter.config.astroDelayDown); // Add Delay for GoldenHour
    addMinutesGoldenHourEnd(goldenHourEnd, adapter.config.astroDelayUp); // Add Delay for GoldenHourEnd

    adapter.log.debug('Starting up shutters GoldenHour area: ' + goldenHourEnd);
    adapter.log.debug('Shutdown shutters GoldenHour area: ' + goldenHour);
    adapter.log.debug('Starting up shutters Sunrise area: ' + sunriseStr);
    adapter.log.debug('Shutdown shutters Sunset area: ' + sunsetStr);

    shutterGoldenHour(adapter, goldenHourEnd, goldenHour);
    shutterSunriseSunset(adapter, sunriseStr, sunsetStr);

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
    let debugCnt = 0;
    // ******** Set Up-Time Living Area ********
    switch (adapter.config.livingAutomatic) {
        case 'livingTime':
            if (dayStr === 6 || dayStr === 0 || (HolidayStr) === true || (publicHolidayStr) === true) {
                upTimeLiving = adapter.config.WE_shutterUpLivingMax;
                debugCnt = 1;
            } else {
                upTimeLiving = adapter.config.W_shutterUpLivingMax;
                debugCnt = 2;
            }
            break;
        default:
            if (dayStr === 6 || dayStr === 0 || (HolidayStr) === true || (publicHolidayStr) === true) {

                if (IsLater(astroTimeLivingUp, adapter.config.WE_shutterUpLivingMax)) {
                    upTimeLiving = adapter.config.W_shutterUpLivingMax;
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
    shutterUpLiving(adapter, upTimeLiving, autoLivingStr);

    // ******** Set Up-Time Sleep Area ********

    switch (adapter.config.sleepAutomatic) {
        case 'sleepTime':
            if (dayStr === 6 || dayStr === 0 || (HolidayStr) === true || (publicHolidayStr) === true) {
                upTimeSleep = adapter.config.WE_shutterUpSleepMax;
                debugCnt = 1;
            } else {
                upTimeSleep = adapter.config.W_shutterUpSleepMax;
                debugCnt = 2;
            }
            break;
        default:
            if (dayStr === 6 || dayStr === 0 || (HolidayStr) === true || (publicHolidayStr) === true) {

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
    shutterUpSleep(adapter, upTimeSleep, delayUp, autoSleepStr)

    // ******** Set Down-Time Living Area ********
    switch (adapter.config.livingAutomatic) {
        case 'livingTime':
            if (dayStr === 6 || dayStr === 0 || (HolidayStr) === true || (publicHolidayStr) === true) {
                downTimeLiving = adapter.config.WE_shutterDownLiving;
                debugCnt = 1;
            } else {
                downTimeLiving = adapter.config.W_shutterDownLiving;
                debugCnt = 2;
            }
            break;
        default:
            if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (publicHolidayTomorowStr) === true) && IsEarlier(adapter.config.WE_shutterDownLiving, astroTimeLivingDown)) {
                downTimeLiving = adapter.config.WE_shutterDownLiving;
                debugCnt = 3;
            } else if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (publicHolidayTomorowStr) === true) && IsLater(adapter.config.WE_shutterDownLiving, astroTimeLivingDown)) {
                downTimeLiving = astroTimeLivingDown;
                debugCnt = 4;
            } else if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (publicHolidayTomorowStr) === true) && IsEqual(adapter.config.WE_shutterDownLiving, astroTimeLivingDown)) {
                downTimeLiving = astroTimeLivingDown;
                debugCnt = 5;

                //< 5 ist doch auch 0??
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
    shutterDownLiving(adapter, downTimeLiving, autoLivingStr);

    // ******** Set Down-Time Sleep Area ******** 
    switch (adapter.config.sleepAutomatic) {
        case 'sleepTime':
            if (dayStr === 6 || dayStr === 0 || (HolidayStr) === true || (publicHolidayStr) === true) {
                downTimeSleep = adapter.config.WE_shutterDownSleep;
                debugCnt = 1;
            } else {
                downTimeSleep = adapter.config.W_shutterDownSleep;
                debugCnt = 2;
            }
            break;
        default:
            if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (publicHolidayTomorowStr) === true) && (adapter.config.WE_shutterDownSleep) < (astroTimeSleepDown)) {
                downTimeSleep = adapter.config.WE_shutterDownSleep;
                debugCnt = 3;
            } else if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (publicHolidayTomorowStr) === true) && (adapter.config.WE_shutterDownSleep) > (astroTimeSleepDown)) {
                downTimeSleep = astroTimeSleepDown;
                debugCnt = 4;
            } else if ((dayStr === 5 || dayStr === 6 || (HolidayStr) === true || (publicHolidayTomorowStr) === true) && (adapter.config.WE_shutterDownSleep) == (astroTimeSleepDown)) {
                downTimeSleep = astroTimeSleepDown;
                debugCnt = 5;

                //< 5 ist doch auch 0??
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
    shutterDownSleep(adapter, downTimeSleep, delayDown, autoSleepStr);
    shutterDownLate(adapter, delayDown);
    delayCalc();
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ++++++++++++++++++ Calc current Sun position all 5 Min ++++++++++++++++++++++

/** @type {string | number} */
let azimuth;
/** @type {number} */
let elevation;

function sunPos() {
    let currentPos;
    try {
        currentPos = SunCalc.getPosition(new Date(), adapter.config.latitude, adapter.config.longitude);
        adapter.log.debug('calculate astrodata ...');
    } catch (e) {
        adapter.log.error('cannot calculate astrodata ... please check your config for latitude und longitude!!');
    }
    // get sunrise azimuth in degrees
    let currentAzimuth = currentPos.azimuth * 180 / Math.PI + 180;

    // get sunrise altitude in degrees
    let currentAltitude = currentPos.altitude * 180 / Math.PI;

    azimuth = Math.round(10 * currentAzimuth) / 10;
    elevation = Math.round(10 * currentAltitude) / 10;

    adapter.log.debug('Sun Azimut: ' + azimuth + '°');
    adapter.setState('info.Azimut', { val: azimuth, ack: true });
    adapter.log.debug('Sun Elevation: ' + elevation + '°');
    adapter.setState('info.Elevation', { val: elevation, ack: true });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ++++++++++++++++++++ Add delay Time for Sunrise ++++++++++++++++++++++++
/**
 * @param {string} time
 * @param {string | number} minsToAdd
 */
function addMinutesSunrise(time, minsToAdd) {
    /**
     * @param {number} J
     */
    function D(J) { return (J < 10 ? '0' : '') + J; }
    const piece = time.split(':');
    const mins = piece[0] * 60 + +piece[1] + +minsToAdd;
    sunriseStr = (D(mins % (24 * 60) / 60 | 0) + ':' + D(mins % 60));
    return D(mins % (24 * 60) / 60 | 0) + ':' + D(mins % 60);
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// +++++++++++++++++++++ Add delay Time for Sunset ++++++++++++++++++++++++++
/**
 * @param {string} time
 * @param {string | number} minsToAdd
 */
function addMinutesSunset(time, minsToAdd) {
    /**
     * @param {number} J
     */
    function D(J) { return (J < 10 ? '0' : '') + J; }
    const piece = time.split(':');
    const mins = piece[0] * 60 + +piece[1] + +minsToAdd;
    sunsetStr = (D(mins % (24 * 60) / 60 | 0) + ':' + D(mins % 60));
    return D(mins % (24 * 60) / 60 | 0) + ':' + D(mins % 60);
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// +++++++++++++++++++++ Add delay Time for GoldenHour +++++++++++++++++++++++
/**
 * @param {string} time
 * @param {string | number} minsToAdd
 */
function addMinutesGoldenHour(time, minsToAdd) {
    /**
     * @param {number} J
     */
    function D(J) { return (J < 10 ? '0' : '') + J; }
    const piece = time.split(':');
    const mins = piece[0] * 60 + +piece[1] + +minsToAdd;
    goldenHour = (D(mins % (24 * 60) / 60 | 0) + ':' + D(mins % 60));
    return D(mins % (24 * 60) / 60 | 0) + ':' + D(mins % 60);
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ++++++++++++++++++ Add delay Time for GoldenHour +++++++++++++++++++++++++++
/**
 * @param {string} time
 * @param {string | number} minsToAdd
 */
function addMinutesGoldenHourEnd(time, minsToAdd) {
    /**
     * @param {number} J
     */
    function D(J) { return (J < 10 ? '0' : '') + J; }
    const piece = time.split(':');
    const mins = piece[0] * 60 + +piece[1] + +minsToAdd;
    goldenHourEnd = (D(mins % (24 * 60) / 60 | 0) + ':' + D(mins % 60));
    return D(mins % (24 * 60) / 60 | 0) + ':' + D(mins % 60);
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// +++++++++++++++++ calc the shutter delay +++++++++++++++++++
function delayCalc() {
    delayUp = 0;
    delayDown = 0;
    // Full Result
    let resultFull = adapter.config.events;
    if (resultFull) {
        if ((upTimeLiving) === (upTimeSleep)) {

            // Filter Area Living
            let /**
                 * @param {{ typeUp: string; }} d
                 */
                resLiving = resultFull.filter(d => d.typeUp == 'living');
            // Filter enabled
            let /**
                 * @param {{ enabled: boolean; }} d
                 */
                resEnabled = resLiving.filter(d => d.enabled === true);

            let result = resEnabled;

            for (const i in result) {
                delayUp++;
            }
            if ((autoLivingStr) === true) {

                // Filter Area Living
                let /**
                     * @param {{ typeUp: string; }} d
                     */
                    resLivingAuto = resultFull.filter(d => d.typeUp == 'living-auto');
                // Filter enabled
                let /**
                     * @param {{ enabled: boolean; }} d
                     */
                    resEnabled2 = resLivingAuto.filter(d => d.enabled === true);

                let result2 = resEnabled2;

                for (const i in result2) {
                    delayUp++;
                }
            }
        }
        if ((downTimeLiving) === (downTimeSleep)) {
            // Filter Area Living
            let /**
                 * @param {{ typeDown: string; }} d
                 */
                resLiving2 = resultFull.filter(d => d.typeDown == 'living');
            // Filter enabled
            let /**
                 * @param {{ enabled: boolean; }} d
                 */
                resEnabled3 = resLiving2.filter(d => d.enabled === true);

            let result3 = resEnabled3;

            for (const i in result3) {
                delayDown++;
            }
            if ((autoLivingStr) === true) {
                // Filter Area Living
                let /**
                     * @param {{ typeDown: string; }} d
                     */
                    resLivingAuto2 = resultFull.filter(d => d.typeDown == 'living-auto');
                // Filter enabled
                let /**
                     * @param {{ enabled: boolean; }} d
                     */
                    resEnabled4 = resLivingAuto2.filter(d => d.enabled === true);

                let result4 = resEnabled4;

                for (const i in result4) {
                    delayDown++;
                }
            }
        }
    }

}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// +++++++++++++++++ create states for all new shutter in the config +++++++++++++++++++

function createShutter() {
    let result = adapter.config.events;
    if (result) {
        for (const i in result) {
            let objectName = result[i].shutterName.replace(/[.;, ]/g, '_');

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
            /**
             * @param {any} err
             * @param {{ val: null; } | null} state
             */
            adapter.getState('shutters.autoUp.' + objectName, (err, state) => {
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
            /**
             * @param {any} err
             * @param {{ val: null; } | null} state
             */
            adapter.getState('shutters.autoDown.' + objectName, (err, state) => {
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
            /**
             * @param {any} err
             * @param {{ val: null; } | null} state
             */
            adapter.getState('shutters.autoSun.' + objectName, (err, state) => {
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
            /**
             * @param {any} err
             * @param {{ val: null; } | null} state
             */
            adapter.getState('shutters.autoState.' + objectName, (err, state) => {
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
            /**
             * @param {any} err
             * @param {{ val: null; } | null} state
             */
            adapter.getState('shutters.autoLevel.' + objectName, (err, state) => {
                if ((state && state === null) || (state && state.val === null)) {
                    adapter.log.debug('Create Object: shutters.autoLevel.' + objectName);
                }
                if (state) {
                    adapter.setState('shutters.autoLevel.' + objectName, { val: result[i].currentHeight, ack: true });
                }
            });
        }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // +++++++++++++++++++++ delete all states of deleting shutter ++++++++++++++++++

    // delete old shutter auto up
    for (const i in ObjautoUp) {
        const resID = ObjautoUp[i]._id;
        const objectID = resID.split('.');
        const resultID = objectID[4];

        let resultName = result.map(({ shutterName }) => ({ shutterName }));
        /** @type {any[]} */
        let fullRes = [];

        for (const i in resultName) {
            let res = resultName[i].shutterName.replace(/[.;, ]/g, '_');
            fullRes.push(res);
        }
        setTimeout(function () {
            if (fullRes.indexOf(resultID) === -1) {
                adapter.log.warn('DELETE: ' + resID);
                adapter.delObject(resID, /**
                     * @param {any} err
                     */
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

        let resultName = result.map(({ shutterName }) => ({ shutterName }));
        /** @type {any[]} */
        let fullRes = [];

        for (const i in resultName) {
            let res = resultName[i].shutterName.replace(/[.;, ]/g, '_');
            fullRes.push(res);
        }
        setTimeout(function () {
            if (fullRes.indexOf(resultID) === -1) {
                adapter.log.warn('DELETE: ' + resID);
                adapter.delObject(resID, /**
                     * @param {any} err
                     */
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

        let resultName = result.map(({ shutterName }) => ({ shutterName }));
        /** @type {any[]} */
        let fullRes = [];

        for (const i in resultName) {
            let res = resultName[i].shutterName.replace(/[.;, ]/g, '_');
            fullRes.push(res);
        }
        setTimeout(function () {
            if (fullRes.indexOf(resultID) === -1) {
                adapter.log.warn('DELETE: ' + resID);
                adapter.delObject(resID, /**
                     * @param {any} err
                     */
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

        let resultName = result.map(({ shutterName }) => ({ shutterName }));
        /** @type {any[]} */
        let fullRes = [];

        for (const i in resultName) {
            let res = resultName[i].shutterName.replace(/[.;, ]/g, '_');
            fullRes.push(res);
        }
        setTimeout(function () {
            if (fullRes.indexOf(resultID) === -1) {
                adapter.log.warn('DELETE: ' + resID);
                adapter.delObject(resID, /**
                     * @param {any} err
                     */
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

        let resultName = result.map(({ shutterName }) => ({ shutterName }));
        /** @type {any[]} */
        let fullRes = [];

        for (const i in resultName) {
            let res = resultName[i].shutterName.replace(/[.;, ]/g, '_');
            fullRes.push(res);
        }
        setTimeout(function () {
            if (fullRes.indexOf(resultID) === -1) {
                adapter.log.warn('DELETE: ' + resID);
                adapter.delObject(resID, /**
                     * @param {any} err
                     */
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
    /**
     * @param {any} err
     * @param {any} obj
     */
    adapter.getForeignObject('system.config', (err, obj) => {
        checkStates();
    });
    timer = setTimeout(function () {
        checkActualStates();
        const calcPos = schedule.scheduleJob('calcPosTimer', '*/5 * * * *', function () {
            sunPos();
        });
    }, 2000);

    GetSystemData();

    // in this template all states changes inside are subscribed
    adapter.subscribeStates('control.*');
    adapter.subscribeStates('info.Elevation');
    adapter.subscribeStates('info.Azimut');

    if (adapter.config.publicHolidays === true && (adapter.config.publicHolInstance + '.heute.*')) {
        adapter.subscribeForeignStates(adapter.config.publicHolInstance + '.heute.*');
    }
    if (adapter.config.publicHolidays === true && (adapter.config.publicHolInstance + '.morgen.*')) {
        adapter.subscribeForeignStates(adapter.config.publicHolInstance + '.morgen.*');
    }

    if (adapter.config.HolidayDP !== '') {
        adapter.subscribeForeignStates(adapter.config.HolidayDP);
        adapter.log.info('subscribe ' + adapter.config.HolidayDP);
    }

    if (adapter.config.triggerAutoLiving != '') {
        adapter.subscribeForeignStates(adapter.config.triggerAutoLiving);
    }
    if (adapter.config.triggerAutoSleep != '') {
        adapter.subscribeForeignStates(adapter.config.triggerAutoSleep);
    }

    // Change State from Trigger ID's
    let result = adapter.config.events;

    adapter.log.debug('all shutters ' + JSON.stringify(result));

    if (result) {
        let res = result.map(({ triggerID }) => ({ triggerID }));
        let /**
             * @param {{ triggerID: string; }} d
             */
            resTriggerActive = res.filter(d => d.triggerID != '');

        for (const i in resTriggerActive) {
            if (resTrigger.indexOf(resTriggerActive[i].triggerID) === -1) {
                resTrigger.push(resTriggerActive[i].triggerID);
            }
        }
        resTrigger.forEach(function (element) {
            adapter.subscribeForeignStates(element);
            adapter.log.debug('trigger for shuttercontrol: ' + element);
        });
    }

    let resultInsideTemp = adapter.config.events;
    if (resultInsideTemp) {
        let resInsideTemp = resultInsideTemp.map(({ tempSensor }) => ({ tempSensor }));
        let /**
             * @param {{ tempSensor: string; }} d
             */
            rescurrentInsideTemp = resInsideTemp.filter(d => d.tempSensor != '');

        for (const i in rescurrentInsideTemp) {
            if (resSunInsideTemp.indexOf(rescurrentInsideTemp[i].tempSensor) === -1) {
                resSunInsideTemp.push(rescurrentInsideTemp[i].tempSensor);
            }
        }
        resSunInsideTemp.forEach(function (element) {
            adapter.subscribeForeignStates(element);
            adapter.log.debug('trigger for inside temperature: ' + element);
        });
    }

    let resultOutsideTemp = adapter.config.events;
    if (resultOutsideTemp) {
        let resOutsideTemp = resultOutsideTemp.map(({ outsideTempSensor }) => ({ outsideTempSensor }));
        let /**
             * @param {{ outsideTempSensor: string; }} d
             */
            rescurrentOutsideTemp = resOutsideTemp.filter(d => d.outsideTempSensor != '');

        for (const i in rescurrentOutsideTemp) {
            if (resSunOutsideTemp.indexOf(rescurrentOutsideTemp[i].outsideTempSensor) === -1) {
                resSunOutsideTemp.push(rescurrentOutsideTemp[i].outsideTempSensor);
            }
        }
        resSunOutsideTemp.forEach(function (element) {
            adapter.subscribeForeignStates(element);
            adapter.log.debug('trigger for outside temperature: ' + element);
        });
    }

    let resultLight = adapter.config.events;
    if (resultLight) {
        let resLight = resultLight.map(({ lightSensor }) => ({ lightSensor }));
        let /**
             * @param {{ lightSensor: string; }} d
             */
            rescurrentLight = resLight.filter(d => d.lightSensor != '');

        for (const i in rescurrentLight) {
            if (resSunLight.indexOf(rescurrentLight[i].lightSensor) === -1) {
                resSunLight.push(rescurrentLight[i].lightSensor);
            }
        }
        resSunLight.forEach(function (element) {
            adapter.subscribeForeignStates(element);
            adapter.log.debug('trigger for Light Sensor: ' + element);
        });
    }
    // trigger for shutter
    let resultShutter = adapter.config.events;
    if (resultShutter) {
        let resShutter = resultShutter.map(({ name }) => ({ name }));
        let /**
             * @param {{ name: string; }} d
             */
            rescurrentShutter = resultShutter.filter(d => d.name != '');

        for (const i in rescurrentShutter) {
            if (resShutterState.indexOf(rescurrentShutter[i].name) === -1) {
                resShutterState.push(rescurrentShutter[i].name);
            }
        }
        resShutterState.forEach(function (element) {
            adapter.subscribeForeignStates(element);
            adapter.log.debug('Shutter State: ' + element);
        });
    }
    // set current states
    const resultStates = adapter.config.events;

    if (resultStates) {
        for (const i in resultStates) {
            /**
             * @param {any} err
             * @param {{ val: any; }} state
             */
            adapter.getForeignState(resultStates[i].name, (err, state) => {
                if (typeof state != undefined && state != null) {
                    resultStates[i].currentHeight = (state.val);
                    resultStates[i].oldHeight = (state.val);
                    resultStates[i].triggerHeight = (state.val);
                    adapter.log.debug('save current height: ' + resultStates[i].currentHeight + '%' + ' from ' + resultStates[i].shutterName);
                
                    if (parseFloat(resultStates[i].heightDown) < parseFloat(resultStates[i].heightUp)) {
                        adapter.log.debug(resultStates[i].shutterName + ' level conversion is disabled ...');
                    } else if (parseFloat(resultStates[i].heightDown) > parseFloat(resultStates[i].heightUp)) {
                        adapter.log.debug(resultStates[i].shutterName + ' level conversion is enabled');
                    }
                }
            });
        }
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ++++++++++++++++++ start option of Adapter ++++++++++++++++++++++
// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}