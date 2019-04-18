'use strict';

const utils = require('@iobroker/adapter-core');
const schedule  = require('node-schedule');
const SunCalc = require('suncalc2');

/**
 * The adapter instance
 * @type {ioBroker.Adapter}
 */
let adapter;
let sunsetStr;
/** @type {string} */
let sunriseStr;

/**
 * Starts the adapter instance
 * @param {Partial<ioBroker.AdapterOptions>} [options]
 */
function startAdapter(options) {

    return adapter = utils.adapter(Object.assign({}, options, /**
         * @param {{ (): void; (): void; }} callback
         */
 /**
         * @param {any} id
         * @param {any} obj
         */
 /**
         * @param {any} id
         * @param {{ val: any; ack: any; }} state
         */
 {
        name: 'shutter',

        // The ready callback is called when databases are connected and adapter received configuration.
        // start here!
        ready: main, // Main method defined below for readability

        // is called when adapter shuts down - callback has to be called under any circumstances!
        unload: (callback) => {
            try {
                adapter.log.info('cleaned everything up...');
                callback();
            } catch (e) {
                callback();
            }
        },

        // is called if a subscribed object changes
        objectChange: (id, obj) => {
            if (obj) {
                // The object was changed
                adapter.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
            } else {
                // The object was deleted
                adapter.log.info(`object ${id} deleted`);
            }
        },

        // is called if a subscribed state changes
        stateChange: (id, state) => {
            if (state) {
                // The state was changed
                adapter.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
            } else {
                // The state was deleted
                adapter.log.info(`state ${id} deleted`);
            }
        },
    }));
}
const calc = schedule.scheduleJob('30 2 * * *', function() {
    // get today's sunlight times
    let times = SunCalc.getTimes(new Date(), adapter.config.latitude, adapter.config.longitude);

    // format sunrise time from the Date object
    sunsetStr = ('0' + times.sunset.getHours()).slice(-2) + ':' + ('0' + times.sunset.getMinutes()).slice(-2);
    sunriseStr = ('0' + times.sunrise.getHours()).slice(-2) + ':' + ('0' + times.sunrise.getMinutes()).slice(-2);

    adapter.log.debug('Sunrise: ' + sunriseStr);
    adapter.log.debug('Sunset: ' + sunsetStr);
});

function suncalculation () {
    // get today's sunlight times 
    let times = SunCalc.getTimes(new Date(), adapter.config.latitude, adapter.config.longitude);

    // format sunrise time from the Date object
    sunsetStr = ('0' + times.sunset.getHours()).slice(-2) + ':' + ('0' + times.sunset.getMinutes()).slice(-2);
    sunriseStr = ('0' + times.sunrise.getHours()).slice(-2) + ':' + ('0' + times.sunrise.getMinutes()).slice(-2);

    adapter.log.debug('Sunrise: ' + sunriseStr);
    adapter.log.debug('Sunset: ' + sunsetStr);
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
    suncalculation ();
    //testfunc();
    let Testzeit;
    let sonnena;

    Testzeit = adapter.config.W_shutterUpLiving;
    sonnena = sunriseStr;

    if ((sonnena) > (Testzeit)) {
        adapter.log.debug(('Sonnenaufgang nach Startzeit'));
    } else if ((sonnena) < (Testzeit)) {
        adapter.log.debug(('Sonnenaufgang vor Startzeit'));
    }

    // Test Set Shutter State
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

    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // adapter.config:
    adapter.log.info('config UseAstro: ' + adapter.config.UseAstro);
    adapter.log.info('config W_shutterUpSleep: ' + adapter.config.W_shutterUpSleep);
    adapter.log.info('config W_shutterDownSleep: ' + adapter.config.W_shutterDownSleep);
    adapter.log.info('config W_shutterDownLiving: ' + adapter.config.W_shutterDownLiving);
    adapter.log.info('config W_shutterUpLiving: ' + adapter.config.W_shutterUpLiving);
    adapter.log.info('config astroDelay: ' + adapter.config.astroDelay);
    adapter.log.info('config WE_shutterUpSleep: ' + adapter.config.WE_shutterUpSleep);
    adapter.log.info('config WE_shutterDownSleep: ' + adapter.config.WE_shutterDownSleep);
    adapter.log.info('config WE_shutterDownLiving: ' + adapter.config.WE_shutterDownLiving);
    adapter.log.info('config WE_shutterUpLiving: ' + adapter.config.WE_shutterUpLiving);
    adapter.log.info('config publicHolidays: ' + adapter.config.publicHolidays);
    adapter.log.info('config stateHoliday: ' + adapter.config.stateHoliday);
    adapter.log.info('config livingEnum: ' + adapter.config.livingEnum);
    adapter.log.info('config sleepEnum: ' + adapter.config.sleepEnum);
    adapter.log.info('config autoEnum: ' + adapter.config.autoEnum);

    /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
    */
    adapter.setObject('testVariable', {
        type: 'state',
        common: {
            name: 'testVariable',
            type: 'boolean',
            role: 'indicator',
            read: true,
            write: true,
        },
        native: {},
    });

    // in this template all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');

    /*
        setState examples
        you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
    */
    // the variable testVariable is set to true as command (ack=false)
    adapter.setState('testVariable', true);

    // same thing, but the value is flagged "ack"
    // ack should be always set to true if the value is received from or acknowledged from the target system
    adapter.setState('testVariable', { val: true, ack: true });

    // same thing, but the state is deleted after 30s (getState will return null afterwards)
    adapter.setState('testVariable', { val: true, ack: true, expire: 30 });
}

if (module.parent) {
    // Export startAdapter in compact mode
    module.exports = startAdapter;
} else {
    // otherwise start the instance directly
    startAdapter();
}