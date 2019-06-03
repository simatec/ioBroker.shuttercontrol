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

let sunsetStr;
let sunriseStr;
let goldenHour;
let goldenHourEnd;
let upTimeSleep;
let upTimeLiving;
let downTimeSleep;
let downTimeLiving;
let dayStr;
let HolidayStr;
let publicHolidayStr;
let publicHolidayTomorowStr;
let autoLivingStr;
/** @type {any} */
let autoSleepStr;
/** @type {string | number} */
let actualValueStr;
/** @type {string | number} */
let actualValueLightStr;
let delayUp;
/** @type {number | undefined} */
let delayDown;
let astroTimeLivingUp;
let astroTimeLivingDown;
let astroTimeSleepUp;
/** @type {string} */
let astroTimeSleepDown;
let resTrigger = [];
let resTriggerChange;

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
            adapter.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);

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
                    trigggerChange();
                }
            });
        } else {
            // The state was deleted
            adapter.log.info(`state ${id} deleted`);
        }
    });
}

function trigggerChange() {
    
    const resultID = adapter.config.events;
    // Filter changed Trigger
    const arrayChangeTrigger = resultID.filter(d => d.triggerID == resTriggerChange);
    
    for ( const i in arrayChangeTrigger) {
        setTimeout(function() {
            if (arrayChangeTrigger[i].triggerChange == true) {
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
                    } else if (arrayChangeTrigger[i].triggerID && (state['val']) == arrayChangeTrigger[i].triggerState) {
                        adapter.getForeignState(arrayChangeTrigger[i].name, (err, state) => {
                            if ((state['val']) != arrayChangeTrigger[i].currentHeight)  {
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

        adapter.log.debug('Astro-Times: ' + JSON.stringify(times));

        // format sunset/sunrise time from the Date object
        sunsetStr = ('0' + times.sunset.getHours()).slice(-2) + ':' + ('0' + times.sunset.getMinutes()).slice(-2);
        sunriseStr = ('0' + times.sunrise.getHours()).slice(-2) + ':' + ('0' + times.sunrise.getMinutes()).slice(-2);
        dayStr = times.sunrise.getDay();

        // format goldenhour/goldenhourend time from the Date object
        goldenHour = ('0' + times.goldenHour.getHours()).slice(-2) + ':' + ('0' + times.goldenHour.getMinutes()).slice(-2);
        goldenHourEnd = ('0' + times.goldenHourEnd.getHours()).slice(-2) + ':' + ('0' + times.goldenHourEnd.getMinutes()).slice(-2);

        adapter.log.debug('goldenHourEnd today: ' + goldenHourEnd);
        adapter.log.debug('goldenHour today: ' + goldenHour);

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
                const resLiving = resultFull.filter(d => d.typeUp == 'goldenhour');
                // Filter enabled
                let resEnabled = resLiving.filter(d => d.enabled === true);

                let result = resEnabled;

                for ( const i in result) {
                    setTimeout(function() {
                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                            if (result[i].triggerID && (state['val']) == result[i].triggerState)  {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if ((state['val']) != adapter.config.driveHeightUpAstro)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightUpAstro + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightUpAstro), false);
                                    }
                                });
                            } else if (!result[i].triggerID) {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if ((state['val']) != adapter.config.driveHeightUpAstro)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightUpAstro + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightUpAstro), false);
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
                                    if ((state['val']) != adapter.config.driveHeightDownAstro)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightDownAstro + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightDownAstro), false);
                                    }
                                });
                            } else if (!result[i].triggerID) {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if ((state['val']) != adapter.config.driveHeightDownAstro)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightDownAstro + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightDownAstro), false);
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
                                    if ((state['val']) != adapter.config.driveHeightUpAstro)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightUpAstro + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightUpAstro), false);
                                    }
                                });
                            } else if (!result[i].triggerID) {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if ((state['val']) != adapter.config.driveHeightUpAstro)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightUpAstro + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightUpAstro), false);
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
                                    if ((state['val']) != adapter.config.driveHeightDownAstro)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightDownAstro + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightDownAstro), false);
                                    }
                                });
                            } else if (!result[i].triggerID) {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if ((state['val']) != adapter.config.driveHeightDownAstro)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightDownAstro + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightDownAstro), false);
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
                                if ((state['val']) != adapter.config.driveHeightUpLiving)  {
                                    adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightUpLiving + '%')
                                    adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightUpLiving), false);
                                }
                            });
                        } else if (!result[i].triggerID) {
                            adapter.getForeignState(result[i].name, (err, state) => {
                                if ((state['val']) != adapter.config.driveHeightUpLiving)  {
                                    adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightUpLiving + '%')
                                    adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightUpLiving), false);
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
                    resEnabled = resLivingAuto.filter(d => d.enabled === true);

                    result = resEnabled;

                    for ( const i in result) {
                        setTimeout(function() {
                            adapter.getForeignState(result[i].triggerID, (err, state) => {
                                if (result[i].triggerID && (state['val']) == result[i].triggerState)  {
                                    adapter.getForeignState(result[i].name, (err, state) => {
                                        if ((state['val']) != adapter.config.driveHeightUpLiving)  {
                                            adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightUpLiving + '%')
                                            adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightUpLiving), false);
                                        }
                                    });
                                } else if (!result[i].triggerID) {
                                    adapter.getForeignState(result[i].name, (err, state) => {
                                        if ((state['val']) != adapter.config.driveHeightUpLiving)  {
                                            adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightUpLiving + '%')
                                            adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightUpLiving), false);
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
                                if ((state['val']) != adapter.config.driveHeightDownLiving)  {
                                    adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightDownLiving + '%')
                                    adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightDownLiving), false);
                                }
                            });
                        } else if (!result[i].triggerID) {
                            adapter.getForeignState(result[i].name, (err, state) => {
                                if ((state['val']) != adapter.config.driveHeightDownLiving)  {
                                    adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightDownLiving + '%')
                                    adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightDownLiving), false);
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
                                        if ((state['val']) != adapter.config.driveHeightDownLiving)  {
                                            adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightDownLiving + '%')
                                            adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightDownLiving), false);
                                        }
                                    });
                                } else if (!result[i].triggerID) {
                                    adapter.getForeignState(result[i].name, (err, state) => {
                                        if ((state['val']) != adapter.config.driveHeightDownLiving)  {
                                            adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightDownLiving + '%')
                                            adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightDownLiving), false);
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
                                    if ((state['val']) != adapter.config.driveHeightUpSleep)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightUpSleep + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightUpSleep), false);
                                    }
                                });
                            } else if (!result[i].triggerID) {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if ((state['val']) != adapter.config.driveHeightUpSleep)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightUpSleep + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightUpSleep), false);
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
                                            if ((state['val']) != adapter.config.driveHeightUpSleep)  {
                                                adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightUpSleep + '%')
                                                adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightUpSleep), false);
                                            }
                                        });
                                    } else if (!result[i].triggerID) {
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if ((state['val']) != adapter.config.driveHeightUpSleep)  {
                                                adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightUpSleep + '%')
                                                adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightUpSleep), false);
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
                                    if ((state['val']) != adapter.config.driveHeightDownSleep)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightDownSleep + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightDownSleep), false);
                                    }
                                });
                            } else if (!result[i].triggerID) {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if ((state['val']) != adapter.config.driveHeightDownSleep)  {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightDownSleep + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightDownSleep), false);
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
                                                if ((state['val']) != adapter.config.driveHeightDownSleep)  {
                                                    adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightDownSleep + '%')
                                                    adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightDownSleep), false);
                                                }
                                            });
                                        } else if (!result[i].triggerID) {
                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                if ((state['val']) != adapter.config.driveHeightDownSleep)  {
                                                    adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightDownSleep + '%')
                                                    adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightDownSleep), false);
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
                const resultFull = adapter.config.events;

                if (resultFull) {
                    // Filter Sun Protect
                    const resSunProtect = resultFull.filter(d => d.sunProt === true);
                    // Filter enabled
                    let resEnabled = resSunProtect.filter(d => d.enabled === true);

                    let result = resEnabled;

                    for ( const i in result) {
                        setTimeout(function() {
                            if ((adapter.config.setpointValue) < actualValueStr || (adapter.config.setpointValueLight) < actualValueLightStr) {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if (parseFloat(state['val']) > parseFloat(adapter.config.driveHeightSun) && result[i].sunProt == true) {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightSun + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightSun), false);
                                    }
                                });
                            } else if ((adapter.config.setpointValue) > actualValueStr || (adapter.config.setpointValueLight) > actualValueLightStr){
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if (parseFloat(state['val']) < parseFloat(adapter.config.driveHeightUpLiving) && result[i].sunProt == true) {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightUpLiving + '%')
                                        adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightUpLiving), false);
                                    }
                                });
                            }
                        }, driveDelayUpSleep * i, i);
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
                    const resultFull = adapter.config.events;

                    if (resultFull) {
                        // Filter Sun Protect
                        const resSunProtect = resultFull.filter(d => d.sunProt === true);
                        // Filter enabled
                        let resEnabled = resSunProtect.filter(d => d.enabled === true);

                        let result = resEnabled;

                        for ( const i in result) {
                            setTimeout(function() {
                                adapter.getForeignState(result[i].name, (err, state) => {
                                    if (parseFloat(state['val']) < parseFloat(adapter.config.driveHeightUpLiving) && result[i].sunProt == true) {
                                        adapter.log.debug('Set ID: ' + result[i].name + ' value: ' + adapter.config.driveHeightUpLiving + '%');
                                        adapter.setForeignState(result[i].name, parseFloat(adapter.config.driveHeightUpLiving), false);
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
    // get today's sunlight times 
    let times = SunCalc.getTimes(new Date(), adapter.config.latitude, adapter.config.longitude);

    let currentPos = SunCalc.getPosition(new Date(), adapter.config.latitude, adapter.config.longitude);
 
    // get sunrise azimuth in degrees
    let currentAzimuth = currentPos.azimuth * 180 / Math.PI + 180;

    // get sunrise altitude in degrees
    let currentAltitude = currentPos.altitude * 180 / Math.PI;

    let azimuth = Math.round(10 * currentAzimuth) / 10
    let elevation = Math.round(10 * currentAltitude) / 10

    adapter.log.debug('Sun current Altitude: ' + currentAltitude + '°');
    adapter.log.debug('Sun current azimuth: ' + currentAzimuth + '°');

    adapter.log.debug('Sun Azimut: ' + azimuth + '°');
    adapter.log.debug('Sun Elevation: ' + elevation + '°');
}

function main() {
    //adapter.log.debug(JSON.stringify(adapter.config.events))
    adapter.getForeignObject('system.config', (err, obj) => {
        checkStates();
    });
    setTimeout(function() {
        checkActualStates();
        sunPos();
    }, 2000)

    // in this template all states changes inside are subscribed
    adapter.subscribeStates('control.*');

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
            resTrigger.push(resTriggerActive[i].triggerID)
        }
        resTrigger.forEach(function(element) {
            adapter.subscribeForeignStates(element);
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