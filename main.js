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
let upTimeSleep;
let upTimeLiving;
let downTimeSleep;
let downTimeLiving;
let dayStr;
let HolidayStr;
let publicHolidayStr;
let publicHolidayTomorowStr;
let autoLivingStr;
let autoSleepStr;
let upLiving;
let upSleep;
let downLiving;
let downSleep;

/**
 * Starts the adapter instance
 * @param {Partial<ioBroker.AdapterOptions>} [options]
 */
function startAdapter(options) {

    options = options || {};
    Object.assign(options, {name: adapterName});

    adapter = new utils.Adapter(options);
 
    // The ready callback is called when databases are connected and adapter received configuration.
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
    adapter.on('objectChange', (id, obj) => {
        if (obj) {
            // The object was changed
            adapter.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
            suncalculation();
        } else {
            // The object was deleted
            adapter.log.info(`object ${id} deleted`);
        }
    });

    // is called if a subscribed state changes
    adapter.on('stateChange', (id, state) => {
        if (state) {
            // The state was changed
            adapter.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);

            if ((state.val === true || state.val === 'true') && !state.ack) {
                if (id === adapter.namespace + '.control.Holiday') {
                    HolidayStr = true;
                }
                if (id === adapter.namespace + '.control.autoLiving') {
                    autoLivingStr = true;
                } 
                if (id === adapter.namespace + '.control.autoSleep') {
                    autoSleepStr = true;
                }
                if (adapter.config.publicHolidays === true) {
                    if (id === adapter.config.publicHolInstance + '.heute.boolean') {
                        publicHolidayStr = true;
                    }
                    if (id === adapter.config.publicHolInstance + '.morgen.boolean') {
                        publicHolidayTomorowStr = true;
                    }
                }
            }
            if ((state.val === false || state.val === 'false') && !state.ack) {
                if (id === adapter.namespace + '.control.Holiday') {
                    HolidayStr = false;
                }
                if (id === adapter.namespace + '.control.autoLiving') {
                    autoLivingStr = false;
                } 
                if (id === adapter.namespace + '.control.autoSleep') {
                    autoSleepStr = false;
                }
                if (adapter.config.publicHolidays === true) {
                    if (id === adapter.config.publicHolInstance + '.heute.boolean') {
                        publicHolidayStr = false;
                    }
                    if (id === adapter.config.publicHolInstance + '.morgen.boolean') {
                        publicHolidayTomorowStr = false;
                    }
                }
            }
            suncalculation();
        } else {
            // The state was deleted
            adapter.log.info(`state ${id} deleted`);
        }
    });
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
        if (state === true || state.val === true) {
            HolidayStr = true;
        } else {
            HolidayStr = false;
        }
    });
    adapter.getState('control.autoLiving', (err, state) => {
        if (state === true || state.val === true) {
            autoLivingStr = true;
        } else {
            autoLivingStr = false;
        }
    });
    adapter.getState('control.autoSleep', (err, state) => {
        if (state === true || state.val === true) {
            autoSleepStr = true;
        } else {
            autoSleepStr = false;
        }
    });

    if (adapter.config.publicHolidays === true) {
        adapter.getForeignState(adapter.config.publicHolInstance + '.heute.boolean', (err, state) => {
            if (state !== null || state.val !== null) {
                if (state === true || state.val === true) {
                    publicHolidayStr = true;
                } else {
                    publicHolidayStr = false;
                }
            }
        });
        adapter.getForeignState(adapter.config.publicHolInstance + '.morgen.boolean', (err, state) => {
            if (state !== null || state.val !== null) {
                if (state === true || state.val === true) {
                    publicHolidayTomorowStr = true;
                } else {
                    publicHolidayTomorowStr = false;
                }
            }
        });
    }
    setTimeout(function() {
        suncalculation()
    }, 1000)
}

const calc = schedule.scheduleJob('calcTimer', '30 2 * * *', function() {
    suncalculation();
});

