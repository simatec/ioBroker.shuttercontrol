'use strict';

const { expect } = require('chai');
const { buttonAction } = require('../../build/lib/buttonAction.js');

/**
 * Builds an adapter mock, every shutter is open (100 %).
 *
 * @returns {object} adapter mock, the driven shutters are collected in `writes`
 */
function adapterMock() {
    const writes = [];
    const levels = {};

    return {
        writes,
        config: {
            shutterStateRound: 1,
            driveDelayUpLiving: 0,
            alarmFrost: '',
        },
        log: { info: () => { }, debug: () => { }, warn: () => { }, error: () => { } },
        async getForeignStateAsync(id) {
            return { val: id in levels ? levels[id] : 100, ack: true };
        },
        async setForeignStateAsync(id, val) {
            writes.push(id);
            levels[id] = val;
        },
        async setStateAsync() { },
        delay(ms) {
            return new Promise((resolve) => global.setTimeout(resolve, ms));
        },
        setTimeout(cb, ms) {
            return global.setTimeout(cb, ms);
        },
        clearTimeout(timer) {
            global.clearTimeout(timer);
        },
    };
}

/**
 * Builds a shutter with the given up and down area.
 *
 * @param {string} name shutter name (also used as state id)
 * @param {string} typeUp area for opening
 * @param {string} typeDown area for closing
 * @returns {object} shutter settings
 */
function shutter(name, typeUp, typeDown) {
    return {
        enabled: true,
        shutterName: name,
        name,
        typeUp,
        typeDown,
        triggerID: '',
        heightUp: '100',
        heightDown: '0',
        heightDownSun: '30',
        currentHeight: 100,
        currentAction: 'up',
        triggerAction: 'up',
    };
}

describe('buttonAction => close and sun protect buttons of an area', function () {
    this.timeout(10000);

    for (const area of ['Living', 'Sleep', 'Children']) {
        const type = area.toLowerCase();
        const other = type === 'sleep' ? 'living' : 'sleep';

        for (const button of [`close${area}`, `sunProtect${area}`]) {
            it(`${button} uses the down area: "${type}-auto" for closing yes, only for opening no`, async () => {
                const adapter = adapterMock();
                const settings = [
                    shutter('downAuto', other, `${type}-auto`),
                    shutter('upAutoOnly', `${type}-auto`, other),
                    shutter('down', other, type),
                ];

                await buttonAction(adapter, button, settings);

                expect(adapter.writes).to.have.members(['downAuto', 'down']);
            });
        }
    }
});
