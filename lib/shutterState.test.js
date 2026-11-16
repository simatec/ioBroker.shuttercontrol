'use strict';

const { expect } = require('chai');
const { applyStartHeight } = require('./shutterState.js');

describe('shutterState => applyStartHeight', () => {
    it('fills all heights of a shutter without saved values', () => {
        const shutter = { shutterName: 'new shutter' };

        const filled = applyStartHeight(shutter, 70, 1);

        expect(filled).to.deep.equal(['currentHeight', 'oldHeight', 'triggerHeight']);
        expect(shutter).to.include({ currentHeight: 70, oldHeight: 70, triggerHeight: 70 });
    });

    it('keeps values restored from shutters.currentStates', () => {
        const shutter = { currentHeight: 30, oldHeight: 30, triggerHeight: 0 };

        const filled = applyStartHeight(shutter, 70, 1);

        expect(filled).to.deep.equal([]);
        expect(shutter).to.include({ currentHeight: 30, oldHeight: 30, triggerHeight: 0 });
    });

    it('fills only the missing values, 0 counts as a value', () => {
        const shutter = { currentHeight: 0, oldHeight: null, triggerHeight: '' };

        const filled = applyStartHeight(shutter, 55, 1);

        expect(filled).to.deep.equal(['oldHeight', 'triggerHeight']);
        expect(shutter).to.include({ currentHeight: 0, oldHeight: 55, triggerHeight: 55 });
    });

    it('rounds like the shutter state handler (shutterStateRound)', () => {
        const shutter = {};

        applyStartHeight(shutter, '47.6', 5);

        expect(shutter.currentHeight).to.equal(50);
    });

    it('uses a step of 1 when the rounding step is missing or invalid', () => {
        const a = {};
        const b = {};

        applyStartHeight(a, 47.6, undefined);
        applyStartHeight(b, 47.6, 0);

        expect(a.currentHeight).to.equal(48);
        expect(b.currentHeight).to.equal(48);
    });

    it('does nothing with an invalid value', () => {
        const shutter = {};

        expect(applyStartHeight(shutter, null, 1)).to.deep.equal([]);
        expect(applyStartHeight(shutter, 'abc', 1)).to.deep.equal([]);
        expect(shutter).to.deep.equal({});
    });
});
