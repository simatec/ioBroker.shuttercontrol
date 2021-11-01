'use strict';
/**
 * @param {any} shutterID
 */
// @ts-ignore
function shutterState(shutterID, adapter, shutterSettings) {

    const checkTime = 1000;
    const resultID = shutterSettings;

    if (adapter.config.currentShutterState == true) {
        checkTime = adapter.config.currentShutterStateTime ? (adapter.config.currentShutterStateTime * 1000) : 60000;
    }

        // Filter changed Name
        const /**
             * @param {{ name: any; }} d
             */
            result = resultID.filter(d => d.name == shutterID);
        setTimeout(function () {
            for (const i in result) {
                for (const s in shutterSettings) {
                    if (shutterSettings[s].shutterName == result[i].shutterName) {
                        /**
                         * @param {any} err
                         * @param {{ val: any; }} state
                         */
                        // @ts-ignore
                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                            let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                            if (typeof state != undefined && state != null && shutterSettings[s].currentHeight != state.val) {
                                shutterSettings[s].currentHeight = state.val;
                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: parseFloat(shutterSettings[s].currentHeight), ack: true });
                                adapter.log.debug('save current height after State Check: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                if (shutterSettings[s].triggerAction == 'Manu_Mode') {
                                    shutterSettings[s].triggerHeight = shutterSettings[s].currentHeight;
                                    adapter.log.debug('Shutter ' + shutterSettings[s].shutterName + ' was moved manually to: ' + shutterSettings[s].currentHeight + '% while window was open - prevent trigger from driving back ');
                                }
                                return (shutterSettings);
                            }
                        });
                    }
                }
            }
        }, checkTime);
}
module.exports = shutterState;