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
/** @type {string | number} */
let actualValueStr;
/** @type {string | number} */
let actualValueLightStr;
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
/** @type {any[] | never[]} */
let resTrigger = [];
let resSunTrigger = [];
let resSunInsideTemp = [];
/** @type {any} */
let resTriggerChange;
let resSunTriggerChange;

let azimuth;
let elevation;

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

    // is called if a subscribed object changes
    /*
    adapter.on('objectChange', (id, obj) => {
        if (obj) {
            // The object was changed
            adapter.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
            //shutterDriveCalc();
        } else {
            // The object was deleted
            adapter.log.info(`object ${id} deleted`);
        }
    });
    */

    // is called if a subscribed state changes
    adapter.on('stateChange', (id, state) => {
        if (state) {
            // The state was changed
            //adapter.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);

            if (id === adapter.namespace + '.control.Holiday') {
                HolidayStr = state['val'];
                shutterDriveCalc();
            }
            if (id === adapter.namespace + '.control.autoLiving') {
                autoLivingStr = state['val'];
                shutterDriveCalc();
            }
            if (id === adapter.namespace + '.control.autoSleep') {
                autoSleepStr = state['val'];
                shutterDriveCalc();
            }
            if (adapter.config.publicHolidays === true) {
                if (id === adapter.config.publicHolInstance + '.heute.boolean') {
                    publicHolidayStr = state['val'];
                    shutterDriveCalc();
                }
                if (id === adapter.config.publicHolInstance + '.morgen.boolean') {
                    publicHolidayTomorowStr = state['val'];
                    shutterDriveCalc();
                }
            }
            if (adapter.config.UseSunMode === true && id === adapter.config.actualValueTemp) {
                actualValueStr = state['val'];
                sunProtect();
            }
            if (adapter.config.UseSunMode === true && id === adapter.config.actualValueLight) {
                actualValueLightStr = state['val'];
                sunProtect();
            }
            if (id === adapter.config.triggerAutoLiving) {
                adapter.setState('control.autoLiving', {val: state['val'], ack: true});
                adapter.log.debug('Auto Living is: ' + state['val']);
            }
            if (id === adapter.config.triggerAutoSleep) {
                adapter.setState('control.autoSleep', {val: state['val'], ack: true});
                adapter.log.debug('Auto Sleep is: ' + state['val']);
            }
            resTrigger.forEach(function(resultTriggerID) {
                if (id === resultTriggerID) {
                    resTriggerChange = resultTriggerID;
                    adapter.log.debug('TriggerID Change: ' +  resultTriggerID);
                    triggerChange();
                }
            });
            resSunTrigger.forEach(function(resSunTriggerID) {
                if (id === resSunTriggerID) {
                    resSunTriggerChange = resSunTriggerID;
                    adapter.log.debug('TriggerID Change: ' +  resSunTriggerID);
                    sunTriggerChange();
                }
            });
            resSunInsideTemp.forEach(function(resSunInsideTempID) {
                if (id === resSunInsideTempID) {
                    adapter.log.debug('TriggerID Change: ' +  resSunInsideTempID);
                    sunProtect();
                }
            });
            if (id === adapter.namespace + '.info.Azimut') {
                sunProtect();
            }
            if (id === adapter.namespace + '.info.Elevation') {
                elevationDown();
            }
        } else {
            // The state was deleted
            //adapter.log.info(`state ${id} deleted`);
        }
    });
}

