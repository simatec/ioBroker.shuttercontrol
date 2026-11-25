'use strict';

const { expect } = require('chai');
const { elevationDown } = require('../../build/lib/elevationDown.js');

const SHUTTER_ID = 'shelly.0.shutter.position';
const RAIN_ID = 'javascript.0.rain';

/**
 * @param {Date} date day
 * @returns {string} the day as "D.M." like in the configuration
 */
function day(date) {
    return `${date.getDate()}.${date.getMonth() + 1}.`;
}

/**
 * Builds an adapter mock: the shutter is open (100 %), autoDown is on.
 *
 * @param {object} [options] summer (summer period active today), rain (rain alarm active)
 * @returns {object} adapter mock, the driven values are collected in `writes`
 */
function adapterMock(options) {
    const opts = Object.assign({ summer: false, rain: false }, options);
    const writes = [];
    const yesterday = new Date(Date.now() - 86400000);
    const tomorrow = new Date(Date.now() + 86400000);

    return {
        writes,
        config: {
            shutterStateRound: 1,
            driveDelayUpAstro: 0,
            betweenPositionTime: '00:00',
            sunProtEndElevation: -90,
            SummerStart: opts.summer ? day(yesterday) : '',
            SummerEnd: opts.summer ? day(tomorrow) : '',
            alarmWind1: '',
            alarmWind2: '',
            alarmRain: RAIN_ID,
            alarmFrost: '',
            alarmFire: '',
        },
        log: { info: () => { }, debug: () => { }, warn: () => { }, error: () => { } },
        async getStateAsync(id) {
            if (id.startsWith('shutters.autoDown.')) {
                return { val: true, ack: true };
            }
            return null;
        },
        async getForeignStateAsync(id) {
            if (id === RAIN_ID) {
                return { val: opts.rain, ack: true };
            }
            if (id === SHUTTER_ID) {
                return { val: writes.length ? writes[writes.length - 1] : 100, ack: true };
            }
            return null;
        },
        async setForeignStateAsync(id, val) {
            writes.push(val);
        },
        async setStateAsync() { },
        delay: () => Promise.resolve(),
        setTimeout: () => undefined, // the sun protect check 2 minutes later is not part of these tests
        clearTimeout: () => { },
    };
}

/**
 * @param {object} [overrides] properties to overwrite
 * @returns {object[]} one open shutter of type elevation (down at 8°), last alarm position 100 %
 */
function shutters(overrides) {
    return [Object.assign({
        enabled: true,
        shutterName: 'S1',
        name: SHUTTER_ID,
        typeUp: 'living',
        typeDown: 'elevation',
        elevation: '8',
        triggerID: '',
        heightUp: '100',
        heightDown: '0',
        betweenPosition: false,
        inSummerNotDown: false,
        enableAlarmRain: true,
        currentHeight: 100,
        currentAction: 'up',
        alarmTriggerLevel: 100,
        alarmTriggerAction: 'up',
    }, overrides)];
}

describe('alarm position (alarmTriggerLevel) of the elevation drive', () => {
    it('is not changed while the sun is above the elevation of the shutter', async () => {
        const adapter = adapterMock();
        const settings = shutters();

        await elevationDown(adapter, 30, 200, settings);

        expect(adapter.writes).to.deep.equal([]);
        expect(settings[0].alarmTriggerLevel).to.equal(100);
        expect(settings[0].alarmTriggerAction).to.equal('up');
    });

    it('is not changed when "in summer not down" blocks the drive', async () => {
        const adapter = adapterMock({ summer: true });
        const settings = shutters({ inSummerNotDown: true });

        await elevationDown(adapter, 8, 200, settings);

        expect(adapter.writes).to.deep.equal([]);
        expect(settings[0].alarmTriggerLevel).to.equal(100);
    });

    it('is set to the down position when the shutter is driven down', async () => {
        const adapter = adapterMock();
        const settings = shutters();

        await elevationDown(adapter, 8, 200, settings);

        expect(adapter.writes).to.deep.equal([0]);
        expect(settings[0].alarmTriggerLevel).to.equal(0);
        expect(settings[0].alarmTriggerAction).to.equal('down');
    });

    it('is set to the down position when an alarm holds the shutter, so it closes after the alarm', async () => {
        const adapter = adapterMock({ rain: true });
        const settings = shutters();

        await elevationDown(adapter, 8, 200, settings);

        expect(adapter.writes).to.deep.equal([]);
        expect(settings[0].alarmTriggerLevel).to.equal(0);
        expect(settings[0].alarmTriggerAction).to.equal('down');
    });
});
