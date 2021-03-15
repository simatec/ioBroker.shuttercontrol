'use strict';
/**
 * @param {any} shutterID
 */
function shutterState(shutterID, adapter, shutterSettings) {
    if (adapter.config.currentShutterState == true) {
        const resultID = shutterSettings;
        // Filter changed Name
        const /**
             * @param {{ name: any; }} d
             */
            result = resultID.filter(d => d.name == shutterID);
        setTimeout(function () {
            for (const i in result) {
                /**
                 * @param {any} err
                 * @param {{ val: any; }} state
                 */
                adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                    let nameDevice = shutterSettings[i].shutterName.replace(/[.;, ]/g, '_');
                    if (typeof state != undefined && state != null && shutterSettings[i].currentHeight != state.val) {
                        shutterSettings[i].currentHeight = state.val;
                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                        adapter.log.debug('save current height after State Check: ' + shutterSettings[i].currentHeight + '%' + ' from ' + shutterSettings[i].shutterName);
                        if (shutterSettings[i].triggerAction == 'Manu_Mode') {
                            shutterSettings[i].triggerHeight = shutterSettings[i].currentHeight;
                            adapter.log.debug('Shutter ' + shutterSettings[i].shutterName + ' was moved manually to: ' + shutterSettings[i].currentHeight + '% while window was open - prevent trigger from driving back ');
                        }
                        return (shutterSettings);
                    }
                });
            }
        }, 60000);
    }
}
module.exports = shutterState;