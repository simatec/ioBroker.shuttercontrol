'use strict';

const shutterState = require('./shutterState.js');  // shutterState

/**
 * @param {any} adapter
 * @param {any} shutterSettings
 * @param {number} shutterHeight
 * @param {string} nameDevice
 * @param {string} logInfo
 */
async function setShutterState(adapter, shutterSettings, shutterHeight, nameDevice, logInfo) {
    return new Promise(async (resolve) => {
        adapter.log.info(`${logInfo} Set ID: ${shutterSettings.shutterName} value: ${shutterHeight}%`);
        await adapter.setForeignStateAsync(shutterSettings.name, shutterHeight, false);

        await setShutterInfo(adapter, shutterSettings, nameDevice);

        // @ts-ignore
        resolve();
    });
}

/**
 * @param {{setStateAsync: (arg0: string, arg1: {val: any;ack: boolean;}) => any;}} adapter
 * @param {string} nameDevice
 * @param {{ currentHeight: string; currentAction: string; name: string; }} shutterSettings
 */
async function setShutterInfo(adapter, shutterSettings, nameDevice) {
    return new Promise(async (resolve) => {
        await adapter.setStateAsync('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings.currentHeight), ack: true });
        await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings.currentAction, ack: true });

        shutterState(shutterSettings.name, adapter, shutterSettings);

        // @ts-ignore
        resolve();
    });
}

module.exports = {
    setShutterState,
    setShutterInfo
};