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
        await adapter.setForeignStateAsync(currentShutterSettings.name, shutterHeight, false);

        await setShutterInfo(adapter, shutterSettings, currentShutterSettings, nameDevice);

        // @ts-ignore
        resolve();
    });
}

/**
 * @param {{setStateAsync: (arg0: string, arg1: {val: any;ack: boolean;}) => any;}} adapter
 * @param {string} nameDevice
 * @param {{currentHeight: string;currentAction: string;name: string;}} currentShutterSettings
 * @param {any} shutterSettings
 */
async function setShutterInfo(adapter, shutterSettings, currentShutterSettings, nameDevice) {
    return new Promise(async (resolve) => {
        await adapter.setStateAsync('shutters.autoLevel.' + nameDevice, { val: parseFloat(currentShutterSettings.currentHeight), ack: true });
        await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: currentShutterSettings.currentAction, ack: true });

        shutterState(currentShutterSettings.name, adapter, shutterSettings);

        // @ts-ignore
        resolve();
    });
}

module.exports = {
    setShutterState,
    setShutterInfo
};