'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
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

    describe('IsSummerTime with a fixed date', () => {
        let clock;
        afterEach(() => clock && clock.restore());

        /**
         * @param {string} date local date/time (yyyy-mm-ddThh:mm:ss)
         * @param {string} start period start
         * @param {string} end period end
         */
        async function check(date, start, end) {
            clock = sinon.useFakeTimers({ now: new Date(date), toFake: ['Date'] });
            const ret = await IsSummerTime(adapterMock(), start, end);
            clock.restore();
            clock = null;
            return ret;
        }

        it('period over the turn of the year: start and end day are included', async () => {
            const cases = {
                '2026-11-30T23:59:59': false,
                '2026-12-01T00:00:05': true,
                '2026-12-24T12:00:00': true,
                '2026-12-31T23:59:59': true,
                '2027-01-01T00:00:05': true,
                '2027-01-06T00:00:05': true,
                '2027-01-06T23:59:59': true,
                '2027-01-07T00:00:05': false,
                '2027-07-15T12:00:00': false,
            };
            for (const [date, expected] of Object.entries(cases)) {
                expect(await check(date, '01.12.', '06.01.'), date).to.equal(expected);
            }
        });

        it('end day 31 is not shifted in shorter months (24.12. - 31.12.)', async () => {
            for (const date of ['2027-02-01T00:00:05', '2027-04-15T12:00:00', '2027-06-30T00:00:05', '2027-11-30T23:59:59']) {
                expect(await check(date, '24.12.', '31.12.'), date).to.equal(false);
            }
            expect(await check('2027-12-31T00:00:05', '24.12.', '31.12.')).to.equal(true);
            expect(await check('2027-02-28T12:00:00', '15.10.', '31.10.')).to.equal(false);
            expect(await check('2027-10-31T12:00:00', '15.10.', '31.10.')).to.equal(true);
        });

        it('same start and end day, date without the trailing dot', async () => {
            expect(await check('2027-05-10T00:00:05', '10.05.', '10.05.')).to.equal(true);
            expect(await check('2027-05-11T00:00:05', '10.05.', '10.05.')).to.equal(false);
            expect(await check('2026-12-24T12:00:00', '01.12', '06.01')).to.equal(true);
        });

        it('invalid dates give false', async () => {
            for (const [start, end] of [['abc', '06.01.'], ['32.13.', '06.01.'], ['01.12.', ''], ['1', '2']]) {
                expect(await check('2026-12-24T12:00:00', start, end), `${start}-${end}`).to.equal(false);
            }
        });
    });

    it('GetXmasLevel: useXmasLevel as string', async () => {
        const adapter = adapterMock({ ...inPeriod, controlXmas: true });
        expect(await GetXmasLevel(adapter, { ...shutter(), useXmasLevel: 'true' })).to.equal(20);
        expect(await GetXmasLevel(adapter, { ...shutter(), useXmasLevel: 'false' })).to.equal(-1);
    });
});
