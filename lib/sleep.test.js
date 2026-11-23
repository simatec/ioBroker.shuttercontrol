'use strict';

const { expect } = require('chai');
const sleep = require('./sleep.js');
const shutterState = require('./shutterState.js');

/**
 * Builds an adapter mock whose delay() works like the one of the js-controller:
 * own timer per call, nothing resolves any more after unload.
 *
 * @param {object} [levels] current level per shutter state id
 * @returns {object} adapter mock
 */
function adapterMock(levels) {
    const delays = new Set();
    let stopping = false;
    const adapter = {
        delays,
        calls: [],
        config: { shutterStateRound: 1, currentShutterState: false, currentShutterStateTime: 0 },
        log: { info: () => { }, debug: () => { }, warn: () => { }, error: () => { } },
        delay(ms) {
            adapter.calls.push(ms);
            return new Promise((resolve) => {
                const timer = setTimeout(() => {
                    delays.delete(timer);
                    if (!stopping) {
                        resolve();
                    }
                }, ms);
                delays.add(timer);
            });
        },
        unload() {
            stopping = true;
            for (const timer of delays) {
                clearTimeout(timer);
            }
            delays.clear();
        },
        async getForeignStateAsync(id) {
            return { val: levels ? levels[id] : 0, ack: true };
        },
        async setStateAsync() { },
    };
    return adapter;
}

describe('sleep', () => {
    it('waits with the adapter timer', async () => {
        const adapter = adapterMock();
        const start = Date.now();
        await sleep(adapter, 50);
        expect(adapter.calls).to.deep.equal([50]);
        expect(Date.now() - start).to.be.at.least(40);
    });

    it('waits 0 ms for invalid or negative values instead of throwing', async () => {
        const adapter = adapterMock();
        await sleep(adapter, undefined);
        await sleep(adapter, 'abc');
        await sleep(adapter, -5);
        await sleep(adapter, '20');
        expect(adapter.calls).to.deep.equal([0, 0, 0, 20]);
    });

    it('lets overlapping waits finish independently', async () => {
        const adapter = adapterMock();
        const done = [];
        const first = sleep(adapter, 60).then(() => done.push('first'));
        await sleep(adapter, 20);
        done.push('second');
        await first;
        expect(done).to.deep.equal(['second', 'first']);
    });

    it('leaves the wait pending after unload', async () => {
        const adapter = adapterMock();
        let finished = false;
        sleep(adapter, 20).then(() => (finished = true));
        adapter.unload();
        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(finished).to.equal(false);
        expect(adapter.delays.size).to.equal(0);
    });
});

describe('shutterState with overlapping calls', () => {
    it('updates the height of both shutters when the checks overlap', async () => {
        const adapter = adapterMock({ 'dev.s1.level': 100, 'dev.s2.level': 40 });
        const settings = [
            { name: 'dev.s1.level', shutterName: 'S1', currentHeight: 0, triggerAction: '' },
            { name: 'dev.s2.level', shutterName: 'S2', currentHeight: 0, triggerAction: '' },
        ];
        // before: one shared timer per module - the second call cleared the wait of the first,
        // the first never returned and S1 kept the old height
        const first = shutterState('dev.s1.level', adapter, settings, false);
        await new Promise((resolve) => setTimeout(resolve, 300));
        const second = shutterState('dev.s2.level', adapter, settings, false);
        await Promise.all([first, second]);
        expect(settings[0].currentHeight).to.equal(100);
        expect(settings[1].currentHeight).to.equal(40);
    });
});
