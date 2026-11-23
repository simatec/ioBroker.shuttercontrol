'use strict';

const { expect } = require('chai');
const sunProtect = require('./sunProtect.js');

const SHUTTER_ID = 'dev.s1.level';
const TEMP_ID = 'dev.outside.temperature';
const LIGHT_ID = 'dev.outside.brightness';

/**
 * Builds an adapter mock with an outside temperature and a light sensor.
 *
 * @param {{ temp: number, light: number }} sensors current sensor values, can be changed between the runs
 * @returns {object} adapter mock, the driven values are collected in `writes`
 */
function adapterMock(sensors) {
    const writes = [];
    return {
        writes,
        config: {
            driveDelayUpAstro: 0,
            shutterStateRound: 1,
            sunProtEndElevation: 0,
            alarmWind1: '',
            alarmWind2: '',
            alarmRain: '',
            alarmFire: '',
        },
        log: { info: () => { }, debug: () => { }, warn: () => { }, error: () => { } },
        delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        setTimeout: (cb, ms, ...args) => setTimeout(cb, ms, ...args),
        clearTimeout: (timer) => clearTimeout(timer),
        async getStateAsync() {
            return { val: true, ack: true }; // shutters.autoSun.*
        },
        async getForeignStateAsync(id) {
            if (id === TEMP_ID) {
                return { val: sensors.temp, ack: true };
            }
            if (id === LIGHT_ID) {
                return { val: sensors.light, ack: true };
            }
            if (id === SHUTTER_ID) {
                return { val: writes.length ? writes[writes.length - 1] : 30, ack: true };
            }
            return null;
        },
        async setForeignStateAsync(id, val) {
            writes.push(val);
        },
        async setStateAsync() { },
    };
}

/**
 * @returns {object[]} one shutter in sun protection (30 %), type "only outside temperature"
 */
function shutterInSunProtect() {
    return [{
        shutterName: 'S1',
        name: SHUTTER_ID,
        enabled: true,
        type: 'only outside temperature',
        triggerID: '',
        autoDrive: 'onlyDown',
        driveAfterClose: false,
        outsideTempSensor: TEMP_ID,
        lightSensor: LIGHT_ID,
        tempOutside: 20,
        hysteresisOutside: 5,
        valueLight: 100,
        hysteresisLight: 50,
        heightUp: 100,
        heightDown: 0,
        heightDownSun: 30,
        currentHeight: 30,
        currentAction: 'sunProtect',
        lastAutoAction: 'down_Sunprotect',
        KeepSunProtect: false,
        heatProtection: false,
        sunProtectEndDely: 0.001, // 60 ms
        sunProtectEndtimerid: '',
    }];
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('sunProtect => end delay', function () {
    // every run of sunProtect waits 2 s before it starts
    this.timeout(20000);

    it('ends the sun protection when it stays dark after the delay', async () => {
        const sensors = { temp: 25, light: 20 };
        const adapter = adapterMock(sensors);
        const settings = shutterInSunProtect();

        await sunProtect(adapter, 30, 180, settings);
        expect(adapter.writes).to.deep.equal([]);
        await wait(100);
        expect(settings[0].sunProtectEndtimerid).to.equal('0');

        await sunProtect(adapter, 30, 180, settings);
        expect(adapter.writes).to.deep.equal([100]);
        expect(settings[0].sunProtectEndtimerid).to.equal('');
    });

    it('starts the delay again when it was bright in between', async () => {
        const sensors = { temp: 25, light: 20 };
        const adapter = adapterMock(sensors);
        const settings = shutterInSunProtect();

        await sunProtect(adapter, 30, 180, settings);
        await wait(100);
        expect(settings[0].sunProtectEndtimerid).to.equal('0');

        // bright again before the next run: the expired delay is reset
        sensors.light = 200;
        await sunProtect(adapter, 30, 180, settings);
        expect(settings[0].sunProtectEndtimerid).to.equal('');
        expect(adapter.writes).to.deep.equal([]);

        // darker again: before, the shutter opened at once - now the delay runs first
        sensors.light = 20;
        await sunProtect(adapter, 30, 180, settings);
        expect(adapter.writes).to.deep.equal([]);
        expect(settings[0].sunProtectEndtimerid).to.not.be.oneOf(['', '0']);
        adapter.clearTimeout(settings[0].sunProtectEndtimerid);
    });
});
