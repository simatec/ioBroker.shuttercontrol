'use strict';

const { expect } = require('chai');
const { sunProtect } = require('../../build/lib/sunProtect.js');

const DRIVE_DELAY = 20; // seconds (driveDelayUpAstro)

/**
 * Adapter mock: autoSun is on, but no sensor delivers a value - so no shutter is driven.
 *
 * @returns {object} adapter mock; `delays` collects all waits, `autoSunReads` the shutters that were checked
 */
function adapterMock() {
    const delays = [];
    const autoSunReads = [];

    return {
        delays,
        autoSunReads,
        config: {
            driveDelayUpAstro: DRIVE_DELAY,
            shutterStateRound: 1,
            sunProtEndElevation: 1,
            alarmWind1: '',
            alarmWind2: '',
            alarmRain: '',
            alarmFrost: '',
            alarmFire: '',
        },
        log: { info: () => { }, debug: () => { }, warn: () => { }, error: () => { } },
        async getStateAsync(id) {
            if (id.startsWith('shutters.autoSun.')) {
                autoSunReads.push(id.replace('shutters.autoSun.', ''));
                return { val: true, ack: true };
            }
            return null;
        },
        drives: [],
        async getForeignStateAsync(id) {
            if (id.endsWith('.position')) {
                return { val: 30, ack: true };
            }
            return null;
        },
        async setForeignStateAsync(id, val) {
            this.drives.push(val);
        },
        async setStateAsync() { },
        delay: (ms) => {
            delays.push(ms);
            return Promise.resolve();
        },
        setTimeout: () => undefined,
        clearTimeout: () => { },
    };
}

/**
 * @param {string} name shutter name
 * @param {object} [overrides] properties to overwrite
 * @returns {object} an enabled shutter with sun protection by outside temperature
 */
function shutter(name, overrides) {
    return Object.assign({
        enabled: true,
        shutterName: name,
        name: `shelly.0.${name}.position`,
        type: 'only outside temperature',
        triggerID: '',
        heightUp: '100',
        heightDown: '0',
        heightDownSun: '30',
        tempSensor: '',
        outsideTempSensor: 'netatmo.0.outside',
        lightSensor: '',
        currentAction: 'up',
        currentHeight: 100,
        KeepSunProtect: false,
        triggerState: 'none',
        triggerStateTilted: 'none',
        autoDrive: 'off',
        sunProtectEndtimerid: '',
    }, overrides);
}

describe('sun protection: resources', () => {
    it('does not wait the drive delay for shutters that were not driven (day)', async () => {
        const adapter = adapterMock();
        const settings = [shutter('A'), shutter('B'), shutter('C')];

        await sunProtect(adapter, 30, 180, settings);

        expect(adapter.autoSunReads).to.deep.equal(['A', 'B', 'C']);
        expect(adapter.delays).to.not.include(DRIVE_DELAY * 1000);
    });

    it('still waits the drive delay after a real drive', async () => {
        const adapter = adapterMock();
        const settings = [shutter('A', { currentAction: 'sunProtect', currentHeight: 30 })];

        // sun at the end elevation of the sun protection: the shutter in sun protection goes up
        await sunProtect(adapter, 0.5, 250, settings);

        expect(adapter.drives).to.deep.equal([100]);
        expect(adapter.delays).to.include(DRIVE_DELAY * 1000);
    });

    it('only checks the shutters that use the changed sensor', async () => {
        const adapter = adapterMock();
        const settings = [
            shutter('A', { outsideTempSensor: 'netatmo.0.outside' }),
            shutter('B', { outsideTempSensor: 'other.0.outside' }),
            shutter('C', { outsideTempSensor: '', lightSensor: 'netatmo.0.outside' }),
        ];

        await sunProtect(adapter, 30, 180, settings, 'netatmo.0.outside');

        expect(adapter.autoSunReads).to.deep.equal(['A', 'C']);
    });

    it('checks all shutters when the sun position changes', async () => {
        const adapter = adapterMock();
        const settings = [shutter('A'), shutter('B', { outsideTempSensor: 'other.0.outside' })];

        await sunProtect(adapter, 30, 180, settings);

        expect(adapter.autoSunReads).to.deep.equal(['A', 'B']);
    });
});
