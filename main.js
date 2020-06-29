/* jshint -W097 */
/* jshint strict: false */
/*jslint node: true */
'use strict';

const utils = require('@iobroker/adapter-core');
const schedule = require('node-schedule');
const SunCalc = require('suncalc2');

/**
 * The adapter instance
 * @type {ioBroker.Adapter}
 */
let adapter;
const adapterName = require('./package.json').name.split('.').pop();

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
let dayStr;
/** @type {any} */
let HolidayStr;
/** @type {any} */
let publicHolidayStr;
/** @type {any} */
let publicHolidayTomorowStr;
/** @type {any} */
let autoLivingStr;
/** @type {any} */
let autoSleepStr;
//let actualValueStr;
//let actualValueLightStr;
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
//let resSunTrigger = [];
/** @type {any[]} */
let resSunInsideTemp = [];
/** @type {any[]} */
let resSunOutsideTemp = [];
/** @type {any[]} */
let resSunLight = [];
/** @type {any} */
let resTriggerChange;
let resShutterChange;
//let resSunTriggerChange;

/** @type {string | number} */
let azimuth;
/** @type {number} */
let elevation;
/** @type {any[]} */
let ObjautoUp = [];
/** @type {any[]} */
let ObjautoDown = [];
/** @type {any[]} */
let ObjautoSun = [];
/** @type {any[]} */
let resShutterState = [];
/** @type {number | undefined} */
let timer;



/**
 * Starts the adapter instance
 * @param {Partial<ioBroker.AdapterOptions>} [options]
 */
function startAdapter(options) {

    options = options || {};
    Object.assign(options, { name: adapterName });

    adapter = new utils.Adapter(options);

    // start here!
    adapter.on('ready', () => main(adapter));
    //adapter.on('ready', main); // Main method defined below for readability

    // is called when adapter shuts down - callback has to be called under any circumstances!
    /**
     * @param {() => void} callback
     */
    adapter.on('unload', (callback) => {
        try {
            adapter.log.info('cleaned everything up...');
            clearTimeout(timer);
            callback();
        } catch (e) {
            callback();
        }
    });
    // is called if a subscribed state changes
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
                    triggerChange();
                }
            });

            resSunInsideTemp.forEach(function (resSunInsideTempID) {
                if (id === resSunInsideTempID && state.ts === state.lc) {
                    adapter.log.debug('insidetemperature changed: ' + resSunInsideTempID + ' Value: ' + state.val);
                    sunProtect();
                }
            });

            resSunOutsideTemp.forEach(function (resSunOutsideTempID) {
                if (id === resSunOutsideTempID && state.ts === state.lc) {
                    adapter.log.debug('outsidetemperature changed: ' + resSunOutsideTempID + ' Value: ' + state.val);
                    sunProtect();
                }
            });
            resSunLight.forEach(function (resSunLightID) {
                if (id === resSunLightID && state.ts === state.lc) {
                    adapter.log.debug('Lightsensor changed: ' + resSunLightID + ' Value: ' + state.val);
                    sunProtect();
                }
            });
            resShutterState.forEach(function (resShutterID) {
                if (id === resShutterID && state.ts === state.lc) {
                    resShutterChange = resShutterID;
                    const resultID = adapter.config.events;
                    const result = resultID.filter(d => d.name == resShutterID);
                    for (const i in result) {
                        adapter.getForeignState(result[i].name, (err, state) => {

                            if (typeof state != undefined && state != null) {
                                adapter.log.debug('Shutter state changed: ' + result[i].shutterName + ' old value = ' + result[i].oldHeight + ' new value = ' + state.val);
                                //shutterState();
                            }
                        });
                        //Shutter is closed -> opened manually to 100% before it has been opened automatically -> enable possibility to activate sunprotect height if required --> if sunprotect is required: shutter is set to sunProtect height
                        if (result[i].firstCompleteUp == true && state.val == 100 && result[i].currentAction != 'up') {
                            result[i].currentHeight = state.val;
                            result[i].currentAction = ''; //reset mode. e.g. mode can be set to sunProtect later.
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
                sunProtect();
            }

            if (id === adapter.namespace + '.info.Elevation') {
                elevationDown();
            }
        }
    });
}
/**
 * @param {any} shutterID
 */
function shutterState(shutterID) {
    if (adapter.config.currentShutterState == true) {
        const resultID = adapter.config.events;
        // Filter changed Name
        const /**
             * @param {{ name: any; }} d
             */
            result = resultID.filter(d => d.name == shutterID);
        setTimeout(function () {
            for (const i in result) {
                /**
                 * @param {any} err
                 * @param {{ val: any; }} state
                 */
                adapter.getForeignState(result[i].name, (err, state) => {
                    if (typeof state != undefined && state != null && result[i].currentHeight != state.val) {
                        result[i].currentHeight = state.val;
                        adapter.log.debug('save current height after State Check: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                    }
                });
            }
        }, 60000);
    }
}

function triggerChange() {

    const resultID = adapter.config.events;
    // Filter changed Trigger
    const /**
         * @param {{ triggerID: any; }} d
         */
        arrayChangeTrigger = resultID.filter(d => d.triggerID == resTriggerChange);

    for (const i in arrayChangeTrigger) {
        setTimeout(function () {
            if (arrayChangeTrigger[i].triggerChange == 'onlyUp' || arrayChangeTrigger[i].triggerChange == 'upDown') {
                let nameDevice = arrayChangeTrigger[i].shutterName.replace(/[.;, ]/g, '_');
                /**
                 * @param {any} err
                 * @param {boolean} state
                 */
                adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                    if (state && state === true || state && state.val === true) {
                        let currentValue = '';
                        /**
                         * @param {any} err
                         * @param {{ val: string; }} state
                         */
                        adapter.getForeignState(arrayChangeTrigger[i].triggerID, (err, state) => {
                            let mustValue = ('' + arrayChangeTrigger[i].triggerState);
                            if (typeof state != undefined && state != null) {
                                currentValue = ('' + state.val);
                            }
                            if (currentValue != mustValue) {
                                /**
                                 * @param {any} err
                                 * @param {{ val: number; }} state
                                 */
                                adapter.getForeignState(arrayChangeTrigger[i].name, (err, state) => {
                                    if (typeof state != undefined && state != null && state.val != arrayChangeTrigger[i].triggerDrive && state.val < arrayChangeTrigger[i].triggerDrive) {
                                        arrayChangeTrigger[i].triggerHeight = (state.val);
                                        adapter.log.debug('save trigger height: ' + arrayChangeTrigger[i].triggerHeight + '%');
                                        adapter.log.debug('#1 Set ID: ' + arrayChangeTrigger[i].shutterName + ' value: ' + arrayChangeTrigger[i].triggerDrive + '%');
                                        adapter.setForeignState(arrayChangeTrigger[i].name, parseFloat(arrayChangeTrigger[i].triggerDrive), false);
                                        arrayChangeTrigger[i].currentHeight = arrayChangeTrigger[i].triggerDrive;
                                        shutterState(arrayChangeTrigger[i].name);
                                    } else {
                                        arrayChangeTrigger[i].triggerHeight = (state.val);
                                        adapter.log.debug('save trigger height: ' + arrayChangeTrigger[i].triggerHeight + '%');
                                    }
                                });
                            }
                        });
                    }
                });
            }
            if (arrayChangeTrigger[i].triggerChange == 'onlyDown' || arrayChangeTrigger[i].triggerChange == 'upDown') {
                let nameDevice = arrayChangeTrigger[i].shutterName.replace(/[.;, ]/g, '_');
                /**
                 * @param {any} err
                 * @param {boolean} state
                 */
                adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                    if (state && state === true || state && state.val === true) {
                        /**
                         * @param {any} err
                         * @param {{ val: string; }} state
                         */
                        adapter.getForeignState(arrayChangeTrigger[i].triggerID, (err, state) => {

                            if (typeof state != undefined && state != null) {
                                let currentValue = ('' + state.val);
                                let mustValue = ('' + arrayChangeTrigger[i].triggerState);
                                if (currentValue === mustValue) {
                                    /**
                                     * @param {any} err
                                     * @param {{ val: any; }} state
                                     */
                                    adapter.getForeignState(arrayChangeTrigger[i].name, (err, state) => {
                                        if (typeof state != undefined && state != null && state.val != arrayChangeTrigger[i].triggerHeight && state.val == arrayChangeTrigger[i].triggerDrive && arrayChangeTrigger[i].currentHeight == arrayChangeTrigger[i].triggerDrive) {
                                            adapter.log.debug('change to last height: ' + arrayChangeTrigger[i].triggerHeight + '%');
                                            adapter.log.debug('#2 Set ID: ' + arrayChangeTrigger[i].shutterName + ' value: ' + arrayChangeTrigger[i].triggerHeight + '%');
                                            adapter.setForeignState(arrayChangeTrigger[i].name, parseFloat(arrayChangeTrigger[i].triggerHeight), false);
                                            arrayChangeTrigger[i].currentHeight = arrayChangeTrigger[i].triggerHeight;
                                            shutterState(arrayChangeTrigger[i].name);
                                        }
                                    });
                                }
                            }
                        });
                    }
                });
            }
        }, 1000 * i, i);
    }
}

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
    setTimeout(function () {
        adapter.log.debug('222');
        shutterDriveCalc();
        createShutter();
    }, 1000);
}

