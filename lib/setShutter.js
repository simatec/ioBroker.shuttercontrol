'use strict';

const shutterState = require('./shutterState.js');  // shutterState

/**
 * @param {any} adapter
 * @param {any} currentShutterSettings
 * @param {number} shutterHeight
 * @param {string} nameDevice
 * @param {string} logInfo
 * @param {any} shutterSettings
 */
async function setShutterState(adapter, shutterSettings, currentShutterSettings, shutterHeight, nameDevice, logInfo) {
    return new Promise(async (resolve) => {
        adapter.log.info(`${logInfo} Set ID: ${currentShutterSettings.shutterName} value: ${shutterHeight}%`);

        try {
            await adapter.setForeignStateAsync(currentShutterSettings.name, shutterHeight, false);
        } catch (err) {
            adapter.log.warn(`The value for ${currentShutterSettings.shutterName} could not be set: ${err}`);
        }

        await setShutterInfo(adapter, shutterSettings, currentShutterSettings, nameDevice);

        // @ts-ignore
        resolve();
    });
}

/**
 * @param {{ setStateAsync: (arg0: string, arg1: { val: any; ack: boolean; }) => any; log: { warn: (arg0: string) => void; }; }} adapter
 * @param {any} shutterSettings
 * @param {{ currentHeight: string; currentAction: any; name: any; }} currentShutterSettings
 * @param {string} nameDevice
 */
async function setShutterInfo(adapter, shutterSettings, currentShutterSettings, nameDevice) {
    return new Promise(async (resolve) => {
        try {
            await adapter.setStateAsync('shutters.autoLevel.' + nameDevice, { val: parseFloat(currentShutterSettings.currentHeight), ack: true });
            await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: currentShutterSettings.currentAction, ack: true });
        } catch (err) {
            adapter.log.warn(`autoState and/or Level for Shutter ${nameDevice} could not be set: ${err}`);
        }

        shutterState(currentShutterSettings.name, adapter, shutterSettings);

        // @ts-ignore
        resolve();
    });
}

module.exports = {
    setShutterState,
    setShutterInfo
};