function suncalculation() {
    // get today's sunlight times 
    let times = SunCalc.getTimes(new Date(), adapter.config.latitude, adapter.config.longitude);

    // format sunrise time from the Date object
    sunsetStr = ('0' + times.sunset.getHours()).slice(-2) + ':' + ('0' + times.sunset.getMinutes()).slice(-2);
    sunriseStr = ('0' + times.sunrise.getHours()).slice(-2) + ':' + ('0' + times.sunrise.getMinutes()).slice(-2);
    dayStr = times.sunrise.getDay();

    adapter.log.debug('Day: ' + dayStr);
    adapter.log.debug('Sunrise: ' + sunriseStr);
    adapter.setState('info.Sunrise', { val: sunriseStr, ack: true });
    adapter.log.debug('Sunset: ' + sunsetStr);
    adapter.setState('info.Sunset', { val: sunsetStr, ack: true });

    addMinutesSunrise(sunriseStr, adapter.config.astroDelayUp); // Add Delay for Sunrise
    addMinutesSunset(sunsetStr, adapter.config.astroDelayDown); // Add Delay for Sunset

    // ******** Set Up-Time Living Area ******** 
    if ((dayStr) > 5 || (HolidayStr) === true || (publicHolidayStr) === true) {
        upTimeLiving = adapter.config.WE_shutterUpLiving;
        adapter.setState('info.upTimeLiving', { val: upTimeLiving, ack: true });
    } else {
        if ((dayStr) < 6 && (sunriseStr) > (adapter.config.W_shutterUpLivingMax)) {
            upTimeLiving = adapter.config.W_shutterUpLivingMax;
            adapter.setState('info.upTimeLiving', { val: upTimeLiving, ack: true });
        } else if ((dayStr) < 6 && (sunriseStr) > (adapter.config.W_shutterUpLivingMin) && (sunriseStr) < (adapter.config.W_shutterUpLivingMax)) {
            upTimeLiving = sunriseStr;
            adapter.setState('info.upTimeLiving', { val: upTimeLiving, ack: true });
        } else if ((dayStr) < 6 && (adapter.config.W_shutterUpLivingMin) == (adapter.config.W_shutterUpLivingMax)) {
            upTimeLiving = adapter.config.W_shutterUpLivingMax;
            adapter.setState('info.upTimeLiving', { val: upTimeLiving, ack: true });
        } else if ((dayStr) < 6 && (sunriseStr) == (adapter.config.W_shutterUpLivingMax)) {
                upTimeLiving = sunriseStr;
                adapter.setState('info.upTimeLiving', { val: upTimeLiving, ack: true });
        }
    }
    shutterUpLiving();

    // ******** Set Up-Time Sleep Area ********
    if ((dayStr) > 5 || (HolidayStr) === true || (publicHolidayStr) === true) {
        upTimeSleep = adapter.config.WE_shutterUpSleep;
        adapter.setState('info.upTimeSleep', { val: upTimeSleep, ack: true });
    } else {
        if ((dayStr) < 6 && (sunriseStr) > (adapter.config.W_shutterUpSleepMax)) {
            upTimeSleep = adapter.config.W_shutterUpSleepMax;
            adapter.setState('info.upTimeSleep', { val: upTimeSleep, ack: true });
        } else if ((dayStr) < 6 && (sunriseStr) > (adapter.config.W_shutterUpSleepMin) && (sunriseStr) < (adapter.config.W_shutterUpSleepMax)) {
            upTimeSleep = sunriseStr;
            adapter.setState('info.upTimeSleep', { val: upTimeSleep, ack: true });
        } else if ((dayStr) < 6 && (adapter.config.W_shutterUpSleepMin) == (adapter.config.W_shutterUpSleepMax)) {
            upTimeSleep = adapter.config.W_shutterUpSleepMax;
            adapter.setState('info.upTimeSleep', { val: upTimeSleep, ack: true });
        } else if ((dayStr) < 6 && (sunriseStr) == (adapter.config.W_shutterUpSleepMax)) {
                upTimeSleep = sunriseStr;
                adapter.setState('info.upTimeSleep', { val: upTimeSleep, ack: true });
        }
    }
    shutterUpSleep();

    // ******** Set Down-Time Living Area ********
    if (((dayStr) == 5 || (dayStr) == 6 || (HolidayStr) === true || (publicHolidayTomorowStr) === true) && (adapter.config.WE_shutterDownLiving) < (sunsetStr)) {
        downTimeLiving = adapter.config.WE_shutterDownLiving;
        adapter.setState('info.downTimeLiving', { val: downTimeLiving, ack: true });
    } else if (((dayStr) == 5 || (dayStr) == 6 || (HolidayStr) === true || (publicHolidayTomorowStr) === true) && (adapter.config.WE_shutterDownLiving) > (sunsetStr)) {
        downTimeLiving = sunsetStr;
        adapter.setState('info.downTimeLiving', { val: downTimeLiving, ack: true });
    } else if (((dayStr) == 5 || (dayStr) == 6 || (HolidayStr) === true || (publicHolidayTomorowStr) === true) && (adapter.config.WE_shutterDownLiving) == (sunsetStr)) {
        downTimeLiving = sunsetStr;
        adapter.setState('info.downTimeLiving', { val: downTimeLiving, ack: true });
    } else if (((dayStr) < 5 || (dayStr) == 7) && (sunsetStr) > (adapter.config.W_shutterDownLiving)) {
        downTimeLiving = adapter.config.W_shutterDownLiving;
        adapter.setState('info.downTimeLiving', { val: downTimeLiving, ack: true });
    } else if (((dayStr) < 5 || (dayStr) == 7) && (sunsetStr) < (adapter.config.W_shutterDownLiving)) {
        downTimeLiving = sunsetStr;
        adapter.setState('info.downTimeLiving', { val: downTimeLiving, ack: true });
    } else if (((dayStr) < 5 || (dayStr) == 7) && (sunsetStr) == (adapter.config.W_shutterDownLiving)) {
            downTimeLiving = sunsetStr;
            adapter.setState('info.downTimeLiving', { val: downTimeLiving, ack: true });
    }
    shutterDownLiving();

    // ******** Set Down-Time Sleep Area ******** 
    if (((dayStr) == 5 || (dayStr) == 6 || (HolidayStr) === true || (publicHolidayTomorowStr) === true) && (adapter.config.WE_shutterDownSleep) < (sunsetStr)) {
        downTimeSleep = adapter.config.WE_shutterDownSleep;
        adapter.setState('info.downTimeSleep', { val: downTimeSleep, ack: true });
    } else if (((dayStr) == 5 || (dayStr) == 6 || (HolidayStr) === true || (publicHolidayTomorowStr) === true) && (adapter.config.WE_shutterDownSleep) > (sunsetStr)) {
        downTimeSleep = sunsetStr;
        adapter.setState('info.downTimeSleep', { val: downTimeSleep, ack: true });
    } else if (((dayStr) == 5 || (dayStr) == 6 || (HolidayStr) === true || (publicHolidayTomorowStr) === true) && (adapter.config.WE_shutterDownSleep) == (sunsetStr)) {
        downTimeSleep = sunsetStr;
        adapter.setState('info.downTimeSleep', { val: downTimeSleep, ack: true });
    } else if (((dayStr) < 5 || (dayStr) == 7) && (sunsetStr) > (adapter.config.W_shutterDownSleep)) {
        downTimeSleep = adapter.config.W_shutterDownSleep;
        adapter.setState('info.downTimeSleep', { val: downTimeSleep, ack: true });
    } else if (((dayStr) < 5 || (dayStr) == 7) && (sunsetStr) < (adapter.config.W_shutterDownSleep)) {
        downTimeSleep = sunsetStr;
        adapter.setState('info.downTimeSleep', { val: downTimeSleep, ack: true });
    } else if (((dayStr) < 5 || (dayStr) == 7) && (sunsetStr) == (adapter.config.W_shutterDownSleep)) {
            downTimeSleep = sunsetStr;
            adapter.setState('info.downTimeSleep', { val: downTimeSleep, ack: true });
    }
    shutterDownSleep();

}
// Add delay Time for Sunrise
function addMinutesSunrise(time, minsToAdd) {
    function D(J){ return (J<10? '0':'') + J;};
    var piece = time.split(':');
    var mins = piece[0]*60 + +piece[1] + +minsToAdd;
    sunriseStr = (D(mins%(24*60)/60 | 0) + ':' + D(mins%60));
    return D(mins%(24*60)/60 | 0) + ':' + D(mins%60);
}
// Add delay Time for Sunset
function addMinutesSunset(time, minsToAdd) {
    function D(J){ return (J<10? '0':'') + J;};
    var piece = time.split(':');
    var mins = piece[0]*60 + +piece[1] + +minsToAdd;
    sunsetStr = (D(mins%(24*60)/60 | 0) + ':' + D(mins%60));
    return D(mins%(24*60)/60 | 0) + ':' + D(mins%60);
}

