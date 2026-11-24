import { shutterState } from './shutterState'; // shutterState
import type { ShutterSettings } from './types';

let checkShutterState = true;

/**
 * Sends the target level to the shutter and stores the auto level and auto state.
 *
 * @param adapter adapter instance
 * @param shutterSettings settings of all shutters
 * @param currentShutterSettings settings of the shutter to drive
 * @param shutterHeight target level
 * @param nameDevice name of the shutter used for the states
 * @param logInfo prefix of the log message
 */
export async function setShutterState(
    adapter: ioBroker.Adapter,
    shutterSettings: ShutterSettings[],
    currentShutterSettings: ShutterSettings,
    shutterHeight: number | string,
    nameDevice: string,
    logInfo: string,
): Promise<void> {
    // never send an invalid level (NaN, undefined, empty) to the shutter
    if (!Number.isFinite(parseFloat(String(shutterHeight)))) {
        adapter.log.warn(
            `${logInfo} ${currentShutterSettings.shutterName}: invalid target level "${shutterHeight}" - nothing sent`,
        );
        return;
    }

    adapter.log.info(`${logInfo} Set ID: ${currentShutterSettings.shutterName} value: ${shutterHeight}%`);

    try {
        await adapter.setForeignStateAsync(currentShutterSettings.name, shutterHeight, false);
    } catch (err) {
        adapter.log.warn(`The value for ${currentShutterSettings.shutterName} could not be set: ${err}`);
    }

    checkShutterState = false;
    await setShutterInfo(adapter, shutterSettings, currentShutterSettings, nameDevice);
}

/**
 * Stores the auto level and auto state of the shutter.
 *
 * @param adapter adapter instance
 * @param shutterSettings settings of all shutters
 * @param currentShutterSettings settings of the shutter
 * @param nameDevice name of the shutter used for the states
 */
export async function setShutterInfo(
    adapter: ioBroker.Adapter,
    shutterSettings: ShutterSettings[],
    currentShutterSettings: ShutterSettings,
    nameDevice: string,
): Promise<void> {
    try {
        await adapter.setStateAsync(`shutters.autoLevel.${nameDevice}`, {
            val: parseFloat(String(currentShutterSettings.currentHeight)),
            ack: true,
        });
        await adapter.setStateAsync(`shutters.autoState.${nameDevice}`, {
            val: currentShutterSettings.currentAction,
            ack: true,
        });
    } catch (err) {
        adapter.log.warn(`autoState and/or Level for Shutter ${nameDevice} could not be set: ${err}`);
    }
    if (checkShutterState) {
        await shutterState(currentShutterSettings.name, adapter, shutterSettings, false);
    }
}