function sunTriggerChange() {
    
    const resultID = adapter.config.eventsSun;
    // Filter changed Trigger
    const arrayChangeTrigger = resultID.filter(d => d.triggerID == resSunTriggerChange);
    
    for ( const i in arrayChangeTrigger) {
        setTimeout(function() {
            if (arrayChangeTrigger[i].triggerChange == 'onlyUp' || arrayChangeTrigger[i].triggerChange =='upDown') {
                adapter.getForeignState(arrayChangeTrigger[i].triggerID, (err, state) => {
                    if (arrayChangeTrigger[i].triggerID && (state['val']) != arrayChangeTrigger[i].triggerState)  {
                        adapter.getForeignState(arrayChangeTrigger[i].name, (err, state) => {
                            arrayChangeTrigger[i].currentHeight = (state['val']);
                            adapter.log.debug('save current height: ' + arrayChangeTrigger[i].currentHeight + '%')
                            if ((state['val']) != arrayChangeTrigger[i].triggerDrive)  {
                                adapter.log.debug('Set ID: ' + arrayChangeTrigger[i].name + ' value: ' + arrayChangeTrigger[i].triggerDrive + '%')
                                adapter.setForeignState(arrayChangeTrigger[i].name, parseFloat(arrayChangeTrigger[i].triggerDrive), false);
                            }
                        });
                    }
                });
            }
            if (arrayChangeTrigger[i].triggerChange == 'onlyDown' || arrayChangeTrigger[i].triggerChange =='upDown') {
                adapter.getForeignState(arrayChangeTrigger[i].triggerID, (err, state) => {
                    if (arrayChangeTrigger[i].triggerID && (state['val']) == arrayChangeTrigger[i].triggerState) {
                        adapter.getForeignState(arrayChangeTrigger[i].name, (err, state) => {
                            if ((state['val']) != arrayChangeTrigger[i].currentHeight)  { // Todo currentHeight
                                adapter.log.debug('change to last height: ' + arrayChangeTrigger[i].currentHeight + '%')
                                adapter.log.debug('Set ID: ' + arrayChangeTrigger[i].name + ' value: ' + arrayChangeTrigger[i].currentHeight + '%')
                                adapter.setForeignState(arrayChangeTrigger[i].name, parseFloat(arrayChangeTrigger[i].currentHeight), false);
                            }
                        });
                    }
                });
            }
        }, 1000 * i, i);
    }
}
function triggerChange() {
    
    const resultID = adapter.config.events;
    // Filter changed Trigger
    const arrayChangeTrigger = resultID.filter(d => d.triggerID == resTriggerChange);
    
    for ( const i in arrayChangeTrigger) {
        setTimeout(function() {
            if (arrayChangeTrigger[i].triggerChange == 'onlyUp' || arrayChangeTrigger[i].triggerChange =='upDown') {
                adapter.getForeignState(arrayChangeTrigger[i].triggerID, (err, state) => {
                    if (arrayChangeTrigger[i].triggerID && (state['val']) != arrayChangeTrigger[i].triggerState)  {
                        adapter.getForeignState(arrayChangeTrigger[i].name, (err, state) => {
                            arrayChangeTrigger[i].currentHeight = (state['val']);
                            adapter.log.debug('save current height: ' + arrayChangeTrigger[i].currentHeight + '%')
                            if ((state['val']) != arrayChangeTrigger[i].triggerDrive)  {
                                adapter.log.debug('Set ID: ' + arrayChangeTrigger[i].name + ' value: ' + arrayChangeTrigger[i].triggerDrive + '%')
                                adapter.setForeignState(arrayChangeTrigger[i].name, parseFloat(arrayChangeTrigger[i].triggerDrive), false);
                            }
                        });
                    }
                });
            }
            if (arrayChangeTrigger[i].triggerChange == 'onlyDown' || arrayChangeTrigger[i].triggerChange =='upDown') {
                adapter.getForeignState(arrayChangeTrigger[i].triggerID, (err, state) => {
                    if (arrayChangeTrigger[i].triggerID && (state['val']) == arrayChangeTrigger[i].triggerState) {
                        adapter.getForeignState(arrayChangeTrigger[i].name, (err, state) => {
                            if ((state['val']) != arrayChangeTrigger[i].currentHeight)  { // Todo currentHeight
                                adapter.log.debug('change to last height: ' + arrayChangeTrigger[i].currentHeight + '%')
                                adapter.log.debug('Set ID: ' + arrayChangeTrigger[i].name + ' value: ' + arrayChangeTrigger[i].currentHeight + '%')
                                adapter.setForeignState(arrayChangeTrigger[i].name, parseFloat(arrayChangeTrigger[i].currentHeight), false);
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
            HolidayStr = state['val'];
        }
    });
    adapter.getState('control.autoLiving', (err, state) => {
        if (state) {
            autoLivingStr = state['val'];
        }
    });
    adapter.getState('control.autoSleep', (err, state) => {
        if (state) {
            autoSleepStr = state['val'];
        }
    });
    if (adapter.config.publicHolidays === true && (adapter.config.publicHolInstance !== 'none' || adapter.config.publicHolInstance !== '')) {
        adapter.getForeignState(adapter.config.publicHolInstance + '.heute.boolean', (err, state) => {
            if (state) {
                publicHolidayStr = state['val'];
            }
        });
        adapter.getForeignState(adapter.config.publicHolInstance + '.morgen.boolean', (err, state) => {
            if (state) {
                publicHolidayTomorowStr = state['val'];
            }
        });
    }
    if (adapter.config.UseSunMode === true) {
        adapter.getForeignState(adapter.config.actualValueTemp, (err, state) => {
            if (state) {
                actualValueStr = state['val'];
            }
        });
        adapter.getForeignState(adapter.config.actualValueLight, (err, state) => {
            if (state) {
                actualValueLightStr = state['val'];
            }
        });
    }
    setTimeout(function() {
        shutterDriveCalc()
    }, 1000)
}

const calc = schedule.scheduleJob('calcTimer', '30 2 * * *', function() {
    shutterDriveCalc();
});

function shutterDriveCalc() {
    if (adapter.config.UseAstro === true) {
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
    }
    // ******** Set Up-Time Living Area ********
    if (adapter.config.livingAutomatic == "livingTime") {
        if ((dayStr) == 6 || (dayStr) == 0 || (HolidayStr) === true || (publicHolidayStr) === true) {
            upTimeLiving = adapter.config.WE_shutterUpLiving;
            adapter.setState('info.upTimeLiving', { val: upTimeLiving, ack: true });
        } else {
            upTimeLiving = adapter.config.W_shutterUpLivingMax;
            adapter.setState('info.upTimeLiving', { val: upTimeLiving, ack: true });
        }
    } else {
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
            }
        }
    }
    adapter.log.debug('Starting up shutters living area: ' + upTimeLiving);
    shutterUpLiving();

    // ******** Set Up-Time Sleep Area ********
    if (adapter.config.UseAstro === false) {
        if ((dayStr) == 6 || (dayStr) == 0 || (HolidayStr) === true || (publicHolidayStr) === true) {
            upTimeSleep = adapter.config.WE_shutterUpSleep;
            adapter.setState('info.upTimeSleep', { val: upTimeSleep, ack: true });
        } else {
            upTimeSleep = adapter.config.W_shutterUpSleepMax;
            adapter.setState('info.upTimeSleep', { val: upTimeSleep, ack: true });
        }
    } else {
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
            }
        }
    }
    adapter.log.debug('Starting up shutters sleep area: ' + upTimeSleep);
    shutterUpSleep();

    // ******** Set Down-Time Living Area ********
    if (adapter.config.UseAstro === false) {
        if ((dayStr) == 5 || (dayStr) == 6 || (HolidayStr) === true || (publicHolidayTomorowStr) === true) {
            downTimeLiving = adapter.config.WE_shutterDownLiving;
            adapter.setState('info.downTimeLiving', { val: downTimeLiving, ack: true });
        } else {
            downTimeLiving = adapter.config.W_shutterDownLiving;
            adapter.setState('info.downTimeLiving', { val: downTimeLiving, ack: true });
        }
    } else {
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
    }
    adapter.log.debug('Shutdown shutters living area: ' + downTimeLiving);
    shutterDownLiving();

    // ******** Set Down-Time Sleep Area ******** 
    if (adapter.config.UseAstro === false) {
        if ((dayStr) == 5 || (dayStr) == 6 || (HolidayStr) === true || (publicHolidayTomorowStr) === true) {
            downTimeSleep = adapter.config.WE_shutterDownSleep;
            adapter.setState('info.downTimeSleep', { val: downTimeSleep, ack: true });
        } else {
            downTimeSleep = adapter.config.W_shutterDownSleep;
            adapter.setState('info.downTimeSleep', { val: downTimeSleep, ack: true });
        }
    } else {
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
            if (elevation <= result[i].elevation) {
                setTimeout(function() {
                    adapter.getForeignState(result[i].triggerID, (err, state) => {
                        if (result[i].triggerID && (state['val']) == result[i].triggerState)  {
                            adapter.getForeignState(result[i].name, (err, state) => {
                                if ((state['val']) != result[i].heightDown)  {
                                    adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightDown + '%')
                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                }
                            });
                        } else if (!result[i].triggerID) {
                            adapter.getForeignState(result[i].name, (err, state) => {
                                if ((state['val']) != result[i].heightDown)  {
                                    adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightDown + '%')
                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                }
                            });
                        }
                    });
                }, driveDelayUpAstro * i, i);
            }
        }
    }
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
                    setTimeout(function() {
                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                            if (result[i].triggerID && (state['val']) == result[i].triggerState)  {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if ((state['val']) != result[i].heightUp)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightUp + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                    }
                                });
                            } else if (!result[i].triggerID) {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if ((state['val']) != result[i].heightUp)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightUp + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                    }
                                });
                            }
                        });
                    }, driveDelayUpAstro * i, i);
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
                    setTimeout(function() {
                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                            if (result[i].triggerID && (state['val']) == result[i].triggerState)  {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if ((state['val']) != result[i].heightDown)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightDown + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                    }
                                });
                            } else if (!result[i].triggerID) {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if ((state['val']) != result[i].heightDown)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightDown + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
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
                    setTimeout(function() {
                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                            if (result[i].triggerID && (state['val']) == result[i].triggerState)  {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if ((state['val']) != result[i].heightUp)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightUp + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                    }
                                });
                            } else if (!result[i].triggerID) {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if ((state['val']) != result[i].heightUp)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightUp + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                    }
                                });
                            }
                        });
                    }, driveDelayUpAstro * i, i);
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
                    setTimeout(function() {
                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                            if (result[i].triggerID && (state['val']) == result[i].triggerState)  {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if ((state['val']) != result[i].heightDown)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightDown + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                    }
                                });
                            } else if (!result[i].triggerID) {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if ((state['val']) != result[i].heightDown)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightDown + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
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
                setTimeout(function() {
                    adapter.getForeignState(result[i].triggerID, (err, state) => {
                        if (result[i].triggerID && (state['val']) == result[i].triggerState)  {
                            adapter.getForeignState(result[i].name, (err, state) => {
                                if ((state['val']) != result[i].heightUp)  {
                                    adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightUp + '%')
                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                }
                            });
                        } else if (!result[i].triggerID) {
                            adapter.getForeignState(result[i].name, (err, state) => {
                                if ((state['val']) != result[i].heightUp)  {
                                    adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightUp + '%')
                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                }
                            });
                        }
                    });
                }, driveDelayUpLiving * i, i);
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
                        setTimeout(function() {
                            adapter.getForeignState(result[i].triggerID, (err, state) => {
                                if (result[i].triggerID && (state['val']) == result[i].triggerState)  {
                                    adapter.getForeignState(result[i].name, (err, state) => {
                                        if ((state['val']) != result[i].heightUp)  {
                                            adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightUp + '%')
                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                        }
                                    });
                                } else if (!result[i].triggerID) {
                                    adapter.getForeignState(result[i].name, (err, state) => {
                                        if ((state['val']) != result[i].heightUp)  {
                                            adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightUp + '%')
                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                        }
                                    });
                                }
                            });
                        }, driveDelayUpLiving * i, i);
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
                setTimeout(function() {
                    adapter.getForeignState(result[i].triggerID, (err, state) => {
                        if (result[i].triggerID && (state['val']) == result[i].triggerState)  {
                            adapter.getForeignState(result[i].name, (err, state) => {
                                if ((state['val']) != result[i].heightDown)  {
                                    adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightDown + '%')
                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                }
                            });
                        } else if (!result[i].triggerID) {
                            adapter.getForeignState(result[i].name, (err, state) => {
                                if ((state['val']) != result[i].heightDown)  {
                                    adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightDown + '%')
                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                }
                            });
                        }
                    });
                }, driveDelayUpLiving * i, i);
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
                        setTimeout(function() {
                            adapter.getForeignState(result[i].triggerID, (err, state) => {
                                if (result[i].triggerID && (state['val']) == result[i].triggerState)  {
                                    adapter.getForeignState(result[i].name, (err, state) => {
                                        if ((state['val']) != result[i].heightDown)  {
                                            adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightDown + '%')
                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                        }
                                    });
                                } else if (!result[i].triggerID) {
                                    adapter.getForeignState(result[i].name, (err, state) => {
                                        if ((state['val']) != result[i].heightDown)  {
                                            adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightDown + '%')
                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                        }
                                    });
                                }
                            });
                        }, driveDelayUpLiving * i, i);
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
                    setTimeout(function() {
                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                            if (result[i].triggerID && (state['val']) == result[i].triggerState)  {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if ((state['val']) != result[i].heightUp)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightUp + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                    }
                                });
                            } else if (!result[i].triggerID) {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if ((state['val']) != result[i].heightUp)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightUp + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                    }
                                });
                            }
                        });
                    }, driveDelayUpSleep * i, i);
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
                            setTimeout(function() {
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    if (result[i].triggerID && (state['val']) == result[i].triggerState)  {
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if ((state['val']) != result[i].heightUp)  {
                                                adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightUp + '%')
                                                adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                            }
                                        });
                                    } else if (!result[i].triggerID) {
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if ((state['val']) != result[i].heightUp)  {
                                                adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightUp + '%')
                                                adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                            }
                                        });
                                    }
                                });
                            }, driveDelayUpSleep * i, i);
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
                    setTimeout(function() {
                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                            if (result[i].triggerID && (state['val']) == result[i].triggerState)  {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if ((state['val']) != result[i].heightDown)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightDown + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                    }
                                });
                            } else if (!result[i].triggerID) {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if ((state['val']) != result[i].heightDown)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightDown + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                    }
                                });
                            }
                        });
                    }, driveDelayUpSleep * i, i);
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
                                setTimeout(function() {
                                    adapter.getForeignState(result[i].triggerID, (err, state) => {
                                        if (result[i].triggerID && (state['val']) == result[i].triggerState)  {
                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                if ((state['val']) != result[i].heightDown)  {
                                                    adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightDown + '%')
                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                }
                                            });
                                        } else if (!result[i].triggerID) {
                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                if ((state['val']) != result[i].heightDown)  {
                                                    adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightDown + '%')
                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                }
                                            });
                                        }
                                    });
                                }, driveDelayUpSleep * i, i);
                            //}
                        }
                    }
                }, timeoutSleepAuto)
            }
        }, delayDown)
    });
}

