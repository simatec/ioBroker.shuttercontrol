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
let autoLivingStr;
let autoSleepStr;

/**
 * Starts the adapter instance
 * @param {Partial<ioBroker.AdapterOptions>} [options]
 */
function startAdapter(options) {

    options = options || {};
    Object.assign(options, {name: adapterName});

    adapter = new utils.Adapter(options);
 
    //name: 'shutter',

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
                if (id === adapter.namespace + '.control.publicHoliday') {
                    publicHolidayStr = true;
                }
                if (id === adapter.namespace + '.control.autoLiving') {
                    autoLivingStr = true;
                } 
                if (id === adapter.namespace + '.control.autoSleep') {
                    autoSleepStr = true;
                }
            }
            if ((state.val === false || state.val === 'false') && !state.ack) {
                if (id === adapter.namespace + '.control.Holiday') {
                    HolidayStr = false;
                } 
                if (id === adapter.namespace + '.control.publicHoliday') {
                    publicHolidayStr = false;
                }
                if (id === adapter.namespace + '.control.autoLiving') {
                    autoLivingStr = false;
                } 
                if (id === adapter.namespace + '.control.autoSleep') {
                    autoSleepStr = false;
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
    adapter.getState('control.publicHoliday', (err, state) => {
        if (state === null || state.val === null) {
            adapter.setState('control.publicHoliday', {val: false, ack: true});
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
    adapter.getState('control.publicHoliday', (err, state) => {
        if (state === true || state.val === true) {
            publicHolidayStr = true;
        } else {
            publicHolidayStr = false;
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
    setTimeout(function() {
        suncalculation()
    }, 1000)
}

function shuterUpLiving() {
    
    upTimeLiving = upTimeLiving.split(':');
    const upLiving = schedule.scheduleJob(upTimeLiving[1] + ' ' + upTimeLiving[0] + ' * * *', function() {
        adapter.getEnums('functions', (err, res) => {
            if (res) {
                const _result = res['enum.functions'];
                const resultID = _result['enum.functions.' + adapter.config.livingEnum];

                for ( const i in resultID.common.members) {
                    setTimeout(function() {
                        adapter.log.debug('Set ID: ' + resultID.common.members[i] + ' value: 100 ' + ' from Enum ' + adapter.config.livingEnum)
                        adapter.setForeignState(resultID.common.members[i], 100, true);
                    }, 2000 * i, i);
                }
            } else if (err) {
                adapter.log.warn('Enum: ' + adapter.config.livingEnum + ' not found!!')
            }
        });
    });
}
const calc = schedule.scheduleJob('30 2 * * *', function() {
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

    // Set Up-Time Living Area 
    if ((dayStr) > 5 || (HolidayStr) === true || (publicHolidayStr) === true) {
        upTimeLiving = adapter.config.WE_shutterUpLiving;
        adapter.setState('info.upTimeLiving', { val: upTimeLiving, ack: true });
    } else {
        if ((dayStr) < 6 && (sunriseStr) < (adapter.config.W_shutterUpLiving)) {
            upTimeLiving = adapter.config.W_shutterUpLiving;
            adapter.setState('info.upTimeLiving', { val: upTimeLiving, ack: true });
        } else if ((dayStr) < 6 && (sunriseStr) > (adapter.config.W_shutterUpLiving)) {
            upTimeLiving = sunriseStr;
            adapter.setState('info.upTimeLiving', { val: upTimeLiving, ack: true });
        } else if ((dayStr) < 6 && (sunriseStr) == (adapter.config.W_shutterUpLiving)) {
                upTimeLiving = sunriseStr;
                adapter.setState('info.upTimeLiving', { val: upTimeLiving, ack: true });
        }
    }
    shuterUpLiving();

    // Set Up-Time for Auto/Manu Living Area 

    // Set Up-Time Sleep Area 

    // Set Up-Time Auto/Manu Sleep Area 

    // Set Down-Time Living Area 

    // Set Down-Time for Auto/Manu Living Area 

    // Set Down-Time Sleep Area 

    // Set Down-Time Auto/Manu Sleep Area 
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
    /*
    adapter.getState('control.Holiday', (err, state) => {
        if (state === true || state.val === true) {
            HolidayStr = true;
        } else {
            HolidayStr = false;
        }
    });
    adapter.getState('control.publicHoliday', (err, state) => {
        if (state === true || state.val === true) {
            publicHolidayStr = true;
        } else {
            publicHolidayStr = false;
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
    */
    

    // Test Set Shutter State
    /*
    adapter.getEnums('functions', (err, res) => {
        if (res) {
            const _result = res['enum.functions'];
            const resultID = _result['enum.functions.' + adapter.config.livingEnum];

            for ( const i in resultID.common.members) {
                setTimeout(function() {
                    adapter.log.debug('Set ID: ' + resultID.common.members[i] + ' value: 100 ' + ' from Enum ' + adapter.config.livingEnum)
                    adapter.setForeignState(resultID.common.members[i], 100, true);
                }, 2000 * i, i);
            }
        } else if (err) {
            adapter.log.warn('Enum: ' + adapter.config.livingEnum + ' not found!!')
        }
    });
    */

    adapter.getForeignObject('system.config', (err, obj) => {
        checkStates();
    });
    setTimeout(function() {
        checkActualStates()
    }, 2000)



    // in this template all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('control.*');


}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}