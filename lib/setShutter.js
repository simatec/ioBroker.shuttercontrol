'use strict';

const shutterState = require('./shutterState.js');  // shutterState
let checkShutterState = true;

async function setShutterState(adapter, shutterSettings, currentShutterSettings, shutterHeight, nameDevice, logInfo) {
    return new Promise(async (resolve) => {
        adapter.log.info(`${logInfo} Set ID: ${currentShutterSettings.shutterName} value: ${shutterHeight}%`);

        try {
            await adapter.setForeignStateAsync(currentShutterSettings.name, shutterHeight, false);
        } catch (err) {
            adapter.log.warn(`The value for ${currentShutterSettings.shutterName} could not be set: ${err}`);
        }

        checkShutterState = false;
        await setShutterInfo(adapter, shutterSettings, currentShutterSettings, nameDevice);

        // @ts-ignore
        resolve();
    });
}

/**
 * @param adapter
 * @param shutterSettings
 * @param currentShutterSettings
 * @param nameDevice
 */
async function setShutterInfo(adapter, shutterSettings, currentShutterSettings, nameDevice) {
    return new Promise(async (resolve) => {
        try {
            await adapter.setStateAsync(`shutters.autoLevel.${  nameDevice}`, { val: parseFloat(currentShutterSettings.currentHeight), ack: true });
            await adapter.setStateAsync(`shutters.autoState.${  nameDevice}`, { val: currentShutterSettings.currentAction, ack: true });
        } catch (err) {
            adapter.log.warn(`autoState and/or Level for Shutter ${nameDevice} could not be set: ${err}`);
        }
        if (checkShutterState) {
            await shutterState(currentShutterSettings.name, adapter, shutterSettings, false);
        }

        // @ts-ignore
        resolve();
    });
}

module.exports = {
    setShutterState,
    setShutterInfo
};