const calc = schedule.scheduleJob('calcTimer', '30 2 * * *', function () {
    shutterDriveCalc();
    //Reset currentAction in the night
    const resultStates = adapter.config.events;
    if (resultStates) {
        for (const i in resultStates) {
            adapter.getForeignState(resultStates[i].name, (err, state) => {
                if (typeof state != undefined && state != null) {
                    resultStates[i].currentAction = '';     //Case: Shutter in sunProtect mode. Auto-down in the evening before end of sunProtect. The sun is sill shining. Prevent that the shutter opens again with end of sunProtect. currentAction=sunprotect would be set in sunProtect(). But not if currentAction=down. So this is checked in sunProtect(). Reset here to enable possibility to set sunProtect in the morning
                    resultStates[i].firstCompleteUp = true;
					
					adapter.log.debug(resultStates[i].shutterName + " set currentHeight to" + state.val);
					//26.06.2020 and store current height to make a sunprotect possible after manuell abort of sunprotect and no further movements
					if (typeof state.val != undefined && state.val != null) {
						resultStates[i].currentHeight = state.val;
					}
					
					
                }
            });
        }
    }
});


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
                //dateformat = ret.common.dateFormat;
                adapter.config.longitude = state.common.longitude;
                adapter.config.latitude = state.common.latitude;
                adapter.log.info("system  longitude " + adapter.config.longitude + " latitude " + adapter.config.latitude);
            }
        });
    }
}


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

    shutterGoldenHour();
    shutterSunriseSunset();

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
                //upTimeLiving = adapter.config.WE_shutterUpLiving;
                //debugCnt = 3;

                //warum nicht am Wochenende auch nach Sonnaufgang?

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
    shutterUpLiving();

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
                //upTimeSleep = adapter.config.WE_shutterUpSleep;
                //debugCnt = 3;

                //warum nicht am Wochenende auch nach Sonnaufgang?

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
    shutterUpSleep();

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

            //Freitag / Samstagg

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
    shutterDownLiving();

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

            //Freitag und Samstag

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
    shutterDownSleep();


    shutterDownLate();



    delayCalc();
}
function elevationDown() {
    // Full Result
    const resultFull = adapter.config.events;

    if (resultFull) {
        const driveDelayUpAstro = adapter.config.driveDelayUpAstro * 1000;
        // Filter Area Living
        const /**
             * @param {{ typeDown: string; }} d
             */
            resLiving = resultFull.filter(d => d.typeDown == 'elevation');
        // Filter enabled
        let /**
             * @param {{ enabled: boolean; }} d
             */
            resEnabled = resLiving.filter(d => d.enabled === true);

        let result = resEnabled;

        for (const i in result) {
            let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
            /**
             * @param {any} err
             * @param {boolean} state
             */
            adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                if (state && state === true || state && state.val === true) {
                    let elevationEnd = (result[i].elevation - 1);
                    if (elevation <= result[i].elevation && elevation >= elevationEnd && result[i].currentAction != 'down' && azimuth > 180) {
                        setTimeout(function () {
                            let currentValue = '';
                            /**
                             * @param {any} err
                             * @param {{ val: string; }} state
                             */
                            adapter.getForeignState(result[i].triggerID, (err, state) => {
                                let mustValue = ('' + result[i].triggerState);
                                if (typeof state != undefined && state != null) {
                                    currentValue = ('' + state.val);
                                }
                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp' && result[i].autoDrive != 'off')) {
                                    /**
                                     * @param {any} err
                                     * @param {{ val: any; }} state
                                     */
                                    adapter.getForeignState(result[i].name, (err, state) => {
                                        if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                                            adapter.log.debug('#3 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                            result[i].currentHeight = result[i].heightDown;
                                            result[i].currentAction = 'down';
                                            adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                            shutterState(result[i].name);
                                        }
                                    });
                                } else if (result[i].triggerID == '') {
                                    /**
                                     * @param {any} err
                                     * @param {{ val: any; }} state
                                     */
                                    adapter.getForeignState(result[i].name, (err, state) => {
                                        if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                                            adapter.log.debug('#4 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                            result[i].currentHeight = result[i].heightDown;
                                            result[i].currentAction = 'down';
                                            adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                            shutterState(result[i].name);
                                        }
                                    });
                                }
                            });
                        }, driveDelayUpAstro * i, i);
                    }
                }
            });
        }
    }
    setTimeout(function () {
        if (elevation <= adapter.config.sunProtEndElevation) {
            sunProtect();
        }
    }, 120000);
}
function shutterGoldenHour() {

    const driveDelayUpAstro = adapter.config.driveDelayUpAstro * 1000;

    if (goldenHourEnd) {

        let upTime = goldenHourEnd.split(':');

        schedule.cancelJob('shutterUpGoldenHourEnd');

        const upGoldenHour = schedule.scheduleJob('shutterUpGoldenHourEnd', upTime[1] + ' ' + upTime[0] + ' * * *', function () {
            // Full Result
            const resultFull = adapter.config.events;

            if (resultFull) {
                // Filter Area Living
                const /**
                     * @param {{ typeUp: string; }} d
                     */
                    resLiving = resultFull.filter(d => d.typeUp == 'goldenhour End');
                // Filter enabled
                let /**
                     * @param {{ enabled: boolean; }} d
                     */
                    resEnabled = resLiving.filter(d => d.enabled === true);

                let result = resEnabled;

                for (const i in result) {
                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                    /**
                     * @param {any} err
                     * @param {boolean} state
                     */
                    adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {
                            setTimeout(function () {
                                let shutterHeight = 0;
                                if (result[i].currentAction == 'OpenInSunProtect') {
                                    shutterHeight = parseFloat(result[i].heightDownSun);
                                    result[i].currentAction = 'sunProtect';
                                } else {
                                    shutterHeight = parseFloat(result[i].heightUp);
                                    result[i].currentAction = 'up';
                                }
                                let currentValue = '';
                                /**
                                 * @param {any} err
                                 * @param {{ val: string; }} state
                                 */
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    let mustValue = ('' + result[i].triggerState);
                                    if (typeof state != undefined && state != null) {
                                        currentValue = ('' + state.val);
                                    }
                                    if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].autoDrive != 'off')) {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: number; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                adapter.log.debug('#5 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                                adapter.setForeignState(result[i].name, shutterHeight, false);
                                                result[i].currentHeight = shutterHeight;
                                                adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                shutterState(result[i].name);
                                            }
                                        });
                                    } else if (result[i].triggerID == '') {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: number; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                adapter.log.debug('#6 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                                adapter.setForeignState(result[i].name, shutterHeight, false);
                                                result[i].currentHeight = shutterHeight;
                                                adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                shutterState(result[i].name);
                                            }
                                        });
                                    }
                                });
                            }, driveDelayUpAstro * i, i);
                        }
                    });
                }
            }
        });
    }

    if (goldenHour) {

        let upTime = goldenHour.split(':');

        schedule.cancelJob('shutterDownGoldenHour');

        const downGoldenHour = schedule.scheduleJob('shutterDownGoldenHour', upTime[1] + ' ' + upTime[0] + ' * * *', function () {
            // Full Result
            const resultFull = adapter.config.events;

            if (resultFull) {
                // Filter Area Living
                const /**
                     * @param {{ typeDown: string; }} d
                     */
                    resLiving = resultFull.filter(d => d.typeDown == 'goldenhour');
                // Filter enabled
                let /**
                     * @param {{ enabled: boolean; }} d
                     */
                    resEnabled = resLiving.filter(d => d.enabled === true);

                let result = resEnabled;

                for (const i in result) {
                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                    /**
                     * @param {any} err
                     * @param {boolean} state
                     */
                    adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {
                            setTimeout(function () {
                                let currentValue = '';
                                /**
                                 * @param {any} err
                                 * @param {{ val: string; }} state
                                 */
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    let mustValue = ('' + result[i].triggerState);
                                    if (typeof state != undefined && state != null) {
                                        currentValue = ('' + state.val);
                                    }
                                    if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp' && result[i].autoDrive != 'off')) {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: any; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                                                adapter.log.debug('#7 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                                                adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                result[i].currentHeight = result[i].heightDown;
                                                result[i].currentAction = 'down';
                                                adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                shutterState(result[i].name);
                                            }
                                        });
                                    } else if (result[i].triggerID == '') {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: any; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                                                adapter.log.debug('#8 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                                                adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                result[i].currentHeight = result[i].heightDown;
                                                result[i].currentAction = 'down';
                                                adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                shutterState(result[i].name);
                                            }
                                        });
                                    }
                                });
                            }, driveDelayUpAstro * i, i);
                        }
                    });
                }
            }
        });
    }
}

