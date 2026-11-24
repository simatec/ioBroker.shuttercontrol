import type { ShutterSettings } from './types';

/**
 * Reads the current level of the given shutter (and every row with the same shutter name) after a
 * waiting time and stores it as current height when it differs.
 *
 * @param shutterID object ID of the level state of the shutter
 * @param adapter adapter instance
 * @param shutterSettings settings of all shutters
 * @param checkTimeDelay use the configured check time instead of 1s
 * @returns the (updated) shutter settings
 */
export async function shutterState(
    shutterID: string,
    adapter: ioBroker.Adapter,
    shutterSettings: ShutterSettings[],
    checkTimeDelay: boolean,
): Promise<ShutterSettings[]> {
    let checkTime = 1000;

    if (adapter.config.currentShutterState == true && checkTimeDelay == true) {
        checkTime = adapter.config.currentShutterStateTime ? adapter.config.currentShutterStateTime * 1000 : 60000;
    }

    if (shutterSettings) {
        const result = shutterSettings.filter(d => d.name == shutterID);

        await adapter.delay(checkTime);
        for (const i of result) {
            for (let s = 0; s < shutterSettings.length; s++) {
                if (shutterSettings[s].shutterName == i.shutterName) {
                    const _shutterState = await adapter
                        .getForeignStateAsync(shutterSettings[s].name)
                        .catch(e => adapter.log.warn(e));
                    const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                    if (
                        _shutterState?.val !== null &&
                        _shutterState?.val !== undefined &&
                        shutterSettings[s].currentHeight !=
                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) *
                                adapter.config.shutterStateRound
                    ) {
                        shutterSettings[s].currentHeight =
                            Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) *
                            adapter.config.shutterStateRound;

                        await adapter
                            .setStateAsync(`shutters.autoLevel.${nameDevice}`, {
                                val: parseFloat(String(shutterSettings[s].currentHeight)),
                                ack: true,
                            })
                            .catch(e => adapter.log.warn(e));

                        adapter.log.debug(
                            `save current height after State Check: ${shutterSettings[s].currentHeight}% from ${shutterSettings[s].shutterName}`,
                        );

                        if (shutterSettings[s].triggerAction == 'Manu_Mode') {
                            shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                            shutterSettings[s].alarmTriggerAction = 'Manu_Mode';
                            shutterSettings[s].alarmTriggerLevel =
                                Math.round((_shutterState.val as number) / adapter.config.shutterStateRound) *
                                adapter.config.shutterStateRound;
                            adapter.log.debug(
                                `Shutter ${shutterSettings[s].shutterName} was moved manually to: ${shutterSettings[s].currentHeight}% - prevent trigger from driving back`,
                            );
                        }
                    }
                }
            }
        }
        return shutterSettings;
    }
    return shutterSettings;
}