function shutterUpLiving() {
    
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving * 1000;
    
    if ((upTimeLiving) == undefined) {
        upTimeLiving = adapter.config.W_shutterUpLivingMax;
    }
    let upTime = upTimeLiving.split(':');

    schedule.cancelJob('shutterUpLiving');
    
    upLiving = schedule.scheduleJob('shutterUpLiving', upTime[1] + ' ' + upTime[0] + ' * * *', function() {
        adapter.getEnums('functions', (err, res) => {
            if (res) {
                const _result = res['enum.functions'];
                const resultID = _result['enum.functions.' + adapter.config.livingEnum];

                for ( const i in resultID.common.members) {
                    setTimeout(function() {
                        adapter.log.debug('Set ID: ' + resultID.common.members[i] + ' value: 100 ' + ' from Enum ' + adapter.config.livingEnum)
                        adapter.setForeignState(resultID.common.members[i], 100, true);
                    }, driveDelayUpLiving * i, i);
                }
            } else if (err) {
                adapter.log.warn('Enum: ' + adapter.config.livingEnum + ' not found!!')
            }
        });
        setTimeout(function() {
            if ((autoLivingStr) === true) {
                adapter.getEnums('functions', (err, res) => {
                    if (res) {
                        const _result = res['enum.functions'];
                        const resultID = _result['enum.functions.' + adapter.config.livingEnumAuto];
        
                        for ( const i in resultID.common.members) {
                            setTimeout(function() {
                                adapter.log.debug('Set ID: ' + resultID.common.members[i] + ' value: 100 ' + ' from Enum ' + adapter.config.livingEnumAuto)
                                adapter.setForeignState(resultID.common.members[i], 100, true);
                            }, driveDelayUpLiving * i, i);
                        }
                    } else if (err) {
                        adapter.log.warn('Enum: ' + adapter.config.livingEnumAuto + ' not found!!')
                    }
                });
            }
        }, driveDelayUpLiving)
    });
}