function shutterSunriseSunset() {

    const driveDelayUpAstro = adapter.config.driveDelayUpAstro * 1000;

    if (sunriseStr) {

        let upTime = sunriseStr.split(':');

        schedule.cancelJob('shutterUpSunrise');

        const upSunrise = schedule.scheduleJob('shutterUpSunrise', upTime[1] + ' ' + upTime[0] + ' * * *', function () {
            // Full Result
            const resultFull = adapter.config.events;

            if (resultFull) {
                // Filter Area Living
                const /**
                     * @param {{ typeUp: string; }} d
                     */
                    resLiving = resultFull.filter(d => d.typeUp == 'sunrise');
                // Filter enabled
                let /**
                     * @param {{ enabled: boolean; }} d
                     */
                    resEnabled = resLiving.filter(d => d.enabled === true);

                let result = resEnabled;

                for (const i in result) {
                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                    /**
                     * @param {any} err
                     * @param {boolean} state
                     */
                    adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {
                            setTimeout(function () {
                                let shutterHeight = 0;
                                if (result[i].currentAction == 'OpenInSunProtect') {
                                    shutterHeight = parseFloat(result[i].heightDownSun);
                                    result[i].currentAction = 'sunProtect';
                                } else {
                                    shutterHeight = parseFloat(result[i].heightUp);
                                    result[i].currentAction = 'up';
                                }
                                let currentValue = '';
                                /**
                                 * @param {any} err
                                 * @param {{ val: string; }} state
                                 */
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    let mustValue = ('' + result[i].triggerState);
                                    if (typeof state != undefined && state != null) {
                                        currentValue = ('' + state.val);
                                    }
                                    if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].autoDrive != 'off')) {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: number; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                adapter.log.debug('#9 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                                adapter.setForeignState(result[i].name, shutterHeight, false);
                                                result[i].currentHeight = shutterHeight;
                                                adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                shutterState(result[i].name);
                                            }
                                        });
                                    } else if (result[i].triggerID == '') {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: number; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                adapter.log.debug('#10 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                                adapter.setForeignState(result[i].name, shutterHeight, false);
                                                result[i].currentHeight = shutterHeight;
                                                adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                shutterState(result[i].name);
                                            }
                                        });
                                    }
                                });
                            }, driveDelayUpAstro * i, i);
                        }
                    });
                }
            }
        });
    }

    if (sunsetStr) {

        const upTime = sunsetStr.split(':');

        schedule.cancelJob('shutterDownSunset');

        const downSunset = schedule.scheduleJob('shutterDownSunset', upTime[1] + ' ' + upTime[0] + ' * * *', function () {
            // Full Result
            const resultFull = adapter.config.events;

            if (resultFull) {
                // Filter Area Living
                const /**
                     * @param {{ typeDown: string; }} d
                     */
                    resLiving = resultFull.filter(d => d.typeDown == 'sunset');
                // Filter enabled
                let /**
                     * @param {{ enabled: boolean; }} d
                     */
                    resEnabled = resLiving.filter(d => d.enabled === true);

                const result = resEnabled;

                for (const i in result) {
                    const nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                    /**
                     * @param {any} err
                     * @param {boolean} state
                     */
                    adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {
                            setTimeout(function () {
                                let currentValue = '';
                                /**
                                 * @param {any} err
                                 * @param {{ val: string; }} state
                                 */
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    const mustValue = ('' + result[i].triggerState);
                                    if (typeof state != undefined && state != null) {
                                        currentValue = ('' + state.val);
                                    }
                                    if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp' && result[i].autoDrive != 'off')) {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: any; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                                                adapter.log.debug('#11 Set ID: ' + result[i].name + ' ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                                                adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                result[i].currentHeight = result[i].heightDown;
                                                result[i].currentAction = 'down';
                                                //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                shutterState(result[i].name);
                                            }
                                        });
                                    } else if (result[i].triggerID == '') {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: any; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                                                adapter.log.debug('#12 Set ID: ' + result[i].name + ' ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                                                adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                result[i].currentHeight = result[i].heightDown;
                                                result[i].currentAction = 'down';
                                                //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                shutterState(result[i].name);
                                            }
                                        });
                                    }
                                });
                            }, driveDelayUpAstro * i, i);
                        }
                    });
                }
            }
        });
    }
}

// Add delay Time for Sunrise
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
// Add delay Time for Sunset
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
// Add delay Time for GoldenHour
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
// Add delay Time for GoldenHour
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

function shutterUpLiving() {

    const driveDelayUpLiving = adapter.config.driveDelayUpLiving * 1000;

    if ((upTimeLiving) == undefined) {
        upTimeLiving = adapter.config.W_shutterUpLivingMax;
    }
    let upTime = upTimeLiving.split(':');
    /** @type {number | undefined} */
    let timeoutLivingAuto;

    schedule.cancelJob('shutterUpLiving');

    const upLiving = schedule.scheduleJob('shutterUpLiving', upTime[1] + ' ' + upTime[0] + ' * * *', function () {
        // Full Result
        const resultFull = adapter.config.events;

        if (resultFull) {
            // Filter Area Living
            const /**
                 * @param {{ typeUp: string; }} d
                 */
                resLiving = resultFull.filter(d => d.typeUp == 'living');
            // Filter enabled
            let /**
                 * @param {{ enabled: boolean; }} d
                 */
                resEnabled = resLiving.filter(d => d.enabled === true);

            let result = resEnabled;
            let number = 0;

            for (const i in result) {
                number++;
            }

            timeoutLivingAuto = number * driveDelayUpLiving;

            for (const i in result) {
                let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                /**
                 * @param {any} err
                 * @param {boolean} state
                 */
                adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                    if (state && state === true || state && state.val === true) {
                        setTimeout(function () {
                            let shutterHeight = 0;
                            if (result[i].currentAction == 'OpenInSunProtect') {
                                shutterHeight = parseFloat(result[i].heightDownSun);
                                result[i].currentAction = 'sunProtect';
                            } else {
                                shutterHeight = parseFloat(result[i].heightUp);
                                result[i].currentAction = 'up';
                            }
                            let currentValue = '';
                            /**
                             * @param {any} err
                             * @param {{ val: string; }} state
                             */
                            adapter.getForeignState(result[i].triggerID, (err, state) => {
                                let mustValue = ('' + result[i].triggerState);
                                if (typeof state != undefined && state != null) {
                                    currentValue = ('' + state.val);
                                }
                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].autoDrive != 'off')) {
                                    /**
                                     * @param {any} err
                                     * @param {{ val: number; }} state
                                     */
                                    adapter.getForeignState(result[i].name, (err, state) => {
                                        if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                            adapter.log.debug('#13 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                            adapter.setForeignState(result[i].name, shutterHeight, false);
                                            result[i].currentHeight = shutterHeight;
                                            adapter.log.debug('shutterUpLiving #1 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + shutterHeight + '%');
                                            //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                            shutterState(result[i].name);
                                        }
                                    });
                                } else if (result[i].triggerID == '') {
                                    /**
                                     * @param {any} err
                                     * @param {{ val: number; }} state
                                     */
                                    adapter.getForeignState(result[i].name, (err, state) => {
                                        if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                            adapter.log.debug('#14 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                            adapter.setForeignState(result[i].name, shutterHeight, false);
                                            result[i].currentHeight = shutterHeight;
                                            adapter.log.debug('shutterUpLiving #2 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + shutterHeight + '%');
                                            //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                            shutterState(result[i].name);
                                        }
                                    });
                                }
                            });
                        }, driveDelayUpLiving * i, i);
                    }
                });
            }
        }
        if ((autoLivingStr) === true) {
            setTimeout(function () {
                // Filter Area Living Auto
                if (resultFull) {
                    const /**
                         * @param {{ typeUp: string; }} d
                         */
                        resLivingAuto = resultFull.filter(d => d.typeUp == 'living-auto');
                    // Filter enabled
                    let /**
                         * @param {{ enabled: boolean; }} d
                         */
                        resEnabled = resLivingAuto.filter(d => d.enabled === true);

                    let result = resEnabled;

                    for (const i in result) {
                        let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                        /**
                         * @param {any} err
                         * @param {boolean} state
                         */
                        adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                            if (state && state === true || state && state.val === true) {
                                setTimeout(function () {
                                    let shutterHeight = 0;
                                    if (result[i].currentAction == 'OpenInSunProtect') {
                                        shutterHeight = parseFloat(result[i].heightDownSun);
                                        result[i].currentAction = 'sunProtect';
                                    } else {
                                        shutterHeight = parseFloat(result[i].heightUp);
                                        result[i].currentAction = 'up';
                                    }
                                    let currentValue = '';
                                    /**
                                     * @param {any} err
                                     * @param {{ val: string; }} state
                                     */
                                    adapter.getForeignState(result[i].triggerID, (err, state) => {
                                        let mustValue = ('' + result[i].triggerState);
                                        if (typeof state != undefined && state != null) {
                                            currentValue = ('' + state.val);
                                        }
                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].autoDrive != 'off')) {
                                            /**
                                             * @param {any} err
                                             * @param {{ val: number; }} state
                                             */
                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                    adapter.log.debug('#15 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                                    adapter.setForeignState(result[i].name, shutterHeight, false);
                                                    result[i].currentHeight = shutterHeight;
                                                    adapter.log.debug('shutterUpLiving #3 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + shutterHeight + '%');
                                                    //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                    shutterState(result[i].name);
                                                }
												
												//adapter.log.debug('#15a save current height: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
												//this is necessary if we end sunprotect manually by moving up manually and shutter does not close during summer or at all
												
												//does not work?? 26.06.20
												//result[i].currentHeight = shutterHeight;
                                            });
                                        } else if (result[i].triggerID == '') {
                                            /**
                                             * @param {any} err
                                             * @param {{ val: number; }} state
                                             */
                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                    adapter.log.debug('#16 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                                    adapter.setForeignState(result[i].name, shutterHeight, false);
                                                    result[i].currentHeight = shutterHeight;
                                                    adapter.log.debug('shutterUpLiving #4 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + shutterHeight + '%');
                                                    //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                    shutterState(result[i].name);
                                                }
                                            });
                                        }
                                    });
                                }, driveDelayUpLiving * i, i);
                            }
                        });
                    }
                }
            }, timeoutLivingAuto);
        }
    });
}

