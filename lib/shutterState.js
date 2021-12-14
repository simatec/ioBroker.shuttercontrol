'use strict';

let timerSleep = 0;

async function sleep(ms) {
    return new Promise(async (resolve) => {
        // @ts-ignore
        timerSleep = setTimeout(async () => resolve(), ms);
    });
}

async function shutterState(shutterID, adapter, shutterSettings) {
    let checkTime = 1000;
    const resultID = shutterSettings;

    if (adapter.config.currentShutterState == true) {
        checkTime = adapter.config.currentShutterStateTime ? (adapter.config.currentShutterStateTime * 1000) : 60000;
    }

    const result = resultID.filter((/** @type {{ name: any; }} */ d) => d.name == shutterID);

    await sleep(checkTime);
    for (const i in result) {
        for (const s in shutterSettings) {
            if (shutterSettings[s].shutterName == result[i].shutterName) {
                const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name);

                let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                if (typeof _shutterState != undefined && _shutterState != null && shutterSettings[s].currentHeight != _shutterState.val) {
                    shutterSettings[s].currentHeight = _shutterState.val;

                    await adapter.setStateAsync('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                    adapter.log.debug(`save current height after State Check: ${shutterSettings[s].currentHeight}% from ${shutterSettings[s].shutterName}`);

                    if (shutterSettings[s].triggerAction == 'Manu_Mode') {
                        shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                        adapter.log.debug(`Shutter ${shutterSettings[s].shutterName} was moved manually to: ${shutterSettings[s].currentHeight}% while window was open - prevent trigger from driving back`);
                    }
                }
            }
        }
    }
    return (shutterSettings);
}
module.exports = shutterState;