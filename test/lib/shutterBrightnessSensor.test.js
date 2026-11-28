'use strict';

const { expect } = require('chai');
const { shutterBrightnessSensor, isInNightPosition } = require('../../build/lib/shutterBrightnessSensor.js');

const SHUTTER_ID = 'shelly.0.shutter.position';

/**
 * Builds an adapter mock: brightness up is possible all day (up time 00:00, down time 23:59), autoUp is on.
 *
 * @param {number} position current position of the shutter
 * @returns {object} adapter mock, the driven values are collected in `writes`
 */
function adapterMock(position) {
    const writes = [];

    return {
        writes,
        config: {
            shutterStateRound: 1,
            driveDelayUpAstro: 0,
            lightsensorDown: 400,
            lightsensorUp: 500,
            lightsensorUpTime: '00:00',
            lightsensorDownTime: '23:59',
            alarmWind1: '',
            alarmWind2: '',
            alarmRain: '',
            alarmFrost: '',
            alarmFire: '',
        },
        log: { info: () => { }, debug: () => { }, warn: () => { }, error: () => { } },
        async getStateAsync(id) {
            if (id.startsWith('shutters.autoUp.')) {
                return { val: true, ack: true };
            }
            return null;
        },
        async getForeignStateAsync(id) {
            if (id === SHUTTER_ID) {
                return { val: writes.length ? writes[writes.length - 1] : position, ack: true };
            }
            return null;
        },
        async setForeignStateAsync(id, val) {
            writes.push(val);
        },
        async setStateAsync() { },
        delay: () => Promise.resolve(),
        setTimeout: () => undefined,
        clearTimeout: () => { },
    };
}

/**
 * @param {object} [overrides] properties to overwrite
 * @returns {object[]} one shutter of type lightsensor, without window sensor
 */
function shutters(overrides) {
    return [Object.assign({
        enabled: true,
        shutterName: 'S1',
        name: SHUTTER_ID,
        typeUp: 'lightsensor',
        typeDown: 'lightsensor',
        triggerID: '',
        triggerState: 'none',
        triggerStateTilted: 'none',
        autoDrive: 'off',
        heightUp: '100',
        heightDown: '0',
        heightDownSun: '30',
        currentHeight: 0,
        currentAction: 'down',
        triggerAction: 'down',
        lastAutoAction: 'Down_Brightness',
    }, overrides)];
}

describe('brightness sensor: up only from the night position (#794)', () => {
    it('opens a shutter that was closed for the night', async () => {
        const adapter = adapterMock(0);
        const settings = shutters();

        await shutterBrightnessSensor(adapter, 1000, settings, false);

        expect(adapter.writes).to.deep.equal([100]);
        expect(settings[0].currentAction).to.equal('up');
        expect(settings[0].lastAutoAction).to.equal('up_Brightness');
    });

    it('opens a closed shutter with pending sun protection to the sun protection height', async () => {
        const adapter = adapterMock(0);
        const settings = shutters({ currentAction: 'OpenInSunProtect' });

        await shutterBrightnessSensor(adapter, 1000, settings, false);

        expect(adapter.writes).to.deep.equal([30]);
        expect(settings[0].currentAction).to.equal('sunProtect');
    });

    it('does not move a shutter in heat protection (sun protection closed it completely)', async () => {
        const adapter = adapterMock(0);
        const settings = shutters({ currentAction: 'sunProtect', lastAutoAction: 'down_Sunprotect', currentHeight: 0 });

        await shutterBrightnessSensor(adapter, 1000, settings, false);

        expect(adapter.writes).to.deep.equal([]);
        expect(settings[0].currentAction).to.equal('sunProtect');
    });

    it('does not overwrite a manual position during the day', async () => {
        const adapter = adapterMock(50);
        const settings = shutters({ currentAction: 'Manu_Mode', lastAutoAction: 'up_Sunprotect_end', currentHeight: 100 });

        await shutterBrightnessSensor(adapter, 1000, settings, false);

        expect(adapter.writes).to.deep.equal([]);
        expect(settings[0].currentAction).to.equal('Manu_Mode');
    });

    it('opens in the morning also after a manual change during the night', async () => {
        const adapter = adapterMock(20);
        const settings = shutters({ currentAction: 'Manu_Mode', lastAutoAction: 'Down_Brightness' });

        await shutterBrightnessSensor(adapter, 1000, settings, false);

        expect(adapter.writes).to.deep.equal([100]);
    });
});

describe('isInNightPosition', () => {
    it('uses the action before the window was opened while the shutter is triggered', () => {
        expect(isInNightPosition({ currentAction: 'triggered', triggerAction: 'down', lastAutoAction: 'up_Brightness' })).to.equal(true);
        expect(isInNightPosition({ currentAction: 'triggered', triggerAction: 'sunProtect', lastAutoAction: 'down_Sunprotect' })).to.equal(false);
    });

    it('is false for an open shutter', () => {
        expect(isInNightPosition({ currentAction: 'up', triggerAction: 'up', lastAutoAction: 'up_Brightness' })).to.equal(false);
    });
});