function shutterDownLiving() {
    
    const driveDelayUpLiving = adapter.config.driveDelayUpLiving * 1000;

    if ((downTimeLiving) == undefined) {
        downTimeLiving = adapter.config.W_shutterDownLiving
    }
    let downTime = downTimeLiving.split(':');

    schedule.cancelJob('shutterDownLiving');
    
    downLiving = schedule.scheduleJob('shutterDownLiving', downTime[1] + ' ' + downTime[0] + ' * * *', function() {
        adapter.getEnums('functions', (err, res) => {
            if (res) {
                const _result = res['enum.functions'];
                const resultID = _result['enum.functions.' + adapter.config.livingEnum];

                for ( const i in resultID.common.members) {
                    setTimeout(function() {
                        adapter.log.debug('Set ID: ' + resultID.common.members[i] + ' value: 0 ' + ' from Enum ' + adapter.config.livingEnum)
                        adapter.setForeignState(resultID.common.members[i], 0, true);
                    }, driveDelayUpLiving * i, i);
                }
            } else if (err) {
                adapter.log.warn('Enum: ' + adapter.config.livingEnum + ' not found!!')
            }
        });
        setTimeout(function() {
            if ((autoLivingStr) === true) {
                adapter.getEnums('functions', (err, res) => {
                    if (res) {
                        const _result = res['enum.functions'];
                        const resultID = _result['enum.functions.' + adapter.config.livingEnumAuto];
        
                        for ( const i in resultID.common.members) {
                            setTimeout(function() {
                                adapter.log.debug('Set ID: ' + resultID.common.members[i] + ' value: 0 ' + ' from Enum ' + adapter.config.livingEnumAuto)
                                adapter.setForeignState(resultID.common.members[i], 0, true);
                            }, driveDelayUpLiving * i, i);
                        }
                    } else if (err) {
                        adapter.log.warn('Enum: ' + adapter.config.livingEnumAuto + ' not found!!')
                    }
                });
            }
        }, driveDelayUpLiving)
    });
}

