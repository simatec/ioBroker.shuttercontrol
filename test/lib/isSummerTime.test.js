'use strict';

const { expect } = require('chai');
const { IsSummerTime, IsXmasActive, GetXmasLevel, toBool } = require('../../build/lib/isSummerTime.js');

const pad = n => `0${n}`.slice(-2);
const ddmm = d => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
const DAY = 24 * 3600 * 1000;

/**
 * Builds an adapter mock with the christmas period and the switch control.Xmas.
 *
 * @param {object} [options] XMasStart, XMasEnd, controlXmas (value of control.Xmas, undefined = no state)
 * @returns {object} adapter mock
 */
function adapterMock(options) {
    const opts = Object.assign({ XMasStart: '', XMasEnd: '' }, options);
    return {
        config: { XMasStart: opts.XMasStart, XMasEnd: opts.XMasEnd },
        log: { info: () => { }, debug: () => { }, warn: () => { }, error: () => { } },
        async getStateAsync(id) {
            if (id === 'control.Xmas' && opts.controlXmas !== undefined) {
                return { val: opts.controlXmas, ack: true };
            }
            return null;
        },
    };
}

const now = new Date();
const inPeriod = { XMasStart: ddmm(new Date(now.getTime() - DAY)), XMasEnd: ddmm(new Date(now.getTime() + DAY)) };
const outOfPeriod = {
    XMasStart: ddmm(new Date(now.getTime() + 10 * DAY)),
    XMasEnd: ddmm(new Date(now.getTime() + 20 * DAY)),
};
const shutter = (useXmasLevel = true) => ({ shutterName: 'test', useXmasLevel, XmasLevel: '20' });

describe('isSummerTime: christmas mode', () => {
    it('toBool', () => {
        expect([true, 'true', 1, '1'].map(toBool)).to.deep.equal([true, true, true, true]);
        expect([false, 'false', 0, '0', null, undefined, ''].map(toBool)).to.deep.equal([
            false, false, false, false, false, false, false,
        ]);
    });

    it('IsSummerTime: period around today / in the future / empty', async () => {
        expect(await IsSummerTime(adapterMock(), inPeriod.XMasStart, inPeriod.XMasEnd)).to.equal(true);
        expect(await IsSummerTime(adapterMock(), outOfPeriod.XMasStart, outOfPeriod.XMasEnd)).to.equal(false);
        expect(await IsSummerTime(adapterMock(), '', '')).to.equal(false);
    });

    it('IsXmasActive: uses the configured period when control.Xmas has no value', async () => {
        expect(await IsXmasActive(adapterMock(inPeriod))).to.equal(true);
        expect(await IsXmasActive(adapterMock(outOfPeriod))).to.equal(false);
        expect(await IsXmasActive(adapterMock({ ...inPeriod, controlXmas: null }))).to.equal(true);
    });

    it('IsXmasActive: the switch control.Xmas overrides the period', async () => {
        expect(await IsXmasActive(adapterMock({ ...inPeriod, controlXmas: false }))).to.equal(false);
        expect(await IsXmasActive(adapterMock({ ...outOfPeriod, controlXmas: true }))).to.equal(true);
    });

    it('IsXmasActive: falls back to the period when the state cannot be read', async () => {
        const adapter = adapterMock(inPeriod);
        adapter.getStateAsync = async () => {
            throw new Error('no connection');
        };
        expect(await IsXmasActive(adapter)).to.equal(true);
    });

    it('GetXmasLevel: level only with useXmasLevel and active christmas mode', async () => {
        expect(await GetXmasLevel(adapterMock({ ...outOfPeriod, controlXmas: true }), shutter())).to.equal(20);
        expect(await GetXmasLevel(adapterMock({ ...inPeriod, controlXmas: false }), shutter())).to.equal(-1);
        expect(await GetXmasLevel(adapterMock({ ...inPeriod, controlXmas: true }), shutter(false))).to.equal(-1);
    });
});
