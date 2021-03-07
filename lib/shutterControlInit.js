'use strict';


 function shutterControlInit(adapter) {
    // Full Result
    const resultFull = adapter.config.events;

    if (resultFull) {
        // Filter enabled
        let /**
             * @param {{ enabled: boolean; }} d
             */
            resEnabled = resultFull.filter(d => d.enabled === true);

        const result = resEnabled;

        setTimeout(function () {
            for (const i in result) {
                
                if (parseFloat(result[i].heightDown) < parseFloat(result[i].heightUp)) {
                    adapter.log.debug(result[i].shutterName + ' level conversion is disabled ...');
                } else if (parseFloat(result[i].heightDown) > parseFloat(result[i].heightUp)) {
                    adapter.log.debug(result[i].shutterName + ' level conversion is enabled');
                }
                
                /**
                 * @param {any} err
                 * @param {{ val: any; }} state
                 */
                adapter.getForeignState(result[i].name, (err, state) => {
                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');
                    if (typeof state != undefined && state != null) {
                        let currentHeight = parseFloat(state.val);
                        /**
                         * @param {any} err
                         * @param {{ val: any; }} state
                        */
                        adapter.getState('shutters.autoLevel.'+ nameDevice, (err, state) => {
                            if (typeof state != undefined && state != null) {
                                let autoLevel = state.val;
                                /**
                                 * @param {any} err
                                 * @param {{ val: any; }} state
                                */
                                adapter.getState('shutters.autoState.'+ nameDevice, (err, state) => {
                                    if (typeof state != undefined && state != null) {
                                        let autoState = state.val;
                                        /**
                                         * @param {any} err
                                         * @param {{ val: any; }} state
                                        */
                                        adapter.getState('shutters.autoState.'+ nameDevice, (err, state) => {
                                            if (typeof state != undefined && state != null) {
                                                let autoState = state.val;
                                                adapter.log.debug('Init - Trying to map old shutter state for: ' + result[i].shutterName);

                                                if(currentHeight == result[i].heightUp && autoState == 'up') {
                                                    result[i].currentHeight = currentHeight;
                                                    result[i].oldHeight = currentHeight;
                                                    result[i].firstCompleteUp == false;
                                                    adapter.log.debug('Init current Height: ' + result[i].currentHeight + '%' + ' for ' + result[i].shutterName);
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                    adapter.log.debug('Update current autoLevel: ' + result[i].currentHeight + '%' + ' for ' + result[i].shutterName);
                                                    result[i].currentAction = 'up'
                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                    adapter.log.debug('Init trigger action: ' + result[i].currentAction + ' for device: ' + result[i].shutterName);
                                                    result[i].triggerAction = result[i].currentAction;
                                                    result[i].triggerHeight = result[i].currentHeight;
                                                }
                                                else if(currentHeight == result[i].heightDown && autoState == 'down') {
                                                    result[i].currentHeight = currentHeight;
                                                    result[i].oldHeight = currentHeight;
                                                    result[i].firstCompleteUp == true;
                                                    adapter.log.debug('Init current Height: ' + result[i].currentHeight + '%' + ' for ' + result[i].shutterName);
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                    adapter.log.debug('Update current autoLevel: ' + result[i].currentHeight + '%' + ' for ' + result[i].shutterName);
                                                    result[i].currentAction = 'down'
                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                    adapter.log.debug('Init trigger action: ' + result[i].currentAction + ' for device: ' + result[i].shutterName);
                                                    result[i].triggerAction = result[i].currentAction;
                                                    result[i].triggerHeight = result[i].currentHeight;
                                                }
                                                else if(currentHeight == result[i].triggerDrive && autoState == 'triggered') {
                                                    result[i].currentHeight = currentHeight;
                                                    result[i].oldHeight = currentHeight;
                                                    result[i].firstCompleteUp == false;
                                                    adapter.log.debug('Init current Height: ' + result[i].currentHeight + '%' + ' for ' + result[i].shutterName);
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                    adapter.log.debug('Update current autoLevel: ' + result[i].currentHeight + '%' + ' for ' + result[i].shutterName);
                                                    result[i].currentAction = 'triggered'
                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                    result[i].triggerHeight = result[i].currentHeight;
                                                    adapter.log.debug('Init triggerHeight: ' + result[i].triggerHeight + ' for device: ' + result[i].shutterName);
                                                                                                        
                                                    if(result[i].triggerDrive == result[i].heightUp) {
                                                        result[i].triggerAction = 'up'; 
                                                        adapter.log.debug('Init trigger action: ' + result[i].currentAction + ' for device: ' + result[i].shutterName);

                                                    }
                                                    else {
                                                        result[i].triggerAction = 'none';
                                                        adapter.log.debug('Init trigger action: ' + result[i].currentAction + ' for device: ' + result[i].shutterName);
                                                    }
                                                    
                                                }
                                                else if(currentHeight == result[i].heightDownSun && (autoState == 'sunProtect' || autoState == 'manu_sunProtect')) {
                                                    result[i].currentHeight = currentHeight;
                                                    result[i].oldHeight = currentHeight;
                                                    result[i].firstCompleteUp = false;
                                                    adapter.log.debug('Init current Height: ' + result[i].currentHeight + '%' + ' for ' + result[i].shutterName);
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                    adapter.log.debug('Update current autoLevel: ' + result[i].currentHeight + '%' + ' for ' + result[i].shutterName);
                                                    result[i].currentAction = autoState;
                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                    adapter.log.debug('Init trigger action: ' + result[i].currentAction + ' for device: ' + result[i].shutterName);
                                                    result[i].triggerAction = result[i].currentAction;
                                                    result[i].triggerHeight = result[i].currentHeight;
                                                }
                                                else if(autoState == 'Manu_Mode') {
                                                    result[i].currentHeight = currentHeight;
                                                    result[i].oldHeight = currentHeight;
                                                    result[i].firstCompleteUp == false;
                                                    adapter.log.debug('Init current Height: ' + result[i].currentHeight + '%' + ' for ' + result[i].shutterName);
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                    adapter.log.debug('Update current autoLevel: ' + result[i].currentHeight + '%' + ' for ' + result[i].shutterName);
                                                    result[i].currentAction = 'Manu_Mode'
                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                    adapter.log.debug('Init trigger action: ' + result[i].currentAction + ' for device: ' + result[i].shutterName);
                                                    result[i].triggerAction = result[i].currentAction;
                                                    result[i].triggerHeight = result[i].currentHeight;
                                                }
                                                else {
                                                    adapter.log.debug('Previous state not clear - init to status "none" for device: ' + result[i].shutterName);
                                                    result[i].currentHeight = currentHeight;
                                                    result[i].oldHeight = currentHeight;
                                                    result[i].firstCompleteUp == true;
                                                    adapter.log.debug('Init current Height: ' + result[i].currentHeight + '%' + ' for ' + result[i].shutterName);
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                    adapter.log.debug('Update current autoLevel: ' + result[i].currentHeight + '%' + ' for ' + result[i].shutterName);
                                                    result[i].currentAction = 'none'
                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                    adapter.log.debug('Init trigger action: ' + result[i].currentAction + ' for device: ' + result[i].shutterName);
                                                    result[i].triggerAction = result[i].currentAction;
                                                    result[i].triggerHeight = result[i].currentHeight;
                                                }
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        }, 60000);
    }
}
module.exports = shutterControlInit;