function shutterDownLiving() {

    adapter.log.debug('shutterDownLiving');

    const driveDelayUpLiving = adapter.config.driveDelayUpLiving * 1000;

    if ((downTimeLiving) == undefined) {
        downTimeLiving = adapter.config.W_shutterDownLiving;
    }
    let downTime = downTimeLiving.split(':');
    /** @type {number | undefined} */
    let timeoutLivingAuto;

    schedule.cancelJob('shutterDownLiving');

    const downLiving = schedule.scheduleJob('shutterDownLiving', downTime[1] + ' ' + downTime[0] + ' * * *', function () {
        // Full Result
        const resultFull = adapter.config.events;

        if (resultFull) {
            // Filter Area Living
            const /**
                 * @param {{ typeDown: string; }} d
                 */
                resLiving = resultFull.filter(d => d.typeDown == 'living');
            // Filter enabled
            let /**
                 * @param {{ enabled: boolean; }} d
                 */
                resEnabled = resLiving.filter(d => d.enabled === true);

            let result = resEnabled;
            let number = 0;

            for (const i in result) {
                number++;
            }

            timeoutLivingAuto = number * driveDelayUpLiving;


            for (const i in result) {

                let inSummerNotDown = false;
                if (IsSummerTime()) {
                    inSummerNotDown = result[i].inSummerNotDown;

                    if (inSummerNotDown) {
                        adapter.log.debug(result[i].shutterName + ' in summer time not down ' + result[i].inSummerNotDown);
                    }
                    else {
                        adapter.log.debug(result[i].shutterName + ' in summer time down ' + result[i].inSummerNotDown);
                    }
                }

                if (!inSummerNotDown) {

                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                    /**
                     * @param {any} err
                     * @param {boolean} state
                     */
                    adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {
                            setTimeout(function () {
                                let currentValue = '';
                                /**
                                 * @param {any} err
                                 * @param {{ val: string; }} state
                                 */
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    let mustValue = ('' + result[i].triggerState);
                                    if (typeof state != undefined && state != null) {
                                        currentValue = ('' + state.val);
                                    }
                                    if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp' && result[i].autoDrive != 'off')) {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: any; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                                                adapter.log.debug('#17 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                                                adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                result[i].currentHeight = result[i].heightDown;
                                                result[i].currentAction = 'down';
                                                adapter.log.debug('shutterDownLiving #1 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDownt + '%');
                                                //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                shutterState(result[i].name);
                                            }
                                        });
                                    } else if (result[i].triggerID == '') {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: any; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                                                adapter.log.debug('#18 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                                                adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                result[i].currentHeight = result[i].heightDown;
                                                result[i].currentAction = 'down';
                                                adapter.log.debug('shutterDownLiving #2 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDown + '%');
                                                //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                shutterState(result[i].name);
                                            }
                                        });
                                    }
                                });
                            }, driveDelayUpLiving * i, i);
                        }
                    });
                }
            }
        }
        if ((autoLivingStr) === true) {
            setTimeout(function () {
                if (resultFull) {
                    // Filter Area Living Auto
                    const /**
                         * @param {{ typeDown: string; }} d
                         */
                        resLivingAuto = resultFull.filter(d => d.typeDown == 'living-auto');
                    // Filter enabled
                    let /**
                         * @param {{ enabled: boolean; }} d
                         */
                        resEnabled = resLivingAuto.filter(d => d.enabled === true);

                    let result = resEnabled;

                    for (const i in result) {

                        let inSummerNotDown = false;
                        if (IsSummerTime()) {
                            inSummerNotDown = result[i].inSummerNotDown;

                            if (inSummerNotDown) {
                                adapter.log.debug(result[i].shutterName + ' in summer time not down ' + result[i].inSummerNotDown);
                            }
                            else {
                                adapter.log.debug(result[i].shutterName + ' in summer time down ' + result[i].inSummerNotDown);
                            }
                        }

                        if (!inSummerNotDown) {

                            let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                            /**
                             * @param {any} err
                             * @param {boolean} state
                             */
                            adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                                if (state && state === true || state && state.val === true) {
                                    setTimeout(function () {
                                        let currentValue = '';
                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp' && result[i].autoDrive != 'off')) {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: any; }} state
                                                 */
                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                                                        adapter.log.debug('#19 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                        result[i].currentHeight = result[i].heightDown;
                                                        result[i].currentAction = 'down';
                                                        adapter.log.debug('shutterDownLiving #3 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDown + '%');
                                                        //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                        shutterState(result[i].name);
                                                    }
                                                });
                                            } else if (result[i].triggerID == '') {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: any; }} state
                                                 */
                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                                                        adapter.log.debug('#20 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                        result[i].currentHeight = result[i].heightDown;
                                                        result[i].currentAction = 'down';
                                                        adapter.log.debug('shutterDownLiving #4 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDown + '%');
                                                        //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                        shutterState(result[i].name);
                                                    }
                                                });
                                            }
                                        });
                                    }, driveDelayUpLiving * i, i);
                                }
                            });
                        }
                    }
                }
            }, timeoutLivingAuto);
        }
    });
}

function shutterUpSleep() {

    const driveDelayUpSleep = adapter.config.driveDelayUpSleep * 1000;
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving * 1000;

    if ((upTimeSleep) == undefined) {
        upTimeSleep = adapter.config.W_shutterUpSleepMax;
    }
    let upTime = upTimeSleep.split(':');
    /** @type {number | undefined} */
    let timeoutSleepAuto;

    schedule.cancelJob('shutterUpSleep');

    const upSleep = schedule.scheduleJob('shutterUpSleep', upTime[1] + ' ' + upTime[0] + ' * * *', function () {

        delayUp = delayUp * driveDelayUpLiving;
        setTimeout(function () {
            // Full Result
            const resultFull = adapter.config.events;

            if (resultFull) {
                // Filter Area sleep
                const /**
                     * @param {{ typeUp: string; }} d
                     */
                    resSleep = resultFull.filter(d => d.typeUp == 'sleep');
                // Filter enabled
                let /**
                     * @param {{ enabled: boolean; }} d
                     */
                    resEnabled = resSleep.filter(d => d.enabled === true);

                let result = resEnabled;
                let number = 0;

                for (const i in result) {
                    number++;
                }

                timeoutSleepAuto = number * driveDelayUpSleep;

                for (const i in result) {
                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                    /**
                     * @param {any} err
                     * @param {boolean} state
                     */
                    adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {
                            setTimeout(function () {
                                let shutterHeight = 0;
                                if (result[i].currentAction == 'OpenInSunProtect') {
                                    shutterHeight = parseFloat(result[i].heightDownSun);
                                    result[i].currentAction = 'sunProtect';
                                } else {
                                    shutterHeight = parseFloat(result[i].heightUp);
                                    result[i].currentAction = 'up';
                                }
                                let currentValue = '';
                                /**
                                 * @param {any} err
                                 * @param {{ val: string; }} state
                                 */
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    let mustValue = ('' + result[i].triggerState);
                                    if (typeof state != undefined && state != null) {
                                        currentValue = ('' + state.val);
                                    }
                                    if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].autoDrive != 'off')) {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: number; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                adapter.log.debug('#21 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                                adapter.setForeignState(result[i].name, shutterHeight, false);
                                                result[i].currentHeight = shutterHeight;
                                                adapter.log.debug('shutterUpSleep #1 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + shutterHeight + '%');
                                                //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                shutterState(result[i].name);
                                            }
											
												//adapter.log.debug('#21a save current height: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
												//this is necessary if we end sunprotect manually by moving up manually and shutter does not close during summer or at all
												
												//does not work?? 26.06.20
												//result[i].currentHeight = shutterHeight;

                                        });
                                    } else if (result[i].triggerID == '') {
                                        /**
                                         * @param {any} err
                                         * @param {{ val: number; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                adapter.log.debug('#22 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                                adapter.setForeignState(result[i].name, shutterHeight, false);
                                                result[i].currentHeight = shutterHeight;
                                                adapter.log.debug('shutterUpSleep #2 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + shutterHeight + '%');
                                                //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                shutterState(result[i].name);
                                            }
                                        });
                                    }
                                });
                            }, driveDelayUpSleep * i, i);
                        }
                    });
                }
            }
            if ((autoSleepStr) === true) {
                setTimeout(function () {
                    // Full Result
                    const resultFull = adapter.config.events;
                    // Filter Area sleep
                    if (resultFull) {
                        const /**
                             * @param {{ typeUp: string; }} d
                             */
                            resSleep = resultFull.filter(d => d.typeUp == 'sleep-auto');
                        // Filter enabled
                        let /**
                             * @param {{ enabled: boolean; }} d
                             */
                            resEnabled = resSleep.filter(d => d.enabled === true);

                        let result = resEnabled;

                        for (const i in result) {
                            let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                            /**
                             * @param {any} err
                             * @param {boolean} state
                             */
                            adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                                if (state && state === true || state && state.val === true) {
                                    setTimeout(function () {
                                        let shutterHeight = 0;
                                        if (result[i].currentAction == 'OpenInSunProtect') {
                                            shutterHeight = parseFloat(result[i].heightDownSun);
                                            result[i].currentAction = 'sunProtect';
                                        } else {
                                            shutterHeight = parseFloat(result[i].heightUp);
                                            result[i].currentAction = 'up';
                                        }
                                        let currentValue = '';
                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].autoDrive != 'off')) {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: number; }} state
                                                 */
                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                        adapter.log.debug('#23 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                                        adapter.setForeignState(result[i].name, shutterHeight, false);
                                                        result[i].currentHeight = shutterHeight;
                                                        adapter.log.debug('shutterUpSleep #3 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + shutterHeight + '%');
                                                        //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                        shutterState(result[i].name);
                                                    }
                                                });
                                            } else if (result[i].triggerID == '') {
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: number; }} state
                                                 */
                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                    if (typeof state != undefined && state != null && state.val != shutterHeight) {
                                                        adapter.log.debug('#24 Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%');
                                                        adapter.setForeignState(result[i].name, shutterHeight, false);
                                                        result[i].currentHeight = shutterHeight;
                                                        adapter.log.debug('shutterUpSleep #4 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + shutterHeight + '%');
                                                        //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                        shutterState(result[i].name);
                                                    }
                                                });
                                            }
                                        });
                                    }, driveDelayUpSleep * i, i);
                                }
                            });
                        }
                    }
                }, timeoutSleepAuto);
            }
        }, delayUp);
    });
}

