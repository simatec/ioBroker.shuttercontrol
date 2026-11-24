'use strict';

const { expect } = require('chai');
const { shutterAlarm, isAlarmStateChanged, hasAlarmTriggerLevel } = require('../../build/lib/shutterAlarm.js');
const { setShutterState } = require('../../build/lib/setShutter.js');

const SHUTTER_ID = 'zigbee.0.shutter.position';
const RAIN_ID = 'javascript.0.rain';

/**
 * Builds an adapter mock with a rain alarm and a shutter position.
 *
 * @param {object} [options] rain (value of the rain alarm), shutterLevel
 * @returns {object} adapter mock, the driven values are collected in `writes`
 */
function adapterMock(options) {
    const opts = Object.assign({ rain: false, shutterLevel: 0 }, options);
    const writes = [];

    return {
        writes,
        config: {
            shutterStateRound: 1,
            driveDelayUpAstro: 0,
            alarmWind1: '',
            alarmWind2: '',
            alarmRain: RAIN_ID,
            alarmFrost: '',
            alarmFire: '',
            alarmRainLevel: 100,
        },
        log: { info: () => { }, debug: () => { }, warn: () => { }, error: () => { } },
        async getForeignStateAsync(id) {
            if (id === RAIN_ID) {
                return { val: opts.rain, ack: true };
            }
            if (id === SHUTTER_ID) {
                return { val: opts.shutterLevel, ack: true };
            }
            return null;
        },
        async setForeignStateAsync(id, val) {
            writes.push({ id, val });
            opts.shutterLevel = val;
        },
        async setStateAsync() { },
    };
}

/**
 * Builds a shutter setting with the rain alarm enabled and no window contact.
 *
 * @param {object} [overrides] properties to overwrite
 * @returns {object} shutter settings
 */
function settings(overrides) {
    return Object.assign(
        {
            enabled: true,
            shutterName: 'test shutter',
            name: SHUTTER_ID,
            triggerID: '',
            heightUp: '100',
            heightDown: '0',
            enableAlarmRain: true,
            currentHeight: 100,
            currentAction: 'rain',
        },
        overrides,
    );
}

describe('shutterAlarm => isAlarmStateChanged', () => {
    it('returns true when the value has changed (ts equals lc)', () => {
        expect(isAlarmStateChanged({ val: false, ts: 1000, lc: 1000 })).to.equal(true);
    });

    it('returns false when the state was only refreshed with the same value', () => {
        expect(isAlarmStateChanged({ val: false, ts: 2000, lc: 1000 })).to.equal(false);
    });

    it('returns true when the time of the last change is unknown', () => {
        expect(isAlarmStateChanged({ val: true, ts: 2000 })).to.equal(true);
    });

    it('returns false without a state', () => {
        expect(isAlarmStateChanged(null)).to.equal(false);
        expect(isAlarmStateChanged(undefined)).to.equal(false);
    });
});

describe('shutterAlarm => hasAlarmTriggerLevel', () => {
    it('accepts numbers and numeric strings, 0 included', () => {
        expect(hasAlarmTriggerLevel({ alarmTriggerLevel: 0 })).to.equal(true);
        expect(hasAlarmTriggerLevel({ alarmTriggerLevel: '35' })).to.equal(true);
    });

    it('rejects missing or invalid values', () => {
        expect(hasAlarmTriggerLevel({})).to.equal(false);
        expect(hasAlarmTriggerLevel({ alarmTriggerLevel: null })).to.equal(false);
        expect(hasAlarmTriggerLevel({ alarmTriggerLevel: '' })).to.equal(false);
        expect(hasAlarmTriggerLevel({ alarmTriggerLevel: NaN })).to.equal(false);
    });
});

describe('shutterAlarm => end of an alarm', () => {
    it('drives back to the saved position', async () => {
        const adapter = adapterMock({ rain: false, shutterLevel: 100 });
        const shutters = [settings({ alarmTriggerLevel: 30, alarmTriggerAction: 'sunProtect' })];

        await shutterAlarm(adapter, 'alarmRain', shutters);

        expect(adapter.writes).to.deep.equal([{ id: SHUTTER_ID, val: 30 }]);
        expect(shutters[0].currentAction).to.equal('sunProtect');
    });

    it('does not drive when no position was saved before the alarm', async () => {
        const adapter = adapterMock({ rain: false, shutterLevel: 100 });
        const shutters = [settings({ alarmTriggerLevel: undefined, alarmTriggerAction: undefined })];

        await shutterAlarm(adapter, 'alarmRain', shutters);

        expect(adapter.writes).to.deep.equal([]);
        expect(shutters[0].currentHeight).to.equal(100);
    });
});

describe('setShutter => setShutterState', () => {
    it('does not send an invalid level to the shutter', async () => {
        const adapter = adapterMock();
        const shutter = settings();

        await setShutterState(adapter, [shutter], shutter, NaN, 'test_shutter', 'test');
        await setShutterState(adapter, [shutter], shutter, undefined, 'test_shutter', 'test');

        expect(adapter.writes).to.deep.equal([]);
    });

    it('sends a valid level, 0 included', async () => {
        const adapter = adapterMock();
        const shutter = settings();

        await setShutterState(adapter, [shutter], shutter, 0, 'test_shutter', 'test');

        expect(adapter.writes).to.deep.equal([{ id: SHUTTER_ID, val: 0 }]);
    });
});
