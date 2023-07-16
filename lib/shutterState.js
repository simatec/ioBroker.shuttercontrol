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

        if (adapter.config.currentShutterState == true && checkTimeDelay == true) {
            checkTime = adapter.config.currentShutterStateTime ? (adapter.config.currentShutterStateTime * 1000) : 60000;
        }

        if (shutterSettings) {
            const result = shutterSettings.filter((/** @type {{ name: any; }} */ d) => d.name == shutterID);

            await sleep(checkTime);
            for (const i in result) {
                for (const s in shutterSettings) {
                    if (shutterSettings[s].shutterName == result[i].shutterName) {
                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                        let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                        if (typeof _shutterState != undefined && _shutterState != null && shutterSettings[s].currentHeight != Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound) {
                            shutterSettings[s].currentHeight = Math.round(_shutterState.val / adapter.config.shutterStateRound) * adapter.config.shutterStateRound;

                            await adapter.setStateAsync('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true })
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
            //return (shutterSettings);
        } else {
            resolve(shutterSettings);
        }
    });
}
module.exports = shutterState;