//=======================================================================================================
//
//
//
function shutterDownLate() {

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
                            adapter.log.debug('#25 Set ID: ' + resLateDown[i].shutterName + ' value: ' + resLateDown[i].heightDown + '%');
                            adapter.setForeignState(resLateDown[i].name, parseFloat(resLateDown[i].heightDown), false);
                            resLateDown[i].currentHeight = resLateDown[i].heightDown;
                            resLateDown[i].currentAction = 'down';
                            adapter.log.debug('save current height: ' + resLateDown[i].currentHeight + '%' + ' from ' + resLateDown[i].shutterName);
                            shutterState(resLateDown[i].name);

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

function IsSummerTime() {

    let ret = false;
    try {

        if (adapter.config.SummerStart.length > 0 && adapter.config.SummerEnd.length > 0) {
            const SummmerStart = adapter.config.SummerStart.split('.');
            const SummmerEnd = adapter.config.SummerEnd.split('.');

            //adapter.log.debug(JSON.stringify(SummmerStart) + ' ## ' + JSON.stringify(SummmerEnd));

            if (SummmerStart.length >= 2 && SummmerEnd.length >= 2) {
                const now = new Date();
                let AfterSummerStart = false;
                if (now.getMonth() > parseInt(SummmerStart[1])
                    || now.getMonth() === parseInt(SummmerStart[1]) && now.getDate() >= parseInt(SummmerStart[0])) {
                    AfterSummerStart = true;

                    //adapter.log.debug('after summer start');
                }

                let BeforeSummerEnd = false;
                if (now.getMonth() < parseInt(SummmerEnd[1])
                    || now.getMonth() === parseInt(SummmerEnd[1]) && now.getDate() <= parseInt(SummmerEnd[0])) {
                    BeforeSummerEnd = true;

                    //adapter.log.debug('before summer end');
                }

                if (AfterSummerStart && BeforeSummerEnd) {

                    adapter.log.debug('we are in summer time');
                    ret = true;
                }
                else {
                    adapter.log.debug('we are not in summer time');
                }
            }
            else {
                adapter.log.debug('!!! ' + SummmerStart.length + ' ' + SummmerEnd.length);
            }
        }
    }
    catch (e) {
        adapter.log.error('exception catch in IsSummerTime [' + e + '] ');
    }

    return ret;

}

function shutterDownSleep() {

    const driveDelayUpSleep = adapter.config.driveDelayUpSleep * 1000;
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving * 1000;

    if ((downTimeSleep) == undefined) {
        downTimeSleep = adapter.config.W_shutterDownSleep;
    }
    let downTime = downTimeSleep.split(':');
    /** @type {number | undefined} */
    let timeoutSleepAuto;

    schedule.cancelJob('shutterDownSleep');

    const downSleep = schedule.scheduleJob('shutterDownSleep', downTime[1] + ' ' + downTime[0] + ' * * *', function () {
        delayDown = delayDown * driveDelayUpLiving;
        setTimeout(function () {
            // Full Result
            const resultFull = adapter.config.events;

            if (resultFull) {
                // Filter Area sleep
                const /**
                     * @param {{ typeDown: string; }} d
                     */
                    resSleep = resultFull.filter(d => d.typeDown == 'sleep');
                // Filter enabled
                let /**
                     * @param {{ enabled: boolean; }} d
                     */
                    resEnabled = resSleep.filter(d => d.enabled === true);

                let result = resEnabled;
                let number = 0;

                for (const i in result) {
                    number++;
                }

                timeoutSleepAuto = number * driveDelayUpSleep;

                for (const i in result) {

                    let inSummerNotDown = false;
                    if (IsSummerTime()) {
                        inSummerNotDown = result[i].inSummerNotDown;

                        if (inSummerNotDown) {
                            adapter.log.debug(result[i].shutterName + ' in summer time not down ' + result[i].inSummerNotDown);
                        }
                        else {
                            adapter.log.debug(result[i].shutterName + ' in summer time down ' + result[i].inSummerNotDown);
                        }
                    }




                    if (!inSummerNotDown) {

                        const nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                        adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                            if (state && state === true || state && state.val === true) {
                                setTimeout(function () {
                                    let currentValue = '';
                                    /**
                                     * @param {any} err
                                     * @param {{ val: string; }} state
                                     */
                                    adapter.getForeignState(result[i].triggerID, (err, state) => {
                                        const mustValue = ('' + result[i].triggerState);
                                        if (typeof state != undefined && state != null) {
                                            currentValue = ('' + state.val);
                                        }
                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp' && result[i].autoDrive != 'off')) {
                                            /**
                                             * @param {any} err
                                             * @param {{ val: any; }} state
                                             */
                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                                                    adapter.log.debug('#26 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                    result[i].currentHeight = result[i].heightDown;
                                                    result[i].currentAction = 'down';
                                                    adapter.log.debug('shutterDownSleep #1 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDown + '%');
                                                    //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                    shutterState(result[i].name);
                                                }
                                            });
                                        } else if (result[i].triggerID == '') {
                                            /**
                                             * @param {any} err
                                             * @param {{ val: any; }} state
                                             */
                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                                                    adapter.log.debug('#27 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                    result[i].currentHeight = result[i].heightDown;
                                                    result[i].currentAction = 'down';
                                                    adapter.log.debug('shutterDownSleep #2 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDown + '%');
                                                    //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                    shutterState(result[i].name);
                                                }
                                            });
                                        }
                                    });
                                }, driveDelayUpSleep * i, i);
                            }
                        });
                    }
                }
            }
            if ((autoSleepStr) === true) {
                setTimeout(function () {
                    // Full Result
                    const resultFull = adapter.config.events;

                    if (resultFull) {
                        // Filter Area sleep
                        const /**
                             * @param {{ typeDown: string; }} d
                             */
                            resSleep = resultFull.filter(d => d.typeDown == 'sleep-auto');
                        // Filter enabled
                        let /**
                             * @param {{ enabled: boolean; }} d
                             */
                            resEnabled = resSleep.filter(d => d.enabled === true);

                        let result = resEnabled;

                        for (const i in result) {

                            let inSummerNotDown = false;
                            if (IsSummerTime()) {
                                inSummerNotDown = result[i].inSummerNotDown;

                                if (inSummerNotDown) {
                                    adapter.log.debug(result[i].shutterName + ' in summer time not down');
                                }
                                else {
                                    adapter.log.debug(result[i].shutterName + ' in summer time down');
                                }
                            }

                            if (!inSummerNotDown) {

                                let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                                /**
                                 * @param {any} err
                                 * @param {boolean} state
                                 */
                                adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                                    if (state && state === true || state && state.val === true) {
                                        setTimeout(function () {
                                            let currentValue = '';
                                            /**
                                             * @param {any} err
                                             * @param {{ val: string; }} state
                                             */
                                            adapter.getForeignState(result[i].triggerID, (err, state) => {
                                                let mustValue = ('' + result[i].triggerState);
                                                if (typeof state != undefined && state != null) {
                                                    currentValue = ('' + state.val);
                                                }
                                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp' && result[i].autoDrive != 'off')) {
                                                    /**
                                                     * @param {any} err
                                                     * @param {{ val: any; }} state
                                                     */
                                                    adapter.getForeignState(result[i].name, (err, state) => {
                                                        if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                                                            adapter.log.debug('#28 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                            result[i].currentHeight = result[i].heightDown;
                                                            result[i].currentAction = 'down';
                                                            adapter.log.debug('shutterDownSleep #3 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDown + '%');
                                                            //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                            shutterState(result[i].name);
                                                        }
                                                    });
                                                } else if (result[i].triggerID == '') {
                                                    /**
                                                     * @param {any} err
                                                     * @param {{ val: any; }} state
                                                     */
                                                    adapter.getForeignState(result[i].name, (err, state) => {
                                                        if (typeof state != undefined && state != null && state.val != result[i].heightDown) {
                                                            adapter.log.debug('#29 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%');
                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                            result[i].currentHeight = result[i].heightDown;
                                                            result[i].currentAction = 'down';
                                                            adapter.log.debug('shutterDownSleep #4 ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDown + '%');
                                                            //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                            shutterState(result[i].name);
                                                        }
                                                    });
                                                }
                                            });
                                        }, driveDelayUpSleep * i, i);
                                    }
                                });
                            }
                        }
                    }
                }, timeoutSleepAuto);
            }
        }, delayDown);
    });
}

