'use strict';

let timerSleep = 0;

async function sleep(ms) {
    return new Promise(async (resolve) => {
        // @ts-ignore
        timerSleep = setTimeout(async () => resolve(), ms);
    });
}

async function shutterState(shutterID, adapter, shutterSettings, checkTimeDelay) {
    return new Promise(async (resolve) => {
        let checkTime = 1000;

        if (adapter.config.currentShutterState == true &&
            checkTimeDelay == true) {

            checkTime = adapter.config.currentShutterStateTime ? (adapter.config.currentShutterStateTime * 1000) : 60000;
        }

        if (shutterSettings) {
            const result = shutterSettings.filter((d) => d.name == shutterID);

            await sleep(checkTime);
            for (const i in result) {
                for (const s in shutterSettings) {
                    if (shutterSettings[s].shutterName == result[i].shutterName) {
                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));
                        const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                        if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                            shutterSettings[s].currentHeight != Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound) {

                            shutterSettings[s].currentHeight = Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound;

                            await adapter.setStateAsync(`shutters.autoLevel.${nameDevice}`, { val: parseFloat(shutterSettings[s].currentHeight), ack: true })
                                .catch((e) => adapter.log.warn(e));

                            adapter.log.debug(`save current height after State Check: ${shutterSettings[s].currentHeight}% from ${shutterSettings[s].shutterName}`);

                            if (shutterSettings[s].triggerAction == 'Manu_Mode') {
                                shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                shutterSettings[s].alarmTriggerAction = 'Manu_Mode';
                                shutterSettings[s].alarmTriggerLevel = Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound;
                                adapter.log.debug(`Shutter ${shutterSettings[s].shutterName} was moved manually to: ${shutterSettings[s].currentHeight}% - prevent trigger from driving back`);
                            }
                        }
                    }
                }
            }
            clearTimeout(timerSleep);
            resolve(shutterSettings);
        } else {
            resolve(shutterSettings);
        }
    });
}
/**
 * Fills the heights of a shutter that are still unknown after the start of the adapter
 * with the current position of the shutter.
 *
 * Values restored from `shutters.currentStates` are kept, so a running installation behaves
 * as before. Only shutters without saved values (new shutters, never driven by the adapter)
 * get the current position - otherwise sun protection and the window handling compare against
 * an empty value until the daily reset.
 *
 * @param {object} shutter settings of the shutter
 * @param {any} value current value of the shutter state
 * @param {number} [round] rounding step of the shutter state (shutterStateRound)
 * @returns {string[]} names of the filled properties (empty when nothing was filled)
 */
function applyStartHeight(shutter, value, round) {
    const filled = [];
    const height = parseFloat(value);
    if (!shutter || !Number.isFinite(height)) {
        return filled;
    }
    const step = Number(round) > 0 ? Number(round) : 1;
    const rounded = Math.round(height / step) * step;

    for (const key of ['currentHeight', 'oldHeight', 'triggerHeight']) {
        if (shutter[key] === undefined || shutter[key] === null || shutter[key] === '') {
            shutter[key] = rounded;
            filled.push(key);
        }
    }
    return filled;
}

module.exports = shutterState;
module.exports.applyStartHeight = applyStartHeight;
