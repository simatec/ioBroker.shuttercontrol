'use strict';

/**
 * Waits for the given time with the timer of the adapter.
 *
 * Every call gets its own timer. The modules used to keep one timer per file and cleared
 * "the last one" at the end of a run - when two runs overlapped, the wait of the other
 * run was cleared and never finished. The timers of the adapter are also stopped by the
 * js-controller when the adapter shuts down, so nothing is left running after unload.
 *
 * @param {ioBroker.Adapter} adapter adapter instance
 * @param {number|string} ms time to wait in milliseconds; invalid or negative values wait 0 ms
 * @returns {Promise<void>} resolves after the time; stays pending while the adapter shuts down
 */
function sleep(adapter, ms) {
    const time = Number(ms);
    return adapter.delay(Number.isFinite(time) && time > 0 ? time : 0);
}

module.exports = sleep;