function sunProtect() {

    const driveDelayUpSleep = adapter.config.driveDelayUpAstro * 1000;

    setTimeout(function () {
        // Full Result
        let resultFull = adapter.config.events;

        if (resultFull) {
            // Filter enabled
            let /**
                 * @param {{ enabled: boolean; }} d
                 */
                resEnabled = resultFull.filter(d => d.enabled === true);
            let result = resEnabled;

            if (elevation > adapter.config.sunProtEndElevation) {
                for (const i in result) {
                    let resultDirectionRangeMinus = 0;
                    let resultDirectionRangePlus = 0;

                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');

                    /**
                     * @param {any} err
                     * @param {boolean} state
                     */
                    adapter.getState('shutters.autoSun.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {

                            switch (result[i].type) {
                                case 'in- & outside temperature': // in- & outside temperature
                                    setTimeout(function () {
                                        let currentValue = '';
                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue && result[i].tempSensor != '' || (currentValue != mustValue && result[i].autoDrive != 'off' && result[i].tempSensor != '') || (result[i].triggerID == '' && result[i].tempSensor != '')) {
                                                /** @type {number} */
                                                let insideTemp;
                                                /** @type {number} */
                                                let outsideTemp;
                                                /** @type {number} */
                                                let sunLight;
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(result[i].tempSensor, (err, state) => {
                                                    if (typeof state != undefined && state != null) {
                                                        insideTemp = parseFloat(state.val);

                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: string; }} state
                                                         */
                                                        adapter.getForeignState(result[i].outsideTempSensor, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                outsideTemp = parseFloat(state.val);
                                                            }

                                                            /**
                                                             * @param {any} err
                                                             * @param {{ val: string; }} state
                                                             */
                                                            adapter.getForeignState(result[i].lightSensor, (err, state) => {
                                                                if (typeof state != undefined && state != null) {
                                                                    sunLight = parseFloat(state.val);
                                                                }

                                                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp') || (result[i].triggerID == '')) {
                                                                    if (insideTemp > result[i].tempInside) {
                                                                        if (result[i].tempOutside < outsideTemp && (result[i].lightSensor != '' && result[i].valueLight < sunLight || result[i].lightSensor == '') && result[i].currentAction != 'sunProtect' && result[i].currentAction != 'OpenInSunProtect') {
                                                                            /**
                                                                             * @param {any} err
                                                                             * @param {{ val: string; }} state
                                                                             */
                                                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                                                if (typeof state != undefined && state != null) {
                                                                                    adapter.log.debug(result[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + result[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + result[i].currentHeight + ' AND currentHeight:' + result[i].currentHeight + ' == heightUp:' + result[i].heightUp);
                                                                                    if (parseFloat(state.val) > parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                                        result[i].currentAction = 'sunProtect';
                                                                                        adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is active');
                                                                                        adapter.log.debug('Temperature inside: ' + insideTemp + ' > ' + result[i].tempInside + ' AND ( Temperatur outside: ' + outsideTemp + ' > ' + result[i].tempOutside + ' AND Light: ' + sunLight + ' > ' + result[i].valueLight + ' )');
                                                                                        adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%')
                                                                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightDownSun), false);
                                                                                        result[i].currentHeight = result[i].heightDownSun;
                                                                                        adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDownSun + '%');
                                                                                        //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                                        shutterState(result[i].name);
                                                                                    }
                                                                                    //Shutter closed. Set currentAction = sunProtect when sunProtect starts => If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                                    else if (parseFloat(state.val) == parseFloat(result[i].heightDown) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentAction != 'down' && result[i].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                                        result[i].currentAction = 'OpenInSunProtect';
                                                                                        adapter.log.debug('Set sunprotect mode for ' + result[i].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                                    }
                                                                                    //Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set -> set sunProtect again
                                                                                    else if (parseFloat(state.val) == parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentHeight != result[i].heightDown && result[i].currentAction == '') {
                                                                                        adapter.log.debug(result[i].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + result[i].heightDownSun);
                                                                                        result[i].currentAction = 'sunProtect';
                                                                                    }
                                                                                }
                                                                            });
                                                                        }
                                                                    }
                                                                }
                                                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown') || (result[i].triggerID == '')) {
                                                                    let hysteresisOutside = (((100 - result[i].hysteresisOutside) / 100) * result[i].tempOutside).toFixed(2);
                                                                    let hysteresisInside = (((100 - result[i].hysteresisInside) / 100) * result[i].tempInside).toFixed(2);
                                                                    let hysteresisLight = (((100 - result[i].hysteresisLight) / 100) * result[i].valueLight).toFixed(2);

                                                                    if (insideTemp < parseFloat(hysteresisInside) || (parseFloat(hysteresisOutside) > outsideTemp || result[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && result[i].lightSensor == '')) {

                                                                        /**
                                                                         * @param {any} err
                                                                         * @param {{ val: string; }} state
                                                                         */
                                                                        adapter.getForeignState(result[i].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                if (result[i].currentAction == 'sunProtect' && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                                    result[i].currentAction = 'up';
                                                                                    adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active');
                                                                                    adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                                    adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightUp + '%')
                                                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                                                                    result[i].currentHeight = result[i].heightUp;
                                                                                    adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDownSun + '%')
                                                                                    //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                                    shutterState(result[i].name);
                                                                                }
                                                                                else if (result[i].currentAction == 'OpenInSunProtect') {
                                                                                    result[i].currentAction = '';
                                                                                }
                                                                            }
                                                                        });
                                                                    }
                                                                }
                                                            });
                                                        });

                                                    }
                                                });
                                            }
                                        });
                                    }, driveDelayUpSleep * i, i);
                                    break;
                                case 'in- & outside temperature and direction': // in- & outside temperature and direction
                                    resultDirectionRangeMinus = parseInt(result[i].direction) - parseInt(result[i].directionRange);
                                    resultDirectionRangePlus = parseInt(result[i].direction) + parseInt(result[i].directionRange);
                                    setTimeout(function () {
                                        let currentValue = '';
                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue && result[i].tempSensor != '' || (currentValue != mustValue && result[i].autoDrive != 'off' && result[i].tempSensor != '') || (result[i].triggerID == '' && result[i].tempSensor != '')) {
                                                /** @type {number} */
                                                let insideTemp;
                                                /** @type {number} */
                                                let outsideTemp;
                                                /** @type {number} */
                                                let sunLight;
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(result[i].tempSensor, (err, state) => {
                                                    if (typeof state != undefined && state != null) {
                                                        insideTemp = parseFloat(state.val);

                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: string; }} state
                                                         */
                                                        adapter.getForeignState(result[i].outsideTempSensor, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                outsideTemp = parseFloat(state.val);
                                                            }

                                                            /**
                                                             * @param {any} err
                                                             * @param {{ val: string; }} state
                                                             */
                                                            adapter.getForeignState(result[i].lightSensor, (err, state) => {
                                                                if (typeof state != undefined && state != null) {
                                                                    sunLight = parseFloat(state.val);
                                                                }
                                                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp') || (result[i].triggerID == '')) {
                                                                    if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth && insideTemp > result[i].tempInside) {
                                                                        if (result[i].tempOutside < outsideTemp && (result[i].lightSensor != '' && result[i].valueLight < sunLight || result[i].lightSensor == '') && result[i].currentAction != 'sunProtect' && result[i].currentAction != 'OpenInSunProtect') {

                                                                            /**
                                                                             * @param {any} err
                                                                             * @param {{ val: string; }} state
                                                                             */
                                                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                                                if (typeof state != undefined && state != null) {
                                                                                    adapter.log.debug(result[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + result[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + result[i].currentHeight + ' AND currentHeight:' + result[i].currentHeight + ' == heightUp:' + result[i].heightUp);
                                                                                    if (parseFloat(state.val) > parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                                        result[i].currentAction = 'sunProtect';
                                                                                        adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is active');
                                                                                        adapter.log.debug('Temperature inside: ' + insideTemp + ' > ' + result[i].tempInside + ' AND ( Temperatur outside: ' + outsideTemp + ' > ' + result[i].tempOutside + ' AND Light: ' + sunLight + ' > ' + result[i].valueLight + ' )');
                                                                                        adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDownSun + '%');
                                                                                        adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%');

                                                                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightDownSun), false);
                                                                                        result[i].currentHeight = result[i].heightDownSun;
                                                                                        adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDownSun + '%')
                                                                                        //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                                        shutterState(result[i].name);
                                                                                    }
                                                                                    //Shutter closed. Set currentAction = sunProtect when sunProtect starts => If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                                    else if (parseFloat(state.val) == parseFloat(result[i].heightDown) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentAction != 'down' && result[i].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                                        result[i].currentAction = 'OpenInSunProtect';
                                                                                        adapter.log.debug('Set sunprotect mode for ' + result[i].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                                    }
                                                                                    //Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set -> set sunProtect again
                                                                                    else if (parseFloat(state.val) == parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentHeight != result[i].heightDown && result[i].currentAction == '') {
                                                                                        adapter.log.debug(result[i].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + result[i].heightDownSun);
                                                                                        result[i].currentAction = 'sunProtect';
                                                                                    }
                                                                                }
                                                                            });
                                                                        }
                                                                    }
                                                                }
                                                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown') || (result[i].triggerID == '')) {
                                                                    let hysteresisOutside = (((100 - result[i].hysteresisOutside) / 100) * result[i].tempOutside).toFixed(2);
                                                                    let hysteresisInside = (((100 - result[i].hysteresisInside) / 100) * result[i].tempInside).toFixed(2);
                                                                    let hysteresisLight = (((100 - result[i].hysteresisLight) / 100) * result[i].valueLight).toFixed(2);

                                                                    if (insideTemp < parseFloat(hysteresisInside) || (resultDirectionRangePlus) < azimuth || (parseFloat(hysteresisOutside) > outsideTemp || result[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && result[i].lightSensor == '')) {
                                                                        /**
                                                                         * @param {any} err
                                                                         * @param {{ val: string; }} state
                                                                         */
                                                                        adapter.getForeignState(result[i].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                if (result[i].currentAction == 'sunProtect' && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                                    result[i].currentAction = 'up';
                                                                                    adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active');
                                                                                    adapter.log.debug('Range: ' + resultDirectionRangePlus + ' < ' + azimuth + ' OR Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ')');
                                                                                    adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightUp + '%');
                                                                                    adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightUp + '%');

                                                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                                                                    result[i].currentHeight = result[i].heightUp;
                                                                                    adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightUp + '%')
                                                                                    //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                                    shutterState(result[i].name);
                                                                                }
                                                                                else if (result[i].currentAction == 'OpenInSunProtect') {
                                                                                    result[i].currentAction = '';
                                                                                }
                                                                            }
                                                                        });
                                                                    }
                                                                }
                                                            });
                                                        });
                                                    }
                                                });
                                            }
                                        });
                                    }, driveDelayUpSleep * i, i);
                                    break;
                                case 'outside temperature and direction': //outside temperature and direction
                                    resultDirectionRangeMinus = parseInt(result[i].direction) - parseInt(result[i].directionRange);
                                    resultDirectionRangePlus = parseInt(result[i].direction) + parseInt(result[i].directionRange);

                                    //adapter.log.debug("resultDirectionRangeMinus " + resultDirectionRangeMinus + " " + " resultDirectionRangePlus " + resultDirectionRangePlus);
                                    setTimeout(function () {
                                        let currentValue = '';
                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'off') || (result[i].triggerID == '')) {
                                                /** @type {number} */
                                                let outsideTemp;
                                                /** @type {number} */
                                                let sunLight;

                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(result[i].outsideTempSensor, (err, state) => {
                                                    if (typeof state != undefined && state != null) {
                                                        outsideTemp = parseFloat(state.val);
                                                    }

                                                    /**
                                                     * @param {any} err
                                                     * @param {{ val: string; }} state
                                                     */
                                                    adapter.getForeignState(result[i].lightSensor, (err, state) => {
                                                        if (typeof state != undefined && state != null) {
                                                            sunLight = parseFloat(state.val);
                                                        }
                                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp') || (result[i].triggerID == '')) {
                                                            if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth) {
                                                                if (result[i].tempOutside < outsideTemp && (result[i].lightSensor != '' && result[i].valueLight < sunLight || result[i].lightSensor == '') && result[i].currentAction != 'sunProtect' && result[i].currentAction != 'OpenInSunProtect') {

                                                                    //adapter.log.debug("should sunprotect for " + result[i].shutterName);
                                                                    /**
                                                                     * @param {any} err
                                                                     * @param {{ val: string; }} state
                                                                     */
                                                                    adapter.getForeignState(result[i].name, (err, state) => {

                                                                        //adapter.log.debug(result[i].shutterName + ": " + state.val + " " + result[i].heightDownSun + " " + result[i].currentHeight + " " +  result[i].heightUp);

                                                                        if (typeof state != undefined && state != null) {
                                                                            adapter.log.debug(result[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + result[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + result[i].currentHeight + ' AND currentHeight:' + result[i].currentHeight + ' == heightUp:' + result[i].heightUp);
                                                                            if (parseFloat(state.val) > parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                                result[i].currentAction = 'sunProtect';
                                                                                adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is active');
                                                                                adapter.log.debug('Temperatur outside: ' + outsideTemp + ' > ' + result[i].tempOutside + ' AND Light: ' + sunLight + ' > ' + result[i].valueLight);
                                                                                adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%')

                                                                                adapter.setForeignState(result[i].name, parseFloat(result[i].heightDownSun), false);
                                                                                result[i].currentHeight = result[i].heightDownSun;
                                                                                adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDownSun + '%')
                                                                                //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                                shutterState(result[i].name);
                                                                            }
                                                                            //Shutter closed. Set currentAction = sunProtect when sunProtect starts => If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                            else if (parseFloat(state.val) == parseFloat(result[i].heightDown) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentAction != 'down' && result[i].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                                result[i].currentAction = 'OpenInSunProtect';
                                                                                adapter.log.debug('Set sunprotect mode for ' + result[i].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                            }
                                                                            //Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set -> set sunProtect again
                                                                            else if (parseFloat(state.val) == parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentHeight != result[i].heightDown && result[i].currentAction == '') {
                                                                                adapter.log.debug(result[i].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + result[i].heightDownSun);
                                                                                result[i].currentAction = 'sunProtect';
                                                                            }
                                                                        }
                                                                    });
                                                                }
                                                                //else {
                                                                //    adapter.log.debug(" temp " + result[i].tempOutside + " <  " + outsideTemp + " light " + result[i].valueLight + " < " + sunLight);
                                                                //}
                                                            }
                                                            //else {
                                                            //    adapter.log.debug(" azimuth " + azimuth);
                                                            //}
                                                        }
                                                        //else {
                                                        //    adapter.log.debug("  currentValue === mustValue)" + currentValue + " " + mustValue);
                                                        //}
                                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown') || (result[i].triggerID == '')) {
                                                            const hysteresisOutside = (((100 - result[i].hysteresisOutside) / 100) * result[i].tempOutside).toFixed(2);
                                                            const hysteresisLight = (((100 - result[i].hysteresisLight) / 100) * result[i].valueLight).toFixed(2);

                                                            //adapter.log.debug("check end sun protection for " + result[i].shutterName + " hysterese temp " + hysteresisOutside + " > " + outsideTemp + " hysterese light " + hysteresisLight + " > " + sunLight);


                                                            if ((resultDirectionRangePlus) < azimuth || (parseFloat(hysteresisOutside) > outsideTemp || result[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && result[i].lightSensor == '')) {
                                                                //adapter.log.debug("should end sun protection " + result[i].currentAction + " for " + result[i].shutterName);

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        if (result[i].currentAction == 'sunProtect' && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                            result[i].currentAction = 'up';
                                                                            adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active');
                                                                            adapter.log.debug('Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight);
                                                                            adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightUp + '%')
                                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                                                            result[i].currentHeight = result[i].heightUp;
                                                                            adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightUp + '%')
                                                                            //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                            shutterState(result[i].name);
                                                                        }
                                                                        else if (result[i].currentAction == 'OpenInSunProtect') {
                                                                            result[i].currentAction = '';
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                    });
                                                });
                                            }
                                        });
                                    }, driveDelayUpSleep * i, i);
                                    break;
                                case 'only direction': //only direction
                                    resultDirectionRangeMinus = parseInt(result[i].direction) - parseInt(result[i].directionRange);
                                    resultDirectionRangePlus = parseInt(result[i].direction) + parseInt(result[i].directionRange);
                                    setTimeout(function () {
                                        let currentValue = '';
                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'off') || (result[i].triggerID == '')) {
                                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp') || (result[i].triggerID == '')) {
                                                    if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth && result[i].currentAction != 'sunProtect' && result[i].currentAction != 'OpenInSunProtect') {

                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: string; }} state
                                                         */
                                                        adapter.getForeignState(result[i].name, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                adapter.log.debug(result[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + result[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + result[i].currentHeight + ' AND currentHeight:' + result[i].currentHeight + ' == heightUp:' + result[i].heightUp);
                                                                if (parseFloat(state.val) > parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                    result[i].currentAction = 'sunProtect';
                                                                    adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is active');
                                                                    adapter.log.debug('RangeMinus: ' + resultDirectionRangeMinus + ' < ' + azimuth + 'RangePlus: ' + resultDirectionRangePlus + ' > ' + azimuth);
                                                                    adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%')

                                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightDownSun), false);
                                                                    result[i].currentHeight = result[i].heightDownSun;
                                                                    adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDownSun + '%')
                                                                    //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                    shutterState(result[i].name);
                                                                }
                                                                //Shutter closed. Set currentAction = sunProtect when sunProtect starts => If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                else if (parseFloat(state.val) == parseFloat(result[i].heightDown) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentAction != 'down' && result[i].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                    result[i].currentAction = 'OpenInSunProtect';
                                                                    adapter.log.debug('Set sunprotect mode for ' + result[i].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                }
                                                                //Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set -> set sunProtect again
                                                                else if (parseFloat(state.val) == parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentHeight != result[i].heightDown && result[i].currentAction == '') {
                                                                    adapter.log.debug(result[i].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + result[i].heightDownSun);
                                                                    result[i].currentAction = 'sunProtect';
                                                                }
                                                            }
                                                        });
                                                    }
                                                }
                                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown') || (result[i].triggerID == '')) {
                                                    if ((resultDirectionRangePlus) < azimuth) {

                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: string; }} state
                                                         */
                                                        adapter.getForeignState(result[i].name, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                if (result[i].currentAction == 'sunProtect' && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                    result[i].currentAction = 'up';
                                                                    adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active');
                                                                    adapter.log.debug('Range: ' + resultDirectionRangePlus + ' < ' + azimuth);
                                                                    adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightUp + '%')
                                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                                                    result[i].currentHeight = result[i].heightUp;
                                                                    adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightUp + '%')
                                                                    //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                    shutterState(result[i].name);
                                                                }
                                                                else if (result[i].currentAction == 'OpenInSunProtect') {
                                                                    result[i].currentAction = '';
                                                                }
                                                            }
                                                        });
                                                    }
                                                }
                                            }
                                        });
                                    }, driveDelayUpSleep * i, i);
                                    break;
                                case 'only outside temperature': //only outside temperature
                                    setTimeout(function () {
                                        let currentValue = '';
                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'off') || (result[i].triggerID == '')) {
                                                /** @type {number} */
                                                let outsideTemp;
                                                /** @type {number} */
                                                let sunLight;

                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(result[i].outsideTempSensor, (err, state) => {
                                                    if (typeof state != undefined && state != null) {
                                                        outsideTemp = parseFloat(state.val);
                                                    }

                                                    /**
                                                     * @param {any} err
                                                     * @param {{ val: string; }} state
                                                     */
                                                    adapter.getForeignState(result[i].lightSensor, (err, state) => {
                                                        if (typeof state != undefined && state != null) {
                                                            sunLight = parseFloat(state.val);
                                                        }
                                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp') || (result[i].triggerID == '')) {
                                                            if (result[i].tempOutside < outsideTemp && (result[i].lightSensor != '' && result[i].valueLight < sunLight || result[i].lightSensor == '') && result[i].currentAction != 'sunProtect' && result[i].currentAction != 'OpenInSunProtect') {
                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        adapter.log.debug(result[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + result[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + result[i].currentHeight + ' AND currentHeight:' + result[i].currentHeight + ' == heightUp:' + result[i].heightUp);
                                                                        if (parseFloat(state.val) > parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                            result[i].currentAction = 'sunProtect';
                                                                            adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is active');
                                                                            adapter.log.debug('Temperature outside: ' + outsideTemp + ' > ' + result[i].tempOutside + ' AND Light: ' + sunLight + ' > ' + result[i].valueLight);
                                                                            adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%')

                                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightDownSun), false);
                                                                            result[i].currentHeight = result[i].heightDownSun;
                                                                            adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDownSun + '%')
                                                                            //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                            shutterState(result[i].name);
                                                                        }
                                                                        //Shutter closed. Set currentAction = sunProtect when sunProtect starts => If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                        else if (parseFloat(state.val) == parseFloat(result[i].heightDown) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentAction != 'down' && result[i].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                            result[i].currentAction = 'OpenInSunProtect';
                                                                            adapter.log.debug('Set sunprotect mode for ' + result[i].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                        }
                                                                        //Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set -> set sunProtect again
                                                                        else if (parseFloat(state.val) == parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentHeight != result[i].heightDown && result[i].currentAction == '') {
                                                                            adapter.log.debug(result[i].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + result[i].heightDownSun);
                                                                            result[i].currentAction = 'sunProtect';
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown') || (result[i].triggerID == '')) {

                                                            let hysteresisOutside = (((100 - result[i].hysteresisOutside) / 100) * result[i].tempOutside).toFixed(2);
                                                            let hysteresisLight = (((100 - result[i].hysteresisLight) / 100) * result[i].valueLight).toFixed(2);

                                                            if ((parseFloat(hysteresisOutside) > outsideTemp && result[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && result[i].lightSensor == '')) {

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        if (result[i].currentAction == 'sunProtect' && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                            result[i].currentAction = 'up';
                                                                            adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active');
                                                                            adapter.log.debug('Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight);
                                                                            adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightUp + '%')

                                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                                                            result[i].currentHeight = result[i].heightUp;
                                                                            adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightUp + '%')
                                                                            //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                            shutterState(result[i].name);
                                                                        }
                                                                        else if (result[i].currentAction == 'OpenInSunProtect') {
                                                                            result[i].currentAction = '';
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                    });
                                                });
                                            }
                                        });
                                    }, driveDelayUpSleep * i, i);
                                    break;
                                case 'only inside temperature': //only inside temperature
                                    setTimeout(function () {
                                        let currentValue = '';
                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue && result[i].tempSensor != '' || (currentValue != mustValue && result[i].autoDrive != 'off' && result[i].tempSensor != '') || (result[i].triggerID == '' && result[i].tempSensor != '')) {
                                                /** @type {string | number} */
                                                let insideTemp;
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(result[i].tempSensor, (err, state) => {
                                                    if (typeof state != undefined && state != null) {
                                                        insideTemp = parseFloat(state.val);

                                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp') || (result[i].triggerID == '')) {
                                                            if (insideTemp > result[i].tempInside && result[i].currentAction != 'sunProtect' && result[i].currentAction != 'OpenInSunProtect') {

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        if (parseFloat(state.val) > parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                            result[i].currentAction = 'sunProtect';
                                                                            adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is active');
                                                                            adapter.log.debug('#40 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%');
                                                                            adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%');
                                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightDownSun), false);
                                                                            result[i].currentHeight = result[i].heightDownSun;
                                                                            adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDownSun + '%')
                                                                            //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                            shutterState(result[i].name);
                                                                        }
                                                                        //Shutter closed. Set currentAction = sunProtect when sunProtect starts => If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                        else if (parseFloat(state.val) == parseFloat(result[i].heightDown) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentAction != 'down' && result[i].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                            result[i].currentAction = 'OpenInSunProtect';
                                                                            adapter.log.debug('Set sunprotect mode for ' + result[i].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                        }
                                                                        //Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set -> set sunProtect again
                                                                        else if (parseFloat(state.val) == parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentHeight != result[i].heightDown && result[i].currentAction == '') {
                                                                            adapter.log.debug(result[i].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + result[i].heightDownSun);
                                                                            result[i].currentAction = 'sunProtect';
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown') || (result[i].triggerID == '')) {
                                                            let hysteresisInside = (((100 - result[i].hysteresisInside) / 100) * result[i].tempInside).toFixed(2);

                                                            if (insideTemp < parseFloat(hysteresisInside)) {

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        if (result[i].currentAction == 'sunProtect' && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                            result[i].currentAction = 'up';
                                                                            adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active');
                                                                            adapter.log.debug('#41 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightUp + '%');
                                                                            adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightUp + '%');
                                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                                                            result[i].currentHeight = result[i].heightUp;
                                                                            adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightUp + '%')
                                                                            //adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                            shutterState(result[i].name);
                                                                        }
                                                                        else if (result[i].currentAction == 'OpenInSunProtect') {
                                                                            result[i].currentAction = '';
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                    }
                                                });
                                            }
                                        });
                                    }, driveDelayUpSleep * i, i);
                                    break;
                            }
                        }
                    });
                }
            }
        }

        let upSunProtect = adapter.config.sun_shutterUp;

        if ((upSunProtect) == undefined) {
            upSunProtect = adapter.config.sun_shutterUp;
        }
        let upTimeSun = upSunProtect.split(':');

        // Full Result
        resultFull = adapter.config.events;

        if (resultFull) {
            // Filter enabled
            let /**
                 * @param {{ enabled: boolean; }} d
                 */
                resEnabled = resultFull.filter(d => d.enabled === true);

            let result = resEnabled;
            const sunProtEndStart = parseInt(adapter.config.sunProtEndElevation);
            const sunProtEndStop = (adapter.config.sunProtEndElevation - 1);

            for (const i in result) {
                if (elevation <= sunProtEndStart && elevation >= sunProtEndStop && result[i].currentAction == 'sunProtect') {
                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                    /**
                     * @param {any} err
                     * @param {boolean} state
                     */
                    adapter.getState('shutters.autoSun.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {
                            setTimeout(function () {
                                let currentValue = '';
                                /**
                                 * @param {any} err
                                 * @param {{ val: string; }} state
                                 */
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    let mustValue = ('' + result[i].triggerState);
                                    if (typeof state != undefined && state != null) {
                                        currentValue = ('' + state.val);
                                    }
                                    if (currentValue === mustValue && result[i].tempSensor != '' || (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].autoDrive != 'off') || (result[i].triggerID == '')) {

                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null) {
                                                if (result[i].currentAction == 'sunProtect' && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                    result[i].currentAction = '';
                                                    adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is completed');
                                                    adapter.log.debug('#42 Set ID: ' + result[i].shutterName + ' value: ' + parseFloat(result[i].heightUp) + '%');
                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                                    result[i].currentHeight = result[i].heightUp;
                                                    adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                    shutterState(result[i].name);
                                                }
                                            }
                                        });
                                    }
                                });
                            }, driveDelayUpSleep * i, i);
                        }
                    });
                }
                //else {
                //    adapter.log.debug(" nothing to do to end sunprotect " + elevation + " " + sunProtEndStart + " " + sunProtEndStop + " " + result[i].currentAction + " " + result[i].shutterName);
                //}
            }
        }
    }, 2000);
}
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
const calcPos = schedule.scheduleJob('calcPosTimer', '*/5 * * * *', function () {
    sunPos();
});

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

        }
    }
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
}
function main(adapter) {
    //adapter.log.debug(JSON.stringify(adapter.config.events))

    /**
     * @param {any} err
     * @param {any} obj
     */
    adapter.getForeignObject('system.config', (err, obj) => {
        checkStates();
    });
    timer = setTimeout(function () {
        adapter.log.debug('1111');
        checkActualStates();
        sunPos();
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

    /*
    all shutters[{
        "enabled": true,
        "shutterName": "shutter example",
        "name": "hm-rpc.0.MEQ1234567.2.LEVEL",
        "triggerID": "",
        "typeUp": "living-auto",
        "typeDown": "living-auto",
        "type": "in- & outside temperature",
        "heightDownSun": "50",
        "direction": "290",
        "directionRange": "15",
        "tempInside": "23",
        "tempSensor": "",
        "outsideTempSensor": "",
        "tempOutside": "23",
        "lightSensor": "",
        "valueLight": "15",
        "heightUp": "100",
        "heightDown": "0",
        "triggerState": "true",
        "triggerDrive": "100",
        "triggerChange": "upDown",
        "elevation": "4",
        "autoDrive": "onlyUp",
        "hysteresisOutside": "",
        "hysteresisInside": "",
        "hysteresisLight": "",
        "currentAction": "",
        "currentHeight": "",
        "triggerHeight": ""
    }]
    */


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
                }
            });
        }
    }
}



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

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}