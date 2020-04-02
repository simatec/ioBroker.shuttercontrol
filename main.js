'use strict';

const utils = require('@iobroker/adapter-core');
const schedule  = require('node-schedule');
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
let resTrigger = [];
let resSunTrigger = [];
let resSunInsideTemp = [];
let resSunOutsideTemp = [];
let resSunLight = [];
/** @type {any} */
let resTriggerChange;
let resShutterChange;
let resSunTriggerChange;

let azimuth;
/** @type {number} */
let elevation;
let ObjautoUp = [];
let ObjautoDown = [];
let ObjautoSun = [];
let resShutterState = [];

/**
 * Starts the adapter instance
 * @param {Partial<ioBroker.AdapterOptions>} [options]
 */
function startAdapter(options) {

    options = options || {};
    Object.assign(options, {name: adapterName});

    adapter = new utils.Adapter(options);
 
    // start here!
    adapter.on('ready', main); // Main method defined below for readability

    // is called when adapter shuts down - callback has to be called under any circumstances!
    adapter.on('unload', (callback) => {
        try {
            adapter.log.info('cleaned everything up...');
            callback();
        } catch (e) {
            callback();
        }
    });
    // is called if a subscribed state changes
    adapter.on('stateChange', (id, state) => {
        if (state) {

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
                adapter.setState('control.autoLiving', {val: state.val, ack: true});
                adapter.log.debug('Auto Living is: ' + state.val);
            }
            if (id === adapter.config.triggerAutoSleep) {
                adapter.setState('control.autoSleep', {val: state.val, ack: true});
                adapter.log.debug('Auto Sleep is: ' + state.val);
            }
            
            resTrigger.forEach(function(resultTriggerID) {
                if (id === resultTriggerID && state.ts === state.lc) {
                    resTriggerChange = resultTriggerID;
                    adapter.log.debug('TriggerID changed: ' +  resultTriggerID);
                    triggerChange();
                }
            });
            
            resSunInsideTemp.forEach(function(resSunInsideTempID) {
                if (id === resSunInsideTempID  && state.ts === state.lc) {
                    adapter.log.debug('insidetemperature changed: ' +  resSunInsideTempID + ' Value: ' + state.val);
                    sunProtect();
                }
            });
            
            resSunOutsideTemp.forEach(function(resSunOutsideTempID) {
                if (id === resSunOutsideTempID  && state.ts === state.lc) {
                    adapter.log.debug('outsidetemperature changed: ' +  resSunOutsideTempID + ' Value: ' + state.val);
                    sunProtect();
                }
            });
            resSunLight.forEach(function(resSunLightID) {
                if (id === resSunLightID  && state.ts === state.lc) {
                    adapter.log.debug('Lightsensor changed: ' + resSunLightID + ' Value: ' + state.val);
                    sunProtect();
                }
            });
            resShutterState.forEach(function(resShutterID) {
                if (id === resShutterID  && state.ts === state.lc) {
                    resShutterChange = resShutterID;
                    adapter.log.debug('shutter state changed: ' + resShutterID);
                    //shutterState();
                }
            });
            
            if (id === adapter.namespace + '.info.Azimut') {
                sunProtect();
            }
            
            if (id === adapter.namespace + '.info.Elevation' ) {
                elevationDown();
            }   
        }
    });
}
function shutterState(shutterID) {
    if (adapter.config.currentShutterState == true) {
        const resultID = adapter.config.events;
        // Filter changed Name
        const result = resultID.filter(d => d.name == shutterID);
        setTimeout(function() {
            for ( const i in result) {
                adapter.getForeignState(result[i].name, (err, state) => {
                    if (state && result[i].currentHeight != state.val) {
                        result[i].currentHeight = state.val;
                        adapter.log.debug('save current height after State Check: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                    }
                });
            }
        },60000)
    }
}

function triggerChange() {
    
    const resultID = adapter.config.events;
    // Filter changed Trigger
    const arrayChangeTrigger = resultID.filter(d => d.triggerID == resTriggerChange);
    
    for ( const i in arrayChangeTrigger) {
        setTimeout(function() {
            if (arrayChangeTrigger[i].triggerChange == 'onlyUp' || arrayChangeTrigger[i].triggerChange == 'upDown') {
                let nameDevice = arrayChangeTrigger[i].shutterName.replace(/[.;, ]/g, '_');
                adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                    if (state && state === true || state && state.val === true) {
                        let currentValue = '';
                        adapter.getForeignState(arrayChangeTrigger[i].triggerID, (err, state) => {
                            let mustValue = ('' + arrayChangeTrigger[i].triggerState);
                            if (state) {
                                currentValue = ('' + state.val);
                            }
                            if (currentValue != mustValue) {
                                adapter.getForeignState(arrayChangeTrigger[i].name, (err, state) => {
                                    if (state.val != arrayChangeTrigger[i].triggerDrive && state.val < arrayChangeTrigger[i].triggerDrive) {
                                        arrayChangeTrigger[i].triggerHeight = (state.val);
                                        adapter.log.debug('save trigger height: ' + arrayChangeTrigger[i].triggerHeight + '%')
                                        adapter.log.debug('Set ID: ' + arrayChangeTrigger[i].shutterName + ' value: ' + arrayChangeTrigger[i].triggerDrive + '%')
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
                adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                    if (state && state === true || state && state.val === true) {
                        adapter.getForeignState(arrayChangeTrigger[i].triggerID, (err, state) => {
                            let currentValue = ('' + state.val);
                            let mustValue = ('' + arrayChangeTrigger[i].triggerState);
                            if (currentValue === mustValue) {
                                adapter.getForeignState(arrayChangeTrigger[i].name, (err, state) => {
                                    if (state.val != arrayChangeTrigger[i].triggerHeight && state.val == arrayChangeTrigger[i].triggerDrive && arrayChangeTrigger[i].currentHeight == arrayChangeTrigger[i].triggerDrive) {
                                        adapter.log.debug('change to last height: ' + arrayChangeTrigger[i].triggerHeight + '%')
                                        adapter.log.debug('Set ID: ' + arrayChangeTrigger[i].shutterName + ' value: ' + arrayChangeTrigger[i].triggerHeight + '%')
                                        adapter.setForeignState(arrayChangeTrigger[i].name, parseFloat(arrayChangeTrigger[i].triggerHeight), false);
                                        arrayChangeTrigger[i].currentHeight = arrayChangeTrigger[i].triggerHeight;
                                        shutterState(arrayChangeTrigger[i].name);
                                    }
                                });
                            }
                        });
                    }
                });
            }
        }, 1000 * i, i);
    }
}

function checkStates() {
    adapter.getState('control.Holiday', (err, state) => {
        if (state === null || state.val === null) {
            adapter.setState('control.Holiday', {val: false, ack: true});
        }
    });
    adapter.getState('control.autoLiving', (err, state) => {
        if (state === null || state.val === null) {
            adapter.setState('control.autoLiving', {val: false, ack: true});
        }
    });
    adapter.getState('control.autoSleep', (err, state) => {
        if (state === null || state.val === null) {
            adapter.setState('control.autoSleep', {val: false, ack: true});
        }
    });
};
function checkActualStates () {
    adapter.getState('control.Holiday', (err, state) => {
        if (state) {
            HolidayStr = state.val;
        }
    });
    adapter.getState('control.autoLiving', (err, state) => {
        if (state) {
            autoLivingStr = state.val;
        }
    });
    adapter.getState('control.autoSleep', (err, state) => {
        if (state) {
            autoSleepStr = state.val;
        }
    });
    if (adapter.config.publicHolidays === true && (adapter.config.publicHolInstance != 'none' || adapter.config.publicHolInstance != '')) {
        adapter.getForeignState(adapter.config.publicHolInstance + '.heute.boolean', (err, state) => {
            if (state) {
                publicHolidayStr = state.val;
            }
        });
        adapter.getForeignState(adapter.config.publicHolInstance + '.morgen.boolean', (err, state) => {
            if (state) {
                publicHolidayTomorowStr = state.val;
            }
        });
    }
    adapter.getForeignObjects(adapter.namespace + ".shutters.autoUp.*", 'state', function (err, list) {
        if (err) {
            adapter.log.error(err);
        } else {
            ObjautoUp = list;
        }
    });
    adapter.getForeignObjects(adapter.namespace + ".shutters.autoDown.*", 'state', function (err, list) {
        if (err) {
            adapter.log.error(err);
        } else {
            ObjautoDown = list;
        }
    });
    adapter.getForeignObjects(adapter.namespace + ".shutters.autoSun.*", 'state', function (err, list) {
        if (err) {
            adapter.log.error(err);
        } else {
            ObjautoSun = list;
        }
    });
    setTimeout(function() {
        shutterDriveCalc();
        createShutter();
    }, 1000)
}

const calc = schedule.scheduleJob('calcTimer', '30 2 * * *', function() {
    shutterDriveCalc();
});

function shutterDriveCalc() {
    // get today's sunlight times 
    let times = SunCalc.getTimes(new Date(), adapter.config.latitude, adapter.config.longitude);

    // format sunset/sunrise time from the Date object
    sunsetStr = ('0' + times.sunset.getHours()).slice(-2) + ':' + ('0' + times.sunset.getMinutes()).slice(-2);
    sunriseStr = ('0' + times.sunrise.getHours()).slice(-2) + ':' + ('0' + times.sunrise.getMinutes()).slice(-2);
    dayStr = times.sunrise.getDay();

    // format goldenhour/goldenhourend time from the Date object
    goldenHour = ('0' + times.goldenHour.getHours()).slice(-2) + ':' + ('0' + times.goldenHour.getMinutes()).slice(-2);
    goldenHourEnd = ('0' + times.goldenHourEnd.getHours()).slice(-2) + ':' + ('0' + times.goldenHourEnd.getMinutes()).slice(-2);

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
    addMinutesGoldenHour(goldenHour, adapter.config.astroDelayUp); // Add Delay for GoldenHour
    addMinutesGoldenHourEnd(goldenHourEnd, adapter.config.astroDelayDown); // Add Delay for GoldenHourEnd

    adapter.log.debug('Starting up shutters GoldenHour area: ' + goldenHourEnd);
    adapter.log.debug('Shutdown shutters GoldenHour area: ' + goldenHour);
    adapter.log.debug('Starting up shutters Sunrise area: ' + sunriseStr);
    adapter.log.debug('Shutdown shutters Sunset area: ' + sunsetStr);

    shutterGoldenHour();
    shutterSunriseSunset();

    switch(adapter.config.livingAutomatic) {
        case 'livingSunriseSunset' :
            astroTimeLivingUp = sunriseStr;
            astroTimeLivingDown = sunsetStr;
            break;
        case 'livingGoldenHour' :
            astroTimeLivingUp = goldenHourEnd;
            astroTimeLivingDown = goldenHour;
            break;
    }
    switch(adapter.config.sleepAutomatic) {
        case 'sleepSunriseSunset' :
            astroTimeSleepUp = sunriseStr;
            astroTimeSleepDown = sunsetStr;
            break;
        case 'sleepGoldenHour' :
            astroTimeSleepUp = goldenHourEnd;
            astroTimeSleepDown = goldenHour;
            break;
    }
    /*
    if (adapter.config.livingAutomatic == 'livingSunriseSunset') {
        astroTimeLivingUp = sunriseStr;
        astroTimeLivingDown = sunsetStr;
    } else if (adapter.config.livingAutomatic == "livingGoldenHour") {
        astroTimeLivingUp = goldenHourEnd;
        astroTimeLivingDown = goldenHour;
    }
    if (adapter.config.sleepAutomatic == "sleepSunriseSunset") {
        astroTimeSleepUp = sunriseStr;
        astroTimeSleepDown = sunsetStr;
    } else if (adapter.config.livingAutomatic == "sleepGoldenHour") {
        astroTimeSleepUp = goldenHourEnd;
        astroTimeSleepDown = goldenHour;
    }
    */

    // ******** Set Up-Time Living Area ********
    switch(adapter.config.livingAutomatic) {
        case 'livingTime' :
            if ((dayStr) == 6 || (dayStr) == 0 || (HolidayStr) === true || (publicHolidayStr) === true) {
                upTimeLiving = adapter.config.WE_shutterUpLiving;
                adapter.setState('info.upTimeLiving', { val: upTimeLiving, ack: true });
            } else {
                upTimeLiving = adapter.config.W_shutterUpLivingMax;
                adapter.setState('info.upTimeLiving', { val: upTimeLiving, ack: true });
            }
        break;
        default:
            if ((dayStr) == 6 || (dayStr) == 0 || (HolidayStr) === true || (publicHolidayStr) === true) {
                upTimeLiving = adapter.config.WE_shutterUpLiving;
                adapter.setState('info.upTimeLiving', { val: upTimeLiving, ack: true });
            } else {
                if ((dayStr) < 6 && (dayStr) > 0 && (astroTimeLivingUp) > (adapter.config.W_shutterUpLivingMax)) {
                    upTimeLiving = adapter.config.W_shutterUpLivingMax;
                    adapter.setState('info.upTimeLiving', { val: upTimeLiving, ack: true });
                } else if ((dayStr) < 6 && (dayStr) > 0 && (astroTimeLivingUp) > (adapter.config.W_shutterUpLivingMin) && (astroTimeLivingUp) < (adapter.config.W_shutterUpLivingMax)) {
                    upTimeLiving = astroTimeLivingUp;
                    adapter.setState('info.upTimeLiving', { val: upTimeLiving, ack: true });
                } else if ((dayStr) < 6 && (dayStr) > 0 && (adapter.config.W_shutterUpLivingMin) == (adapter.config.W_shutterUpLivingMax)) {
                    upTimeLiving = adapter.config.W_shutterUpLivingMax;
                    adapter.setState('info.upTimeLiving', { val: upTimeLiving, ack: true });
                } else if ((dayStr) < 6 && (dayStr) > 0 && (astroTimeLivingUp) == (adapter.config.W_shutterUpLivingMax)) {
                        upTimeLiving = astroTimeLivingUp;
                        adapter.setState('info.upTimeLiving', { val: upTimeLiving, ack: true });
                } else if ((dayStr) < 6 && (dayStr) > 0 && (astroTimeLivingUp) < (adapter.config.W_shutterUpLivingMin)) {
                    upTimeLiving = adapter.config.W_shutterUpLivingMin;
                    adapter.setState('info.upTimeLiving', { val: upTimeLiving, ack: true });
                }
            }
        break;
    }
    adapter.log.debug('Starting up shutters living area: ' + upTimeLiving);
    shutterUpLiving();

    // ******** Set Up-Time Sleep Area ********
    switch(adapter.config.sleepAutomatic) {
        case 'sleepTime' :
            if ((dayStr) == 6 || (dayStr) == 0 || (HolidayStr) === true || (publicHolidayStr) === true) {
                upTimeSleep = adapter.config.WE_shutterUpSleep;
                adapter.setState('info.upTimeSleep', { val: upTimeSleep, ack: true });
            } else {
                upTimeSleep = adapter.config.W_shutterUpSleepMax;
                adapter.setState('info.upTimeSleep', { val: upTimeSleep, ack: true });
            }
        break;
        default:
            if ((dayStr) == 6 || (dayStr) == 0 || (HolidayStr) === true || (publicHolidayStr) === true) {
                upTimeSleep = adapter.config.WE_shutterUpSleep;
                adapter.setState('info.upTimeSleep', { val: upTimeSleep, ack: true });
            } else {
                if ((dayStr) < 6 && (dayStr) > 0 && (astroTimeSleepUp) > (adapter.config.W_shutterUpSleepMax)) {
                    upTimeSleep = adapter.config.W_shutterUpSleepMax;
                    adapter.setState('info.upTimeSleep', { val: upTimeSleep, ack: true });
                } else if ((dayStr) < 6 && (dayStr) > 0 && (astroTimeSleepUp) > (adapter.config.W_shutterUpSleepMin) && (astroTimeSleepUp) < (adapter.config.W_shutterUpSleepMax)) {
                    upTimeSleep = astroTimeSleepUp;
                    adapter.setState('info.upTimeSleep', { val: upTimeSleep, ack: true });
                } else if ((dayStr) < 6 && (dayStr) > 0 && (adapter.config.W_shutterUpSleepMin) == (adapter.config.W_shutterUpSleepMax)) {
                    upTimeSleep = adapter.config.W_shutterUpSleepMax;
                    adapter.setState('info.upTimeSleep', { val: upTimeSleep, ack: true });
                } else if ((dayStr) < 6 && (dayStr) > 0 && (astroTimeSleepUp) == (adapter.config.W_shutterUpSleepMax)) {
                        upTimeSleep = astroTimeSleepUp;
                        adapter.setState('info.upTimeSleep', { val: upTimeSleep, ack: true });
                } else if ((dayStr) < 6 && (dayStr) > 0 && (astroTimeSleepUp) < (adapter.config.W_shutterUpSleepMin)) {
                    upTimeSleep = adapter.config.W_shutterUpSleepMin;
                    adapter.setState('info.upTimeSleep', { val: upTimeSleep, ack: true });
                }
            }
        break;
    }
    adapter.log.debug('Starting up shutters sleep area: ' + upTimeSleep);
    shutterUpSleep();

    // ******** Set Down-Time Living Area ********
    switch(adapter.config.livingAutomatic) {
        case 'livingTime' :
            if ((dayStr) == 6 || (dayStr) == 0 || (HolidayStr) === true || (publicHolidayStr) === true) {
                downTimeLiving = adapter.config.WE_shutterDownLiving;
                adapter.setState('info.downTimeLiving', { val: downTimeLiving, ack: true });
            } else {
                downTimeLiving = adapter.config.W_shutterDownLiving;
                adapter.setState('info.downTimeLiving', { val: downTimeLiving, ack: true });
            }
        break;
        default:
            if (((dayStr) == 5 || (dayStr) == 6 || (HolidayStr) === true || (publicHolidayTomorowStr) === true) && (adapter.config.WE_shutterDownLiving) < (astroTimeLivingDown)) {
                downTimeLiving = adapter.config.WE_shutterDownLiving;
                adapter.setState('info.downTimeLiving', { val: downTimeLiving, ack: true });
            } else if (((dayStr) == 5 || (dayStr) == 6 || (HolidayStr) === true || (publicHolidayTomorowStr) === true) && (adapter.config.WE_shutterDownLiving) > (astroTimeLivingDown)) {
                downTimeLiving = astroTimeLivingDown;
                adapter.setState('info.downTimeLiving', { val: downTimeLiving, ack: true });
            } else if (((dayStr) == 5 || (dayStr) == 6 || (HolidayStr) === true || (publicHolidayTomorowStr) === true) && (adapter.config.WE_shutterDownLiving) == (astroTimeLivingDown)) {
                downTimeLiving = astroTimeLivingDown;
                adapter.setState('info.downTimeLiving', { val: downTimeLiving, ack: true });
            } else if (((dayStr) < 5 || (dayStr) == 0) && (astroTimeLivingDown) > (adapter.config.W_shutterDownLiving)) {
                downTimeLiving = adapter.config.W_shutterDownLiving;
                adapter.setState('info.downTimeLiving', { val: downTimeLiving, ack: true });
            } else if (((dayStr) < 5 || (dayStr) == 0) && (astroTimeLivingDown) < (adapter.config.W_shutterDownLiving)) {
                downTimeLiving = astroTimeLivingDown;
                adapter.setState('info.downTimeLiving', { val: downTimeLiving, ack: true });
            } else if (((dayStr) < 5 || (dayStr) == 0) && (astroTimeLivingDown) == (adapter.config.W_shutterDownLiving)) {
                    downTimeLiving = astroTimeLivingDown;
                    adapter.setState('info.downTimeLiving', { val: downTimeLiving, ack: true });
            }
        break;
    }
    adapter.log.debug('Shutdown shutters living area: ' + downTimeLiving);
    shutterDownLiving();

    // ******** Set Down-Time Sleep Area ******** 
    switch(adapter.config.sleepAutomatic) {
        case 'sleepTime' :
            if ((dayStr) == 6 || (dayStr) == 0 || (HolidayStr) === true || (publicHolidayStr) === true) {
                downTimeSleep = adapter.config.WE_shutterDownSleep;
                adapter.setState('info.downTimeSleep', { val: downTimeSleep, ack: true });
            } else {
                downTimeSleep = adapter.config.W_shutterDownSleep;
                adapter.setState('info.downTimeSleep', { val: downTimeSleep, ack: true });
            }
        break;
        default:
            if (((dayStr) == 5 || (dayStr) == 6 || (HolidayStr) === true || (publicHolidayTomorowStr) === true) && (adapter.config.WE_shutterDownSleep) < (astroTimeSleepDown)) {
                downTimeSleep = adapter.config.WE_shutterDownSleep;
                adapter.setState('info.downTimeSleep', { val: downTimeSleep, ack: true });
            } else if (((dayStr) == 5 || (dayStr) == 6 || (HolidayStr) === true || (publicHolidayTomorowStr) === true) && (adapter.config.WE_shutterDownSleep) > (astroTimeSleepDown)) {
                downTimeSleep = astroTimeSleepDown;
                adapter.setState('info.downTimeSleep', { val: downTimeSleep, ack: true });
            } else if (((dayStr) == 5 || (dayStr) == 6 || (HolidayStr) === true || (publicHolidayTomorowStr) === true) && (adapter.config.WE_shutterDownSleep) == (astroTimeSleepDown)) {
                downTimeSleep = astroTimeSleepDown;
                adapter.setState('info.downTimeSleep', { val: downTimeSleep, ack: true });
            } else if (((dayStr) < 5 || (dayStr) == 0) && (astroTimeSleepDown) > (adapter.config.W_shutterDownSleep)) {
                downTimeSleep = adapter.config.W_shutterDownSleep;
                adapter.setState('info.downTimeSleep', { val: downTimeSleep, ack: true });
            } else if (((dayStr) < 5 || (dayStr) == 0) && (astroTimeSleepDown) < (adapter.config.W_shutterDownSleep)) {
                downTimeSleep = astroTimeSleepDown;
                adapter.setState('info.downTimeSleep', { val: downTimeSleep, ack: true });
            } else if (((dayStr) < 5 || (dayStr) == 0) && (astroTimeSleepDown) == (adapter.config.W_shutterDownSleep)) {
                    downTimeSleep = astroTimeSleepDown;
                    adapter.setState('info.downTimeSleep', { val: downTimeSleep, ack: true });
            }
        break;
    }
    adapter.log.debug('Shutdown shutters sleep area: ' + downTimeSleep);
    shutterDownSleep();

    delayCalc();
}
function elevationDown(){
    // Full Result
    const resultFull = adapter.config.events;

    if (resultFull) {
        const driveDelayUpAstro = adapter.config.driveDelayUpAstro * 1000;
        // Filter Area Living
        const resLiving = resultFull.filter(d => d.typeDown == 'elevation');
        // Filter enabled
        let resEnabled = resLiving.filter(d => d.enabled === true);

        let result = resEnabled;

        for ( const i in result) {
            let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
            adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                if (state && state === true || state && state.val === true) {
                    let elevationEnd = (result[i].elevation - 1);
                    if (elevation <= result[i].elevation && elevation >= elevationEnd && result[i].currentAction != 'down' && azimuth > 180) {
                        setTimeout(function() {
                            let currentValue = '';
                            adapter.getForeignState(result[i].triggerID, (err, state) => {
                                let mustValue = ('' + result[i].triggerState);
                                if (state) {
                                    currentValue = ('' + state.val);
                                }
                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp' && result[i].autoDrive != 'off')) {
                                    adapter.getForeignState(result[i].name, (err, state) => {
                                        if (state && state.val != result[i].heightDown)  {
                                            adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%')
                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                            result[i].currentHeight = result[i].heightDown;
                                            result[i].currentAction = 'down';
                                            adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                            shutterState(result[i].name);
                                        }
                                    });
                                } else if (result[i].triggerID == '') {
                                    adapter.getForeignState(result[i].name, (err, state) => {
                                        if (state && state.val != result[i].heightDown)  {
                                            adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%')
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
    setTimeout(function() {
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
        
        const upGoldenHour = schedule.scheduleJob('shutterUpGoldenHourEnd', upTime[1] + ' ' + upTime[0] + ' * * *', function() {
            // Full Result
            const resultFull = adapter.config.events;

            if (resultFull) {
                // Filter Area Living
                const resLiving = resultFull.filter(d => d.typeUp == 'goldenhour End');
                // Filter enabled
                let resEnabled = resLiving.filter(d => d.enabled === true);

                let result = resEnabled;

                for ( const i in result) {
                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                    adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {
                            setTimeout(function() {
                                let shutterHeight = 0;
                                if (result[i].currentAction == 'sunProtect') {
                                    shutterHeight = parseFloat(result[i].heightDownSun);
                                } else {
                                    shutterHeight = parseFloat(result[i].heightUp);
                                    result[i].currentAction = 'up';
                                }
                                let currentValue = '';
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    let mustValue = ('' + result[i].triggerState);
                                    if (state) {
                                        currentValue = ('' + state.val);
                                    }
                                    if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].autoDrive != 'off')) {
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (state && state.val != shutterHeight)  {
                                                adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%')
                                                adapter.setForeignState(result[i].name, shutterHeight, false);
                                                result[i].currentHeight = shutterHeight;
                                                adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                shutterState(result[i].name);
                                            }
                                        });
                                    } else if (result[i].triggerID == '') {
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (state && state.val != shutterHeight)  {
                                                adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%')
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
        
        const downGoldenHour = schedule.scheduleJob('shutterDownGoldenHour', upTime[1] + ' ' + upTime[0] + ' * * *', function() {
            // Full Result
            const resultFull = adapter.config.events;

            if (resultFull) {
                // Filter Area Living
                const resLiving = resultFull.filter(d => d.typeDown == 'goldenhour');
                // Filter enabled
                let resEnabled = resLiving.filter(d => d.enabled === true);

                let result = resEnabled;

                for ( const i in result) {
                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                    adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {
                            setTimeout(function() {
                                let currentValue = '';
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    let mustValue = ('' + result[i].triggerState);
                                    if (state) {
                                        currentValue = ('' + state.val);
                                    }
                                    if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp' && result[i].autoDrive != 'off')) {
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (state && state.val != result[i].heightDown)  {
                                                adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%')
                                                adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                result[i].currentHeight = result[i].heightDown;
                                                result[i].currentAction = 'down';
                                                adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                shutterState(result[i].name);
                                            }
                                        });
                                    } else if (result[i].triggerID == '') {
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (state && state.val != result[i].heightDown)  {
                                                adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%')
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
        
        const upSunrise = schedule.scheduleJob('shutterUpSunrise', upTime[1] + ' ' + upTime[0] + ' * * *', function() {
            // Full Result
            const resultFull = adapter.config.events;

            if (resultFull) {
                // Filter Area Living
                const resLiving = resultFull.filter(d => d.typeUp == 'sunrise');
                // Filter enabled
                let resEnabled = resLiving.filter(d => d.enabled === true);

                let result = resEnabled;

                for ( const i in result) {
                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                    adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {
                            setTimeout(function() {
                                let shutterHeight = 0;
                                if (result[i].currentAction == 'sunProtect') {
                                    shutterHeight = parseFloat(result[i].heightDownSun);
                                } else {
                                    shutterHeight = parseFloat(result[i].heightUp);
                                    result[i].currentAction = 'up';
                                }
                                let currentValue = '';
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    let mustValue = ('' + result[i].triggerState);
                                    if (state) {
                                        currentValue = ('' + state.val);
                                    }
                                    if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].autoDrive != 'off')) {
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (state && state.val != shutterHeight)  {
                                                adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%')
                                                adapter.setForeignState(result[i].name, shutterHeight, false);
                                                result[i].currentHeight = shutterHeight;
                                                adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                shutterState(result[i].name);
                                            }
                                        });
                                    } else if (result[i].triggerID == '') {
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (state && state.val != shutterHeight)  {
                                                adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%')
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

        let upTime = sunsetStr.split(':');

        schedule.cancelJob('shutterDownSunset');
        
        const downSunset = schedule.scheduleJob('shutterDownSunset', upTime[1] + ' ' + upTime[0] + ' * * *', function() {
            // Full Result
            const resultFull = adapter.config.events;

            if (resultFull) {
                // Filter Area Living
                const resLiving = resultFull.filter(d => d.typeDown == 'sunset');
                // Filter enabled
                let resEnabled = resLiving.filter(d => d.enabled === true);

                let result = resEnabled;

                for ( const i in result) {
                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                    adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {
                            setTimeout(function() {
                                let currentValue = '';
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    let mustValue = ('' + result[i].triggerState);
                                    if (state) {
                                        currentValue = ('' + state.val);
                                    }
                                    if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp' && result[i].autoDrive != 'off')) {
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (state && state.val != result[i].heightDown)  {
                                                adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%')
                                                adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                result[i].currentHeight = result[i].heightDown;
                                                result[i].currentAction = 'down';
                                                adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                shutterState(result[i].name);
                                            }
                                        });
                                    } else if (result[i].triggerID == '') {
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (state && state.val != result[i].heightDown)  {
                                                adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%')
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

// Add delay Time for Sunrise
function addMinutesSunrise(time, minsToAdd) {
    function D(J){ return (J<10? '0':'') + J;};
    const piece = time.split(':');
    const mins = piece[0]*60 + +piece[1] + +minsToAdd;
    sunriseStr = (D(mins%(24*60)/60 | 0) + ':' + D(mins%60));
    return D(mins%(24*60)/60 | 0) + ':' + D(mins%60);
}
// Add delay Time for Sunset
function addMinutesSunset(time, minsToAdd) {
    function D(J){ return (J<10? '0':'') + J;};
    const piece = time.split(':');
    const mins = piece[0]*60 + +piece[1] + +minsToAdd;
    sunsetStr = (D(mins%(24*60)/60 | 0) + ':' + D(mins%60));
    return D(mins%(24*60)/60 | 0) + ':' + D(mins%60);
}
// Add delay Time for GoldenHour
function addMinutesGoldenHour(time, minsToAdd) {
    function D(J){ return (J<10? '0':'') + J;};
    const piece = time.split(':');
    const mins = piece[0]*60 + +piece[1] + +minsToAdd;
    goldenHour = (D(mins%(24*60)/60 | 0) + ':' + D(mins%60));
    return D(mins%(24*60)/60 | 0) + ':' + D(mins%60);
}
// Add delay Time for GoldenHour
function addMinutesGoldenHourEnd(time, minsToAdd) {
    function D(J){ return (J<10? '0':'') + J;};
    const piece = time.split(':');
    const mins = piece[0]*60 + +piece[1] + +minsToAdd;
    goldenHourEnd = (D(mins%(24*60)/60 | 0) + ':' + D(mins%60));
    return D(mins%(24*60)/60 | 0) + ':' + D(mins%60);
}

function shutterUpLiving() {
    
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving * 1000;
    
    if ((upTimeLiving) == undefined) {
        upTimeLiving = adapter.config.W_shutterUpLivingMax;
    }
    let upTime = upTimeLiving.split(':');
    let timeoutLivingAuto;

    schedule.cancelJob('shutterUpLiving');
    
    const upLiving = schedule.scheduleJob('shutterUpLiving', upTime[1] + ' ' + upTime[0] + ' * * *', function() {
        // Full Result
        const resultFull = adapter.config.events;

        if (resultFull) {
            // Filter Area Living
            const resLiving = resultFull.filter(d => d.typeUp == 'living');
            // Filter enabled
            let resEnabled = resLiving.filter(d => d.enabled === true);

            let result = resEnabled;
            let number = 0;

            for ( const i in result) {
                    number++;
            }

            timeoutLivingAuto = number * driveDelayUpLiving;

            for ( const i in result) {
                let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                    if (state && state === true || state && state.val === true) {
                        setTimeout(function() {
                            let shutterHeight = 0;
                            if (result[i].currentAction == 'sunProtect') {
                                shutterHeight = parseFloat(result[i].heightDownSun);
                            } else {
                                shutterHeight = parseFloat(result[i].heightUp);
                                result[i].currentAction = 'up';
                            }
                            let currentValue = '';
                            adapter.getForeignState(result[i].triggerID, (err, state) => {
                                let mustValue = ('' + result[i].triggerState);
                                if (state) {
                                    currentValue = ('' + state.val);
                                }
                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].autoDrive != 'off')) {
                                    adapter.getForeignState(result[i].name, (err, state) => {
                                        if (state && state.val != shutterHeight)  {
                                            adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%')
                                            adapter.setForeignState(result[i].name, shutterHeight, false);
                                            result[i].currentHeight = shutterHeight;
                                            adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                            shutterState(result[i].name);
                                        }
                                    });
                                } else if (result[i].triggerID == '') {
                                    adapter.getForeignState(result[i].name, (err, state) => {
                                        if (state && state.val != shutterHeight)  {
                                            adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%')
                                            adapter.setForeignState(result[i].name, shutterHeight, false);
                                            result[i].currentHeight = shutterHeight;
                                            adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
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
            setTimeout(function() {
                // Filter Area Living Auto
                if (resultFull) {
                    const resLivingAuto = resultFull.filter(d => d.typeUp == 'living-auto');
                    // Filter enabled
                    let resEnabled = resLivingAuto.filter(d => d.enabled === true);

                    let result = resEnabled;

                    for ( const i in result) {
                        let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                        adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                            if (state && state === true || state && state.val === true) {
                                setTimeout(function() {
                                    let shutterHeight = 0;
                                    if (result[i].currentAction == 'sunProtect') {
                                        shutterHeight = parseFloat(result[i].heightDownSun);
                                    } else {
                                        shutterHeight = parseFloat(result[i].heightUp);
                                        result[i].currentAction = 'up';
                                    }
                                    let currentValue = '';
                                    adapter.getForeignState(result[i].triggerID, (err, state) => {
                                        let mustValue = ('' + result[i].triggerState);
                                        if (state) {
                                            currentValue = ('' + state.val);
                                        }
                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].autoDrive != 'off')) {
                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                if (state && state.val != shutterHeight)  {
                                                    adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%')
                                                    adapter.setForeignState(result[i].name, shutterHeight, false);
                                                    result[i].currentHeight = shutterHeight;
                                                    adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                    shutterState(result[i].name);
                                                }
                                            });
                                        } else if (result[i].triggerID == '') {
                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                if (state && state.val != shutterHeight)  {
                                                    adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%')
                                                    adapter.setForeignState(result[i].name, shutterHeight, false);
                                                    result[i].currentHeight = shutterHeight;
                                                    adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
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
            }, timeoutLivingAuto)
        }
    });
}

function shutterDownLiving() {
    
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving * 1000;

    if ((downTimeLiving) == undefined) {
        downTimeLiving = adapter.config.W_shutterDownLiving
    }
    let downTime = downTimeLiving.split(':');
    let timeoutLivingAuto;

    schedule.cancelJob('shutterDownLiving');
    
    const downLiving = schedule.scheduleJob('shutterDownLiving', downTime[1] + ' ' + downTime[0] + ' * * *', function() {
        // Full Result
        const resultFull = adapter.config.events;

        if (resultFull) {
            // Filter Area Living
            const resLiving = resultFull.filter(d => d.typeDown == 'living');
            // Filter enabled
            let resEnabled = resLiving.filter(d => d.enabled === true);

            let result = resEnabled;
            let number = 0;

            for ( const i in result) {
                number++;
            }

            timeoutLivingAuto = number * driveDelayUpLiving;
            
            for ( const i in result) {
                let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                    if (state && state === true || state && state.val === true) {
                        setTimeout(function() {
                            let currentValue = '';
                            adapter.getForeignState(result[i].triggerID, (err, state) => {
                                let mustValue = ('' + result[i].triggerState);
                                if (state) {
                                    currentValue = ('' + state.val);
                                }
                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp' && result[i].autoDrive != 'off')) {
                                    adapter.getForeignState(result[i].name, (err, state) => {
                                        if (state && state.val != result[i].heightDown)  {
                                            adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%')
                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                            result[i].currentHeight = result[i].heightDown;
                                            result[i].currentAction = 'down';
                                            adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                            shutterState(result[i].name);
                                        }
                                    });
                                } else if (result[i].triggerID == '') {
                                    adapter.getForeignState(result[i].name, (err, state) => {
                                        if (state && state.val != result[i].heightDown)  {
                                            adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%')
                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                            result[i].currentHeight = result[i].heightDown;
                                            result[i].currentAction = 'down';
                                            adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
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
            setTimeout(function() {
                if (resultFull) {
                    // Filter Area Living Auto
                    const resLivingAuto = resultFull.filter(d => d.typeDown == 'living-auto');
                    // Filter enabled
                    let resEnabled = resLivingAuto.filter(d => d.enabled === true);

                    let result = resEnabled;

                    for ( const i in result) {
                        let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                        adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                            if (state && state === true || state && state.val === true) {
                                setTimeout(function() {
                                    let currentValue = '';
                                    adapter.getForeignState(result[i].triggerID, (err, state) => {
                                        let mustValue = ('' + result[i].triggerState);
                                        if (state) {
                                            currentValue = ('' + state.val);
                                        }
                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp' && result[i].autoDrive != 'off')) {
                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                if (state && state.val != result[i].heightDown)  {
                                                    adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%')
                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                    result[i].currentHeight = result[i].heightDown;
                                                    result[i].currentAction = 'down';
                                                    adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                    shutterState(result[i].name);
                                                }
                                            });
                                        } else if (result[i].triggerID == '') {
                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                if (state && state.val != result[i].heightDown)  {
                                                    adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%')
                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                    result[i].currentHeight = result[i].heightDown;
                                                    result[i].currentAction = 'down';
                                                    adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
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
            }, timeoutLivingAuto)
        }
    });
}

function shutterUpSleep() {
    
    const driveDelayUpSleep = adapter.config.driveDelayUpSleep * 1000;
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving * 1000;

    if ((upTimeSleep) == undefined) {
        upTimeSleep = adapter.config.W_shutterUpSleepMax
    }
    let upTime = upTimeSleep.split(':');
    let timeoutSleepAuto;
    
    schedule.cancelJob('shutterUpSleep');

    const upSleep = schedule.scheduleJob('shutterUpSleep', upTime[1] + ' ' + upTime[0] + ' * * *', function() {

        delayUp = delayUp * driveDelayUpLiving;
        setTimeout(function() {
            // Full Result
            const resultFull = adapter.config.events;

            if (resultFull) {
                // Filter Area sleep
                const resSleep = resultFull.filter(d => d.typeUp == 'sleep');
                // Filter enabled
                let resEnabled = resSleep.filter(d => d.enabled === true);

                let result = resEnabled;
                let number = 0;

                for ( const i in result) {
                        number++;
                }

                timeoutSleepAuto = number * driveDelayUpSleep;

                for ( const i in result) {
                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                    adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {
                            setTimeout(function() {
                                let shutterHeight = 0;
                                if (result[i].currentAction == 'sunProtect') {
                                    shutterHeight = parseFloat(result[i].heightDownSun);
                                } else {
                                    shutterHeight = parseFloat(result[i].heightUp);
                                    result[i].currentAction = 'up';
                                }
                                let currentValue = '';
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    let mustValue = ('' + result[i].triggerState);
                                    if (state) {
                                        currentValue = ('' + state.val);
                                    }
                                    if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].autoDrive != 'off')) {
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (state && state.val != shutterHeight)  {
                                                adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%')
                                                adapter.setForeignState(result[i].name, shutterHeight, false);
                                                result[i].currentHeight = shutterHeight;
                                                adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                shutterState(result[i].name);
                                            }
                                        });
                                    } else if (result[i].triggerID == '') {
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (state && state.val != shutterHeight)  {
                                                adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%')
                                                adapter.setForeignState(result[i].name, shutterHeight, false);
                                                result[i].currentHeight = shutterHeight;
                                                adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
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
                setTimeout(function() {
                    // Full Result
                    const resultFull = adapter.config.events;
                    // Filter Area sleep
                    if (resultFull) {
                        const resSleep = resultFull.filter(d => d.typeUp == 'sleep-auto');
                        // Filter enabled
                        let resEnabled = resSleep.filter(d => d.enabled === true);

                        let result = resEnabled;

                        for ( const i in result) {
                            let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                            adapter.getState('shutters.autoUp.' + nameDevice, (err, state) => {
                                if (state && state === true || state && state.val === true) {
                                    setTimeout(function() {
                                        let shutterHeight = 0;
                                        if (result[i].currentAction == 'sunProtect') {
                                            shutterHeight = parseFloat(result[i].heightDownSun);
                                        } else {
                                            shutterHeight = parseFloat(result[i].heightUp);
                                            result[i].currentAction = 'up';
                                        }
                                        let currentValue = '';
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (state) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].autoDrive != 'off')) {
                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                    if (state && state.val != shutterHeight) {
                                                        adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%')
                                                        adapter.setForeignState(result[i].name, shutterHeight, false);
                                                        result[i].currentHeight = shutterHeight;
                                                        adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                        shutterState(result[i].name);
                                                    }
                                                });
                                            } else if (result[i].triggerID == '') {
                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                    if (state && state.val != shutterHeight)  {
                                                        adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + shutterHeight + '%')
                                                        adapter.setForeignState(result[i].name, shutterHeight, false);
                                                        result[i].currentHeight = shutterHeight;
                                                        adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
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
                }, timeoutSleepAuto)
            }
        }, delayUp)
    });
}

function shutterDownSleep() {
    
    const driveDelayUpSleep = adapter.config.driveDelayUpSleep * 1000;
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving * 1000;

    if ((downTimeSleep) == undefined) {
        downTimeSleep = adapter.config.W_shutterDownSleep
    }
    let downTime = downTimeSleep.split(':');
    /** @type {number | undefined} */
    let timeoutSleepAuto;

    schedule.cancelJob('shutterDownSleep');

    const downSleep = schedule.scheduleJob('shutterDownSleep', downTime[1] + ' ' + downTime[0] + ' * * *', function() {
        delayDown = delayDown * driveDelayUpLiving;
        setTimeout(function() {
            // Full Result
            const resultFull = adapter.config.events;

            if (resultFull) {
                // Filter Area sleep
                const resSleep = resultFull.filter(d => d.typeDown == 'sleep');
                // Filter enabled
                let resEnabled = resSleep.filter(d => d.enabled === true);

                let result = resEnabled;
                let number = 0;

                for ( const i in result) {
                    number++;
                }

                timeoutSleepAuto = number * driveDelayUpSleep;

                for ( const i in result) {
                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                    adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {
                            setTimeout(function() {
                                let currentValue = '';
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    let mustValue = ('' + result[i].triggerState);
                                    if (state) {
                                        currentValue = ('' + state.val);
                                    }
                                    if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp' && result[i].autoDrive != 'off')) {
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (state && state.val != result[i].heightDown)  {
                                                adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%')
                                                adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                result[i].currentHeight = result[i].heightDown;
                                                result[i].currentAction = 'down';
                                                adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                shutterState(result[i].name);
                                            }
                                        });
                                    } else if (result[i].triggerID == '') {
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (state && state.val != result[i].heightDown)  {
                                                adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%')
                                                adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                result[i].currentHeight = result[i].heightDown;
                                                result[i].currentAction = 'down';
                                                adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
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
                setTimeout(function() {
                    // Full Result
                    const resultFull = adapter.config.events;

                    if (resultFull) {
                        // Filter Area sleep
                        const resSleep = resultFull.filter(d => d.typeDown == 'sleep-auto');
                        // Filter enabled
                        let resEnabled = resSleep.filter(d => d.enabled === true);

                        let result = resEnabled;

                        for ( const i in result) {
                            let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                            adapter.getState('shutters.autoDown.' + nameDevice, (err, state) => {
                                if (state && state === true || state && state.val === true) {
                                    setTimeout(function() {
                                        let currentValue = '';
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (state) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp' && result[i].autoDrive != 'off')) {
                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                    if (state && state.val != result[i].heightDown)  {
                                                        adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%')
                                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                        result[i].currentHeight = result[i].heightDown;
                                                        result[i].currentAction = 'down';
                                                        adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                        shutterState(result[i].name);
                                                    }
                                                });
                                            } else if (result[i].triggerID == '') {
                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                    if (state && state.val != result[i].heightDown)  {
                                                        adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDown + '%')
                                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                        result[i].currentHeight = result[i].heightDown;
                                                        result[i].currentAction = 'down';
                                                        adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
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
                }, timeoutSleepAuto)
            }
        }, delayDown)
    });
}

function sunProtect() {

    const driveDelayUpSleep = adapter.config.driveDelayUpSleep * 1000;
    
    setTimeout(function() {
        // Full Result
        let resultFull = adapter.config.events;

        if (resultFull) {
            // Filter enabled
            let resEnabled = resultFull.filter(d => d.enabled === true);
            let result = resEnabled;

            if (elevation > adapter.config.sunProtEndElevation) {
                for ( const i in result) {
                    let resultDirectionRangeMinus = 0;
                    let resultDirectionRangePlus = 0;

                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');

                    adapter.getState('shutters.autoSun.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {

                            switch (result[i].type) {
                                case 'in- & outside temperature' : // in- & outside temperature
                                    setTimeout(function() {
                                        let currentValue = '';
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (state) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue && result[i].tempSensor != '' || (currentValue != mustValue && result[i].autoDrive != 'off' && result[i].tempSensor != '') || (result[i].triggerID == '' && result[i].tempSensor != '')) {
                                                let insideTemp;
                                                let outsideTemp;
                                                let sunLight;
                                                adapter.getForeignState(result[i].tempSensor, (err, state) => {
                                                    if (state) {
                                                        insideTemp = parseFloat(state.val);

                                                        adapter.getForeignState(result[i].outsideTempSensor, (err, state) => {
                                                            if (state) {
                                                                outsideTemp = parseFloat(state.val);
                                                            }

                                                            adapter.getForeignState(result[i].lightSensor, (err, state) => {
                                                                if (state) {
                                                                    sunLight = parseFloat(state.val);
                                                                }

                                                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp') || (result[i].triggerID == '')) {
                                                                    if (insideTemp > result[i].tempInside) {
                                                                        if (result[i].tempOutside < outsideTemp || result[i].valueLight < sunLight) {
                                                                            
                                                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                                                if (state) {
                                                                                    if (parseFloat(state.val) > parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                                        result[i].currentAction = 'sunProtect';
                                                                                        adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is active');
                                                                                        adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%')
                                                                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightDownSun), false);
                                                                                        result[i].currentHeight = result[i].heightDownSun;
                                                                                        adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                                        shutterState(result[i].name);
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

                                                                    if (insideTemp < parseFloat(hysteresisInside) || (parseFloat(hysteresisOutside) > outsideTemp && result[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && result[i].lightSensor == '')) {
                                                                        
                                                                        adapter.getForeignState(result[i].name, (err, state) => {
                                                                            if (state) {
                                                                                if (result[i].currentAction == 'sunProtect' && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                                    result[i].currentAction = '';
                                                                                    adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active');
                                                                                    adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightUp + '%')
                                                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                                                                    result[i].currentHeight = result[i].heightUp;
                                                                                    adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                                    shutterState(result[i].name);
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
                                case 'in- & outside temperature and direction' : // in- & outside temperature and direction
                                    resultDirectionRangeMinus = result[i].direction - result[i].directionRange;
                                    resultDirectionRangePlus = parseInt(result[i].direction) + parseInt(result[i].directionRange);
                                    setTimeout(function() {
                                        let currentValue = '';
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (state) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue && result[i].tempSensor != '' || (currentValue != mustValue && result[i].autoDrive != 'off' && result[i].tempSensor != '') || (result[i].triggerID == '' && result[i].tempSensor != '')) {
                                                /** @type {number} */
                                                let insideTemp;
                                                /** @type {number} */
                                                let outsideTemp;
                                                /** @type {number} */
                                                let sunLight;
                                                adapter.getForeignState(result[i].tempSensor, (err, state) => {
                                                    if (state) {
                                                        insideTemp = parseFloat(state.val);

                                                        adapter.getForeignState(result[i].outsideTempSensor, (err, state) => {
                                                            if (state) {
                                                                outsideTemp = parseFloat(state.val);
                                                            }

                                                            adapter.getForeignState(result[i].lightSensor, (err, state) => {
                                                                if (state) {
                                                                    sunLight = parseFloat(state.val);
                                                                }
                                                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp') || (result[i].triggerID == '')) {
                                                                    if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth && insideTemp > result[i].tempInside) {
                                                                        if (result[i].tempOutside < outsideTemp || result[i].valueLight < sunLight) {
                                                                            
                                                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                                                if (state) {
                                                                                    if (parseFloat(state.val) > parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                                        result[i].currentAction = 'sunProtect';
                                                                                        adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is active');
                                                                                        adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%')
                                                                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightDownSun), false);
                                                                                        result[i].currentHeight = result[i].heightDownSun;
                                                                                        adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                                        shutterState(result[i].name);
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

                                                                    if (insideTemp < parseFloat(hysteresisInside) || (resultDirectionRangePlus) < azimuth || (parseFloat(hysteresisOutside) > outsideTemp && result[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && result[i].lightSensor == '')) {
                                                                        
                                                                        adapter.getForeignState(result[i].name, (err, state) => {
                                                                            if (state) {
                                                                                if (result[i].currentAction == 'sunProtect' && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                                    result[i].currentAction = '';
                                                                                    adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active');
                                                                                    adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightUp + '%')
                                                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                                                                    result[i].currentHeight = result[i].heightUp;
                                                                                    adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                                    shutterState(result[i].name);
                                                                                }
                                                                            }
                                                                        });
                                                                    }
                                                                }
                                                            });
                                                        })
                                                    }
                                                });
                                            }
                                        });
                                    }, driveDelayUpSleep * i, i);
                                break;
                                case 'outside temperature and direction' : //outside temperature and direction
                                    resultDirectionRangeMinus = result[i].direction - result[i].directionRange;
                                    resultDirectionRangePlus = parseInt(result[i].direction) + parseInt(result[i].directionRange);
                                    setTimeout(function() {
                                        let currentValue = '';
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (state) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'off') || (result[i].triggerID == '')) {
                                                let outsideTemp;
                                                let sunLight;

                                                adapter.getForeignState(result[i].outsideTempSensor, (err, state) => {
                                                    if (state) {
                                                        outsideTemp = parseFloat(state.val);
                                                    }

                                                    adapter.getForeignState(result[i].lightSensor, (err, state) => {
                                                        if (state) {
                                                            sunLight = parseFloat(state.val);
                                                        }
                                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp') || (result[i].triggerID == '')) {
                                                            if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth) {
                                                                if (result[i].tempOutside < outsideTemp || result[i].valueLight < sunLight) {
                                                                    
                                                                    adapter.getForeignState(result[i].name, (err, state) => {
                                                                        if (state) {
                                                                            if (parseFloat(state.val) > parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                                result[i].currentAction = 'sunProtect';
                                                                                adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is active');
                                                                                adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%')
                                                                                adapter.setForeignState(result[i].name, parseFloat(result[i].heightDownSun), false);
                                                                                result[i].currentHeight = result[i].heightDownSun;
                                                                                adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                                shutterState(result[i].name);
                                                                            }
                                                                        }
                                                                    });
                                                                }
                                                            }
                                                        }
                                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown') || (result[i].triggerID == '')) {
                                                            let hysteresisOutside = (((100 - result[i].hysteresisOutside) / 100) * result[i].tempOutside).toFixed(2);
                                                            let hysteresisLight = (((100 - result[i].hysteresisLight) / 100) * result[i].valueLight).toFixed(2);

                                                            if ((resultDirectionRangePlus) < azimuth || (parseFloat(hysteresisOutside) > outsideTemp && result[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && result[i].lightSensor == '')) {
                                                                
                                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                                    if (state) {
                                                                        if (result[i].currentAction == 'sunProtect' && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                            result[i].currentAction = '';
                                                                            adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active');
                                                                            adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightUp + '%')
                                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                                                            result[i].currentHeight = result[i].heightUp;
                                                                            adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                            shutterState(result[i].name);
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
                                case 'only direction' : //only direction
                                    resultDirectionRangeMinus = result[i].direction - result[i].directionRange;
                                    resultDirectionRangePlus = parseInt(result[i].direction) + parseInt(result[i].directionRange);
                                    setTimeout(function() {
                                        let currentValue = '';
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (state) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'off') || (result[i].triggerID == '')) {
                                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp') || (result[i].triggerID == '')) {
                                                    if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth) {
                                                        
                                                        adapter.getForeignState(result[i].name, (err, state) => {
                                                            if (state) {
                                                                if (parseFloat(state.val) > parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                    result[i].currentAction = 'sunProtect';
                                                                    adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is active');
                                                                    adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%')
                                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightDownSun), false);
                                                                    result[i].currentHeight = result[i].heightDownSun;
                                                                    adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                    shutterState(result[i].name);
                                                                }
                                                            }
                                                        });
                                                    }
                                                }
                                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown') || (result[i].triggerID == '')) {
                                                    if ((resultDirectionRangePlus) < azimuth) {
                                                        
                                                        adapter.getForeignState(result[i].name, (err, state) => {
                                                            if (state) {
                                                                if (result[i].currentAction == 'sunProtect' && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                    result[i].currentAction = '';
                                                                    adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active');
                                                                    adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightUp + '%')
                                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                                                    result[i].currentHeight = result[i].heightUp;
                                                                    adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                    shutterState(result[i].name);
                                                                }
                                                            }
                                                        });
                                                    }
                                                }
                                            }
                                        });
                                    }, driveDelayUpSleep * i, i);
                                break;
                                case 'only outside temperature' : //only outside temperature
                                    setTimeout(function() {
                                        let currentValue = '';
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (state) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'off') || (result[i].triggerID == '')) {
                                                let outsideTemp;
                                                let sunLight;

                                                adapter.getForeignState(result[i].outsideTempSensor, (err, state) => {
                                                    if (state) {
                                                        outsideTemp = parseFloat(state.val);
                                                    }

                                                    adapter.getForeignState(result[i].lightSensor, (err, state) => {
                                                        if (state) {
                                                            sunLight = parseFloat(state.val);
                                                        }
                                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp') || (result[i].triggerID == '')) {
                                                            if (result[i].tempOutside < outsideTemp || result[i].valueLight < sunLight) {
                                                                
                                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                                    if (state) {
                                                                        if (parseFloat(state.val) > parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                            result[i].currentAction = 'sunProtect';
                                                                            adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is active');
                                                                            adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%')
                                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightDownSun), false);
                                                                            result[i].currentHeight = result[i].heightDownSun;
                                                                            adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                            shutterState(result[i].name);
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown') || (result[i].triggerID == '')) {

                                                            let hysteresisOutside = (((100 - result[i].hysteresisOutside) / 100) * result[i].tempOutside).toFixed(2);
                                                            let hysteresisLight = (((100 - result[i].hysteresisLight) / 100) * result[i].valueLight).toFixed(2);

                                                            if ((parseFloat(hysteresisOutside) > outsideTemp && result[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && result[i].lightSensor == '')) {
                                                                
                                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                                    if (state) {
                                                                        if (result[i].currentAction == 'sunProtect' && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                            result[i].currentAction = '';
                                                                            adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active');
                                                                            adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightUp + '%')
                                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                                                            result[i].currentHeight = result[i].heightUp;
                                                                            adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                            shutterState(result[i].name);
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
                                case 'only inside temperature' : //only inside temperature
                                    setTimeout(function() {
                                        let currentValue = '';
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (state) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue && result[i].tempSensor != '' || (currentValue != mustValue && result[i].autoDrive != 'off' && result[i].tempSensor != '') || (result[i].triggerID == '' && result[i].tempSensor != '')) {
                                                let insideTemp;
                                                adapter.getForeignState(result[i].tempSensor, (err, state) => {
                                                    if (state) {
                                                        insideTemp = parseFloat(state.val);

                                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp') || (result[i].triggerID == '')) {
                                                            if (insideTemp > result[i].tempInside) {
                                                                
                                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                                    if (state) {
                                                                        if (parseFloat(state.val) > parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                            result[i].currentAction = 'sunProtect';
                                                                            adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is active');
                                                                            adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%')
                                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightDownSun), false);
                                                                            result[i].currentHeight = result[i].heightDownSun;
                                                                            adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                            shutterState(result[i].name);
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown') || (result[i].triggerID == '')) {
                                                            let hysteresisInside = (((100 - result[i].hysteresisInside) / 100) * result[i].tempInside).toFixed(2);

                                                            if (insideTemp < parseFloat(hysteresisInside)) {
                                                                
                                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                                    if (state) {
                                                                        if (result[i].currentAction == 'sunProtect' && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                            result[i].currentAction = '';
                                                                            adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active');
                                                                            adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightUp + '%')
                                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                                                            result[i].currentHeight = result[i].heightUp;
                                                                            adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                                            shutterState(result[i].name);
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
            let resEnabled = resultFull.filter(d => d.enabled === true);

            let result = resEnabled;
            const sunProtEndStart = parseInt(adapter.config.sunProtEndElevation);
            const sunProtEndStop = (adapter.config.sunProtEndElevation - 1);

            for ( const i in result) {
                if (elevation <= sunProtEndStart && elevation >= sunProtEndStop && result[i].currentAction == 'sunProtect') {
                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                    adapter.getState('shutters.autoSun.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {
                            setTimeout(function() {
                                let currentValue = '';
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    let mustValue = ('' + result[i].triggerState);
                                    if (state) {
                                        currentValue = ('' + state.val);
                                    }
                                    if (currentValue === mustValue  && result[i].tempSensor != '' || (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].autoDrive != 'off') || (result[i].triggerID == '')) {
                                        
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (state) {
                                                if (result[i].currentAction == 'sunProtect' && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                    result[i].currentAction = '';
                                                    adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is completed');
                                                    adapter.log.debug('Set ID: ' + result[i].shutterName + ' value: ' + parseFloat(result[i].heightUp) + '%');
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
            let resLiving = resultFull.filter(d => d.typeUp == 'living');
            // Filter enabled
            let resEnabled = resLiving.filter(d => d.enabled === true);

            let result = resEnabled;

            for ( const i in result) {
                delayUp++;
            }
            if ((autoLivingStr) === true) {
            
                // Filter Area Living
                let resLivingAuto = resultFull.filter(d => d.typeUp == 'living-auto');
                // Filter enabled
                let resEnabled2 = resLivingAuto.filter(d => d.enabled === true);

                let result2 = resEnabled2;

                    for ( const i in result2) {
                        delayUp++;
                    }
            }
        }
        if ((downTimeLiving) === (downTimeSleep)) {
            
            // Filter Area Living
            let resLiving2 = resultFull.filter(d => d.typeDown == 'living');
            // Filter enabled
            let resEnabled3 = resLiving2.filter(d => d.enabled === true);

            let result3 = resEnabled3;

            for ( const i in result3) {
                delayDown++;
            }
            if ((autoLivingStr) === true) {
                
                // Filter Area Living
                let resLivingAuto2 = resultFull.filter(d => d.typeDown == 'living-auto');
                // Filter enabled
                let resEnabled4 = resLivingAuto2.filter(d => d.enabled === true);

                let result4 = resEnabled4;

                for ( const i in result4) {
                    delayDown++;
                }
            }
        }
    }
    
}
const calcPos = schedule.scheduleJob('calcPosTimer', '*/5 * * * *', function() {
    sunPos();
});

function sunPos() {
    let currentPos = SunCalc.getPosition(new Date(), adapter.config.latitude, adapter.config.longitude);
 
    // get sunrise azimuth in degrees
    let currentAzimuth = currentPos.azimuth * 180 / Math.PI + 180;

    // get sunrise altitude in degrees
    let currentAltitude = currentPos.altitude * 180 / Math.PI;

    azimuth = Math.round(10 * currentAzimuth) / 10
    elevation = Math.round(10 * currentAltitude) / 10

    //adapter.log.debug('Sun current Altitude: ' + currentAltitude + '°');
    //adapter.log.debug('Sun current azimuth: ' + currentAzimuth + '°');

    adapter.log.debug('Sun Azimut: ' + azimuth + '°');
    adapter.setState('info.Azimut', { val: azimuth, ack: true });
    adapter.log.debug('Sun Elevation: ' + elevation + '°');
    adapter.setState('info.Elevation', { val: elevation, ack: true });
}
function createShutter() {
    let result = adapter.config.events;
    if (result) {
        for ( const i in result) {
            let objectName = result[i].shutterName.replace(/[.;, ]/g, '_')
            
            // Create Object for auto up
            adapter.setObjectNotExists('shutters.autoUp.' + objectName, {
                "type": "state",
                "common": {
                    "role":  "switch",
                    "name":  result[i].shutterName,
                    "type":  "boolean",
                    "read":  true,
                    "write": true,
                    "def":   true
                },
                "native": {},
            });
            adapter.getState('shutters.autoUp.' + objectName, (err, state) => {
                if (state === null || state.val === null) {
                    adapter.setState('shutters.autoUp.' + objectName, {val: true, ack: true});
                    adapter.log.debug('Create Object: shutters.autoUp.' + objectName);
                }
            });
            // Create Object for auto down
            adapter.setObjectNotExists('shutters.autoDown.' + objectName, {
                "type": "state",
                "common": {
                    "role":  "switch",
                    "name":  result[i].shutterName,
                    "type":  "boolean",
                    "read":  true,
                    "write": true,
                    "def":   true
                },
                "native": {},
            });
            adapter.getState('shutters.autoDown.' + objectName, (err, state) => {
                if (state === null || state.val === null) {
                    adapter.setState('shutters.autoDown.' + objectName, {val: true, ack: true});
                    adapter.log.debug('Create Object: shutters.autoDown.' + objectName);
                }
            });
            // Create Object for auto sun
            adapter.setObjectNotExists('shutters.autoSun.' + objectName, {
                "type": "state",
                "common": {
                    "role":  "switch",
                    "name":  result[i].shutterName,
                    "type":  "boolean",
                    "read":  true,
                    "write": true,
                    "def":   true
                },
                "native": {},
            });
            adapter.getState('shutters.autoSun.' + objectName, (err, state) => {
                if (state === null || state.val === null) {
                    adapter.setState('shutters.autoSun.' + objectName, {val: true, ack: true});
                    adapter.log.debug('Create Object: shutters.autoSun.' + objectName);
                }
            });
            
        }
    }
    // delete old shutter auto up
    for ( const i in ObjautoUp) {

        const resID = ObjautoUp[i]._id;
        const objectID = resID.split('.');
        const resultID = objectID[4];

        let resultName = result.map(({ shutterName }) => ({ shutterName }));
        let fullRes = []

        for ( const i in resultName) {
            let res = resultName[i].shutterName.replace(/[.;, ]/g, '_');
            fullRes.push(res);
        }
        setTimeout(function() {
            if (fullRes.indexOf(resultID) === -1) {
                adapter.log.warn('DELETE: ' + resID)
                adapter.delObject(resID, function (err) {
                    if (err) {
                        adapter.log.warn(err);
                    }
                });
            }
        }, 1500)
    }
    // delete old shutter auto down
    for ( const i in ObjautoDown) {

        const resID = ObjautoDown[i]._id;
        const objectID = resID.split('.');
        const resultID = objectID[4];

        let resultName = result.map(({ shutterName }) => ({ shutterName }));
        let fullRes = []

        for ( const i in resultName) {
            let res = resultName[i].shutterName.replace(/[.;, ]/g, '_');
            fullRes.push(res);
        }
        setTimeout(function() {
            if (fullRes.indexOf(resultID) === -1) {
                adapter.log.warn('DELETE: ' + resID)
                adapter.delObject(resID, function (err) {
                    if (err) {
                        adapter.log.warn(err);
                    }
                });
            }
        }, 1500)
    }
    // delete old shutter auto sun
    for ( const i in ObjautoSun) {

        const resID = ObjautoSun[i]._id;
        const objectID = resID.split('.');
        const resultID = objectID[4];

        let resultName = result.map(({ shutterName }) => ({ shutterName }));
        let fullRes = []

        for ( const i in resultName) {
            let res = resultName[i].shutterName.replace(/[.;, ]/g, '_');
            fullRes.push(res);
        }
        setTimeout(function() {
            if (fullRes.indexOf(resultID) === -1) {
                adapter.log.warn('DELETE: ' + resID)
                adapter.delObject(resID, function (err) {
                    if (err) {
                        adapter.log.warn(err);
                    }
                });
            }
        }, 1500)
    }
}
function main() {
    adapter.log.debug(JSON.stringify(adapter.config.events))
    
    adapter.getForeignObject('system.config', (err, obj) => {
        checkStates();
    });
    setTimeout(function() {
        checkActualStates();
        sunPos();
    }, 2000)

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
    if (adapter.config.triggerAutoLiving != '') {
        adapter.subscribeForeignStates(adapter.config.triggerAutoLiving);
    }
    if (adapter.config.triggerAutoSleep != '') {
        adapter.subscribeForeignStates(adapter.config.triggerAutoSleep);
    }

    // Change State from Trigger ID's
    let result = adapter.config.events;
    if (result) {
        let res = result.map(({ triggerID }) => ({ triggerID }));
        let resTriggerActive = res.filter(d => d.triggerID != '');
        
        for ( const i in resTriggerActive) {
            if (resTrigger.indexOf(resTriggerActive[i].triggerID) === -1) {
                resTrigger.push(resTriggerActive[i].triggerID)
            }
        }
        resTrigger.forEach(function(element) {
            adapter.subscribeForeignStates(element);
            adapter.log.debug('trigger for shuttercontrol: ' + element);
        });
    }
    
    let resultInsideTemp = adapter.config.events;
    if (resultInsideTemp) {
        let resInsideTemp = resultInsideTemp.map(({ tempSensor }) => ({ tempSensor }));
        let rescurrentInsideTemp = resInsideTemp.filter(d => d.tempSensor != '');
        
        for ( const i in rescurrentInsideTemp) {
            if (resSunInsideTemp.indexOf(rescurrentInsideTemp[i].tempSensor) === -1) {
                resSunInsideTemp.push(rescurrentInsideTemp[i].tempSensor)
            }
        }
        resSunInsideTemp.forEach(function(element) {
            adapter.subscribeForeignStates(element);
            adapter.log.debug('trigger for inside temperature: ' + element);
        });
    }

    let resultOutsideTemp = adapter.config.events;
    if (resultOutsideTemp) {
        let resOutsideTemp = resultOutsideTemp.map(({ outsideTempSensor }) => ({ outsideTempSensor }));
        let rescurrentOutsideTemp = resOutsideTemp.filter(d => d.outsideTempSensor != '');
        
        for ( const i in rescurrentOutsideTemp) {
            if (resSunOutsideTemp.indexOf(rescurrentOutsideTemp[i].outsideTempSensor) === -1) {
                resSunOutsideTemp.push(rescurrentOutsideTemp[i].outsideTempSensor)
            }
        }
        resSunOutsideTemp.forEach(function(element) {
            adapter.subscribeForeignStates(element);
            adapter.log.debug('trigger for outside temperature: ' + element);
        });
    }
    
    let resultLight = adapter.config.events;
    if (resultLight) {
        let resLight = resultLight.map(({ lightSensor }) => ({ lightSensor }));
        let rescurrentLight = resLight.filter(d => d.lightSensor != '');
        
        for ( const i in rescurrentLight) {
            if (resSunLight.indexOf(rescurrentLight[i].lightSensor) === -1) {
                resSunLight.push(rescurrentLight[i].lightSensor)
            }
        }
        resSunLight.forEach(function(element) {
            adapter.subscribeForeignStates(element);
            adapter.log.debug('trigger for Light Sensor: ' + element);
        });
    }
    // trigger for shutter
    let resultShutter = adapter.config.events;
    if (resultShutter) {
        let resShutter = resultShutter.map(({ name }) => ({ name }));
        let rescurrentShutter = resultShutter.filter(d => d.name != '');
        
        for ( const i in rescurrentShutter) {
            if (resShutterState.indexOf(rescurrentShutter[i].name) === -1) {
                resShutterState.push(rescurrentShutter[i].name)
            }
        }
        resShutterState.forEach(function(element) {
            adapter.subscribeForeignStates(element);
            adapter.log.debug('Shutter State: ' + element);
        });
    }
    // set current states
    const resultStates = adapter.config.events;

    if (resultStates) {
        for ( const i in resultStates) {
            adapter.getForeignState(resultStates[i].name, (err, state) => {
                if (state) {
                    resultStates[i].currentHeight = (state.val);
                    resultStates[i].triggerHeight = (state.val);
                    adapter.log.debug('save current height: ' + resultStates[i].currentHeight + '%' + ' from ' + resultStates[i].shutterName);
                }
            });
        }
    }
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}