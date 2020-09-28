'use strict';
/**
 * @param {any} shutterID
 */
function shutterState(shutterID, adapter) {
    if (adapter.config.currentShutterState == true) {
        const resultID = adapter.config.events;
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
                adapter.getForeignState(result[i].name, (err, state) => {
                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                    if (typeof state != undefined && state != null && result[i].currentHeight != state.val) {
                        result[i].currentHeight = state.val;
                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                        adapter.log.debug('save current height after State Check: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                        if (result[i].triggerAction == 'Manu_Mode') {
                            result[i].triggerHeight = result[i].currentHeight;
                            adapter.log.debug('Shutter ' + result[i].shutterName + ' was moved manually to: ' + result[i].currentHeight + '% while window was open - prevent trigger from driving back ');
                        }
                    }
                });
            }
        }, 60000);
    }
}
module.exports = shutterState;