function shutterUpSleep() {
    
    const driveDelayUpSleep = adapter.config.driveDelayUpSleep * 1000;

    if ((upTimeSleep) == undefined) {
        upTimeSleep = adapter.config.W_shutterUpSleepMax
    }
    let upTime = upTimeSleep.split(':');
    
    schedule.cancelJob('shutterUpSleep');

    upSleep = schedule.scheduleJob('shutterUpSleep', upTime[1] + ' ' + upTime[0] + ' * * *', function() {
        adapter.getEnums('functions', (err, res) => {
            if (res) {
                const _result = res['enum.functions'];
                const resultID = _result['enum.functions.' + adapter.config.sleepEnum];

                for ( const i in resultID.common.members) {
                    setTimeout(function() {
                        adapter.log.debug('Set ID: ' + resultID.common.members[i] + ' value: 100 ' + ' from Enum ' + adapter.config.sleepEnum)
                        adapter.setForeignState(resultID.common.members[i], 100, true);
                    }, driveDelayUpSleep * i, i);
                }
            } else if (err) {
                adapter.log.warn('Enum: ' + adapter.config.sleepEnum + ' not found!!')
            }
        });
        setTimeout(function() {
            if ((autoSleepStr) === true) {
                adapter.getEnums('functions', (err, res) => {
                    if (res) {
                        const _result = res['enum.functions'];
                        const resultID = _result['enum.functions.' + adapter.config.sleepEnumAuto];
        
                        for ( const i in resultID.common.members) {
                            setTimeout(function() {
                                adapter.log.debug('Set ID: ' + resultID.common.members[i] + ' value: 100 ' + ' from Enum ' + adapter.config.sleepEnumAuto)
                                adapter.setForeignState(resultID.common.members[i], 100, true);
                            }, driveDelayUpSleep * i, i);
                        }
                    } else if (err) {
                        adapter.log.warn('Enum: ' + adapter.config.sleepEnumAuto + ' not found!!')
                    }
                });
            }
        }, driveDelayUpSleep)
    });
}

function shutterDownSleep() {
    
    const driveDelayUpSleep = adapter.config.driveDelayUpSleep * 1000;

    if ((downTimeSleep) == undefined) {
        downTimeSleep = adapter.config.W_shutterDownSleep
    }
    let downTime = downTimeSleep.split(':');

    schedule.cancelJob('shutterDownSleep');

    downSleep = schedule.scheduleJob('shutterDownSleep', downTime[1] + ' ' + downTime[0] + ' * * *', function() {
        adapter.getEnums('functions', (err, res) => {
            if (res) {
                const _result = res['enum.functions'];
                const resultID = _result['enum.functions.' + adapter.config.sleepEnum];

                for ( const i in resultID.common.members) {
                    setTimeout(function() {
                        adapter.log.debug('Set ID: ' + resultID.common.members[i] + ' value: 0 ' + ' from Enum ' + adapter.config.sleepEnum)
                        adapter.setForeignState(resultID.common.members[i], 0, true);
                    }, driveDelayUpSleep * i, i);
                }
            } else if (err) {
                adapter.log.warn('Enum: ' + adapter.config.sleepEnum + ' not found!!')
            }
        });
        setTimeout(function() {
            if ((autoSleepStr) === true) {
                adapter.getEnums('functions', (err, res) => {
                    if (res) {
                        const _result = res['enum.functions'];
                        const resultID = _result['enum.functions.' + adapter.config.sleepEnumAuto];
        
                        for ( const i in resultID.common.members) {
                            setTimeout(function() {
                                adapter.log.debug('Set ID: ' + resultID.common.members[i] + ' value: 0 ' + ' from Enum ' + adapter.config.sleepEnumAuto)
                                adapter.setForeignState(resultID.common.members[i], 0, true);
                            }, driveDelayUpSleep * i, i);
                        }
                    } else if (err) {
                        adapter.log.warn('Enum: ' + adapter.config.sleepEnumAuto + ' not found!!')
                    }
                });
            }
        }, driveDelayUpSleep)
    });
}
  
/*
async function testfunc() {
const test = await adapter.getEnumAsync('functions')
adapter.log.warn('Resultat: ' + JSON.stringify(test));
  const test_1 = test['result']
  const test_2 = test_1['enum.functions.' + adapter.config.livingEnum];
  adapter.log.warn(JSON.stringify(test_2.common.members));
  setTimeout(function() {
  for (const i in test_2.common.members) {
    
        adapter.log.warn(test_2.common.members[i])
        adapter.setForeignState(test_2.common.members[i], 60, true);
    
   }
    }, 2000);
}
*/

function main() {

    adapter.getForeignObject('system.config', (err, obj) => {
        checkStates();
    });
    setTimeout(function() {
        checkActualStates()
    }, 2000)

    // in this template all states changes inside are subscribed
    adapter.subscribeStates('control.*');

    if (adapter.config.publicHolidays === true) {
        adapter.subscribeForeignStates(adapter.config.publicHolInstance + '.heute.*');
        adapter.subscribeForeignStates(adapter.config.publicHolInstance + '.morgen.*');
    }
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}