function sunProtect() {

    if (adapter.config.UseSunMode === true) {
        let date = new Date();
        let monthIndex = (date.getMonth() +1);
        let hours = date.getHours();
        let minutes = date.getMinutes();
        let currentTime = ('0' + hours).slice(-2) + ':' + ('0' + minutes).slice(-2);

        const driveDelayUpSleep = adapter.config.driveDelayUpSleep * 1000;
        
        setTimeout(function() {
            if (adapter.config.sun_shutterDown < (currentTime) && adapter.config.sun_shutterUp > (currentTime) && adapter.config.sunMonthStart <= (monthIndex) && adapter.config.sunMonthEnd >= (monthIndex)) {
                adapter.log.debug('current outside temperature: ' + actualValueStr + ' °C');
                adapter.log.debug('current outside Lux: ' + actualValueLightStr + ' lux');
                adapter.log.debug('current time: ' + currentTime);
                adapter.log.debug('current month: ' + monthIndex);

                // Full Result
                const resultFull = adapter.config.eventsSun;

                if (resultFull) {
                    // Filter enabled
                    let resEnabled = resultFull.filter(d => d.enabled === true);
                    let result = resEnabled;

                    // in- & outside temperature
                    for ( const i in result) {
                        if (result[i].type == 'in- & outside temperature') {
                            setTimeout(function() {
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    if ((result[i].triggerID && (state['val']) == result[i].triggerState && result[i].tempSensor != '') || (result[i].triggerID == '' && result[i].tempSensor != ''))  {
                                        let insideTemp;
                                        adapter.getForeignState(result[i].tempSensor, (err, state) => {
                                            if (state) {
                                                insideTemp = parseFloat(state['val']);

                                                if (insideTemp > result[i].tempInside) {
                                                    if ((adapter.config.setpointValue) < actualValueStr || (adapter.config.setpointValueLight) < actualValueLightStr) {
                                                        adapter.getForeignState(result[i].name, (err, state) => {
                                                            if (parseFloat(state['val']) > parseFloat(result[i].heightDown)) {
                                                                adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightDown + '%')
                                                                adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                            }
                                                        });
                                                    }
                                                } else if (insideTemp < result[i].tempInside || adapter.config.setpointValue > actualValueStr || (adapter.config.setpointValueLight) > actualValueLightStr) {
                                                    adapter.getForeignState(result[i].name, (err, state) => {
                                                        if (parseFloat(state['val']) < parseFloat(result[i].triggerDrive)) {
                                                            adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].triggerDrive + '%')
                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].triggerDrive), false);
                                                        }
                                                    });
                                                }
                                            }
                                        });
                                    }
                                });
                            }, driveDelayUpSleep * i, i);
                        }
                    }
                    // in- & outside temperature and direction
                    for ( const i in result) {
                        if (result[i].type == 'in- & outside temperature and direction') {
                            const resultDirectionRangeMinus = result[i].direction - result[i].directionRange;
                            const resultDirectionRangePlus = parseInt(result[i].direction) + parseInt(result[i].directionRange);

                            setTimeout(function() {
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    if ((result[i].triggerID && (state['val']) == result[i].triggerState && result[i].tempSensor != '') || (result[i].triggerID == '' && result[i].tempSensor != ''))  {
                                        let insideTemp;
                                        adapter.getForeignState(result[i].tempSensor, (err, state) => {
                                            if (state) {
                                                insideTemp = parseFloat(state['val']);

                                                if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth && insideTemp > result[i].tempInside) {
                                                    if ((adapter.config.setpointValue) < actualValueStr || (adapter.config.setpointValueLight) < actualValueLightStr) {
                                                        adapter.getForeignState(result[i].name, (err, state) => {
                                                            if (parseFloat(state['val']) > parseFloat(result[i].heightDown)) {
                                                                adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightDown + '%')
                                                                adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                            }
                                                        });
                                                    }
                                                } else if (insideTemp < result[i].tempInside || (resultDirectionRangePlus) < azimuth || (adapter.config.setpointValue) > actualValueStr || (adapter.config.setpointValueLight) > actualValueLightStr) {
                                                    adapter.getForeignState(result[i].name, (err, state) => {
                                                        if (parseFloat(state['val']) < parseFloat(result[i].triggerDrive)) {
                                                            adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].triggerDrive + '%')
                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].triggerDrive), false);
                                                        }
                                                    });
                                                }
                                            }
                                        });
                                    }
                                });
                            }, driveDelayUpSleep * i, i);
                        }
                    }
                    // outside temperature and direction
                    for ( const i in result) {
                        if (result[i].type == 'outside temperature and direction') {
                            const resultDirectionRangeMinus = result[i].direction - result[i].directionRange;
                            const resultDirectionRangePlus = result[i].direction + result[i].directionRange;
                            setTimeout(function() {
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    if ((result[i].triggerID && (state['val']) == result[i].triggerState) || (result[i].triggerID == ''))  {
                                        if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth) {
                                            if ((adapter.config.setpointValue) < actualValueStr || (adapter.config.setpointValueLight) < actualValueLightStr) {
                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                    if (parseFloat(state['val']) > parseFloat(result[i].heightDown)) {
                                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightDown + '%')
                                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                    }
                                                });
                                            }
                                        } else if ((resultDirectionRangePlus) < azimuth || (adapter.config.setpointValue) > actualValueStr || (adapter.config.setpointValueLight) > actualValueLightStr) {
                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                if (parseFloat(state['val']) < parseFloat(result[i].triggerDrive)) {
                                                    adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].triggerDrive + '%')
                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].triggerDrive), false);
                                                }
                                            });
                                        }
                                    }
                                });
                            }, driveDelayUpSleep * i, i);
                        }
                    }
                    // only outside temperature
                    for ( const i in result) {
                        if (result[i].type == 'only outside temperature') {
                            setTimeout(function() {
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    if ((result[i].triggerID && (state['val']) == result[i].triggerState) || (result[i].triggerID == ''))  {
                                        if ((adapter.config.setpointValue) < actualValueStr || (adapter.config.setpointValueLight) < actualValueLightStr) {
                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                if (parseFloat(state['val']) > parseFloat(result[i].heightDown)) {
                                                    adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightDown + '%')
                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                }
                                            });
                                        } else if ((adapter.config.setpointValue) > actualValueStr || (adapter.config.setpointValueLight) > actualValueLightStr){
                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                if (parseFloat(state['val']) < parseFloat(result[i].triggerDrive)) {
                                                    adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].triggerDrive + '%')
                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].triggerDrive), false);
                                                }
                                            });
                                        }
                                    }
                                });
                            }, driveDelayUpSleep * i, i);
                        }
                    }
                    // only inside temperature
                    for ( const i in result) {
                        if (result[i].type == 'only inside temperature') {
                            setTimeout(function() {
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    if (r(esult[i].triggerID && (state['val']) == result[i].triggerState && result[i].tempSensor != '') || (result[i].triggerID == '' && result[i].tempSensor != ''))  {
                                        let insideTemp;
                                        adapter.getForeignState(result[i].tempSensor, (err, state) => {
                                            if (state) {
                                                insideTemp = parseFloat(state['val']);

                                                if (insideTemp > result[i].tempInside) {
                                                    adapter.getForeignState(result[i].name, (err, state) => {
                                                        if (parseFloat(state['val']) > parseFloat(result[i].heightDown)) {
                                                            adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].heightDown + '%')
                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightDown), false);
                                                        }
                                                    });
                                                } else if (insideTemp < result[i].tempInside) {
                                                    adapter.getForeignState(result[i].name, (err, state) => {
                                                        if (parseFloat(state['val']) < parseFloat(result[i].triggerDrive)) {
                                                            adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + result[i].triggerDrive + '%')
                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].triggerDrive), false);
                                                        }
                                                    });
                                                }
                                            }
                                        });
                                    }
                                });
                            }, driveDelayUpSleep * i, i);
                        }
                    }
                }
            }

            let upSunProtect = adapter.config.sun_shutterUp;

            if ((upSunProtect) == undefined) {
                upSunProtect = adapter.config.sun_shutterUp;
            }
            let upTimeSun = upSunProtect.split(':');
        
            schedule.cancelJob('upSunProtect');

            const upSunStr = schedule.scheduleJob('upSunProtect', upTimeSun[1] + ' ' + upTimeSun[0] + ' * * *', function() {
                if (adapter.config.sunMonthStart <= (monthIndex) && adapter.config.sunMonthEnd >= (monthIndex)) {
                    // Full Result
                    const resultFull = adapter.config.eventsSun;

                    if (resultFull) {
                        // Filter enabled
                        let resEnabled = resultFull.filter(d => d.enabled === true);

                        let result = resEnabled;

                        for ( const i in result) {
                            setTimeout(function() {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if (parseFloat(state['val']) < parseFloat(result[i].triggerDrive)) {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + parseFloat(result[i].triggerDrive) + '%');
                                        adapter.setForeignState(result[i].name, parseFloat(result[i].triggerDrive), false);
                                    }
                                });
                            }, driveDelayUpSleep * i, i);
                        }
                    }
                }
            });
        }, 2000);
    }
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
const calcPos = schedule.scheduleJob('calcPosTimer', '*/10 * * * *', function() {
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

function main() {
    adapter.log.debug(JSON.stringify(adapter.config.events))
    adapter.log.debug(JSON.stringify(adapter.config.eventsSun))
    
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

    if (adapter.config.publicHolidays === true) {
        adapter.subscribeForeignStates(adapter.config.publicHolInstance + '.heute.*');
        adapter.subscribeForeignStates(adapter.config.publicHolInstance + '.morgen.*');
    }
    if (adapter.config.UseSunMode === true) {
        adapter.subscribeForeignStates(adapter.config.actualValueTemp);
    }
    adapter.subscribeForeignStates(adapter.config.triggerAutoLiving);
    adapter.subscribeForeignStates(adapter.config.triggerAutoSleep);

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
    let resultSun = adapter.config.eventsSun;
    if (resultSun) {
        let resSun = resultSun.map(({ triggerID }) => ({ triggerID }));
        let resTriggerActiveSun = resSun.filter(d => d.triggerID != '');
        
        
        
        for ( const i in resTriggerActiveSun) {
            if (resSunTrigger.indexOf(resTriggerActiveSun[i].triggerID) === -1) {
                resSunTrigger.push(resTriggerActiveSun[i].triggerID)
            }
        }
        resSunTrigger.forEach(function(element) {
            adapter.subscribeForeignStates(element);
            adapter.log.debug('trigger for sunprotect: ' + element);
        });
    }
    let resultInsideTemp = adapter.config.eventsSun;
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
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}