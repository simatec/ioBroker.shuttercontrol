'use strict';

// ++++++++++++++++++++++++++ sunprotect  +++++++++++++++++++++++++++

const shutterState = require('./shutterState.js');         // shutterState

function sunProtect(adapter, elevation, azimuth) {

    const driveDelayUpSleep = adapter.config.driveDelayUpAstro * 1000;

    setTimeout(function () {
        // Full Result
        let resultFull = adapter.config.events;
        
        if (resultFull) {
            // Filter enabled
            let /**
                 * @param {{ enabled: boolean; }} d
                 */
                resEnabled = resultFull.filter(d => d.enabled === true);
            let result = resEnabled;

            if (elevation > adapter.config.sunProtEndElevation) {
                for (const i in result) {
                    let resultDirectionRangeMinus = 0;
                    let resultDirectionRangePlus = 0;

                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');

                    /** @type {boolean} */
                    let convertShutter;

                    if (parseFloat(result[i].heightDown) < parseFloat(result[i].heightUp)) {
                        convertShutter = false;
                        //adapter.log.debug(result[i].shutterName + ' level conversion is disabled ...');
                    } else if (parseFloat(result[i].heightDown) > parseFloat(result[i].heightUp)) {
                        convertShutter = true;
                        //adapter.log.debug(result[i].shutterName + ' level conversion is enabled');
                    }

                    /**
                     * @param {any} err
                     * @param {boolean} state
                     */
                    adapter.getState('shutters.autoSun.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {

                            switch (result[i].type) {

                                // +++++++++++++++++ sunprotect with in/outside temperature and Lightsensor +++++++++++++++

                                case 'in- & outside temperature': // in- & outside temperature
                                    setTimeout(function () {
                                        let currentValue = '';
                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue && result[i].tempSensor != '' || (currentValue != mustValue && result[i].autoDrive != 'off' && result[i].tempSensor != '') || (result[i].triggerID == '' && result[i].tempSensor != '')) {
                                                /** @type {number} */
                                                let insideTemp;
                                                /** @type {number} */
                                                let outsideTemp;
                                                /** @type {number} */
                                                let sunLight;
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(result[i].tempSensor, (err, state) => {
                                                    if (typeof state != undefined && state != null) {
                                                        insideTemp = parseFloat(state.val);

                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: string; }} state
                                                         */
                                                        adapter.getForeignState(result[i].outsideTempSensor, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                outsideTemp = parseFloat(state.val);
                                                            }

                                                            /**
                                                             * @param {any} err
                                                             * @param {{ val: string; }} state
                                                             */
                                                            adapter.getForeignState(result[i].lightSensor, (err, state) => {
                                                                if (typeof state != undefined && state != null) {
                                                                    sunLight = parseFloat(state.val);
                                                                }

                                                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp') || (result[i].triggerID == '')) {
                                                                    if (insideTemp > result[i].tempInside) {
                                                                        if (result[i].tempOutside < outsideTemp && (result[i].lightSensor != '' && result[i].valueLight < sunLight || result[i].lightSensor == '') && result[i].currentAction != 'sunProtect' && result[i].currentAction != 'OpenInSunProtect' && result[i].currentAction != 'Manu_Mode') {
                                                                            /**
                                                                             * @param {any} err
                                                                             * @param {{ val: string; }} state
                                                                             */
                                                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                                                if (typeof state != undefined && state != null) {
                                                                                    adapter.log.debug(result[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + result[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + result[i].currentHeight + ' AND currentHeight:' + result[i].currentHeight + ' == heightUp:' + result[i].heightUp);
                                                                                    //if (parseFloat(state.val) > parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                                    if (((parseFloat(state.val) > parseFloat(result[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(result[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                                        result[i].currentAction = 'sunProtect';
                                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                                        adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is active');
                                                                                        adapter.log.debug('Temperature inside: ' + insideTemp + ' > ' + result[i].tempInside + ' AND ( Temperatur outside: ' + outsideTemp + ' > ' + result[i].tempOutside + ' AND Light: ' + sunLight + ' > ' + result[i].valueLight + ' )');
                                                                                        adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%')
                                                                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightDownSun), false);
                                                                                        result[i].currentHeight = result[i].heightDownSun;
                                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                                                        adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDownSun + '%');
                                                                                        shutterState(result[i].name, adapter);
                                                                                    }
                                                                                    // Shutter closed. Set currentAction = sunProtect when sunProtect starts => 
                                                                                    // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                                    else if (parseFloat(state.val) == parseFloat(result[i].heightDown) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentAction != 'down' && result[i].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                                        result[i].currentAction = 'OpenInSunProtect';
                                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                                        adapter.log.debug('Set sunprotect mode for ' + result[i].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                                    }
                                                                                    //Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set -> 
                                                                                    // set sunProtect again
                                                                                    else if (parseFloat(state.val) == parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentHeight != result[i].heightDown && result[i].currentAction == '') {
                                                                                        adapter.log.debug(result[i].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + result[i].heightDownSun);
                                                                                        result[i].currentAction = 'sunProtect';
                                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                                    }
                                                                                }
                                                                            });
                                                                        }
                                                                    }
                                                                }
                                                                if (currentValue != mustValue && result[i].autoDrive == 'onlyUp' && result[i].driveAfterClose == true) {
																	if (insideTemp > result[i].tempInside) {
                                                                        if (result[i].tempOutside < outsideTemp && (result[i].lightSensor != '' && result[i].valueLight < sunLight || result[i].lightSensor == '') && result[i].triggerAction != 'sunProtect' && result[i].triggerAction != 'OpenInSunProtect' && result[i].triggerAction != 'Manu_Mode') {
                                                                            /**
                                                                             * @param {any} err
                                                                             * @param {{ val: string; }} state
                                                                             */
                                                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                                                if (typeof state != undefined && state != null) {
                                                                                    adapter.log.debug(result[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + result[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + result[i].currentHeight + ' AND currentHeight:' + result[i].currentHeight + ' == heightUp:' + result[i].heightUp + ' AND triggerAction:' + result[i].triggerAction + ' != down ');
                                                                                    if (((parseFloat(state.val) > parseFloat(result[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(result[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp && result[i].triggerAction != 'down') {
                                                                                        adapter.log.info(' Will sunprotect ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                                        result[i].triggerHeight = parseFloat(result[i].heightDownSun);
                                                                                        adapter.log.debug('save new trigger height: ' + result[i].heightDownSun + '%');
                                                                                        result[i].triggerAction = 'sunProtect';
                                                                                        adapter.log.debug('save new trigger action: ' + result[i].triggerAction);
                                                                                    }
                                                                                   
                                                                                }
                                                                            });
                                                                        }
                                                                    }
																}
                                                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown') || (result[i].triggerID == '')) {
                                                                    let hysteresisOutside = (((100 - result[i].hysteresisOutside) / 100) * result[i].tempOutside).toFixed(2);
                                                                    let hysteresisInside = (((100 - result[i].hysteresisInside) / 100) * result[i].tempInside).toFixed(2);
                                                                    let hysteresisLight = (((100 - result[i].hysteresisLight) / 100) * result[i].valueLight).toFixed(2);

                                                                    if (insideTemp < parseFloat(hysteresisInside) || (parseFloat(hysteresisOutside) > outsideTemp || result[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && result[i].lightSensor == '')) {

                                                                        /**
                                                                         * @param {any} err
                                                                         * @param {{ val: string; }} state
                                                                         */
                                                                        adapter.getForeignState(result[i].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                if (result[i].currentAction == 'sunProtect' && result[i].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                                    result[i].currentAction = 'up';
                                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                                    adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active');
                                                                                    adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                                    adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightUp + '%')
                                                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                                                                    result[i].currentHeight = result[i].heightUp;
                                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                                                    adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDownSun + '%')
                                                                                    shutterState(result[i].name, adapter);
                                                                                }
                                                                                else if (result[i].currentAction == 'OpenInSunProtect') {
                                                                                    result[i].currentAction = 'none';
                                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                                    adapter.log.debug('OpenInSunProtect for ' + result[i].shutterName + ' is not longer active');
                                                                                }
                                                                            }
                                                                        });
                                                                    }
                                                                }
                                                                if (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].driveAfterClose == true) {
																	let hysteresisOutside = (((100 - result[i].hysteresisOutside) / 100) * result[i].tempOutside).toFixed(2);
                                                                    let hysteresisInside = (((100 - result[i].hysteresisInside) / 100) * result[i].tempInside).toFixed(2);
                                                                    let hysteresisLight = (((100 - result[i].hysteresisLight) / 100) * result[i].valueLight).toFixed(2);

                                                                    if (insideTemp < parseFloat(hysteresisInside) || (parseFloat(hysteresisOutside) > outsideTemp || result[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && result[i].lightSensor == '')) {

																		/**
																		 * @param {any} err
																		 * @param {{ val: any; }} state
																		 */
																		adapter.getForeignState(result[i].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                if (result[i].triggerAction == 'sunProtect' && result[i].KeepSunProtect === false && (parseFloat(result[i].triggerHeight) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                                    adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active anymore');
                                                                                    adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                                    adapter.log.info(' Will end sunprotect ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                                    result[i].triggerHeight = parseFloat(result[i].heightUp);
                                                                                    adapter.log.debug('save new trigger height: ' + result[i].triggerHeight + '%');
                                                                                    result[i].triggerAction = 'up';
                                                                                    adapter.log.debug('save new trigger action: ' + result[i].triggerAction);
                                                                                }
                                                                                else if (result[i].currentAction == 'OpenInSunProtect') {
                                                                                    result[i].triggerAction = 'none';
                                                                                    adapter.log.debug('OpenInSunProtect for ' + result[i].shutterName + ' is not longer active');
                                                                                }
                                                                            }
																		});
																	}
																}
                                                            });
                                                        });

                                                    }
                                                });
                                            }
                                        });
                                    }, driveDelayUpSleep * i, i);
                                break;
                                //////////////////////////////////////////////////////////////////////////////////////////////////////

                                // +++++++++++++++++ sunprotect with in/outside temperature, Lightsensor and direction +++++++++++++++

                                case 'in- & outside temperature and direction': // in- & outside temperature and direction
                                    resultDirectionRangeMinus = parseInt(result[i].direction) - parseInt(result[i].directionRange);
                                    resultDirectionRangePlus = parseInt(result[i].direction) + parseInt(result[i].directionRange);
                                    setTimeout(function () {
                                        let currentValue = '';
                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue && result[i].tempSensor != '' || (currentValue != mustValue && result[i].autoDrive != 'off' && result[i].tempSensor != '') || (result[i].triggerID == '' && result[i].tempSensor != '')) {
                                                /** @type {number} */
                                                let insideTemp;
                                                /** @type {number} */
                                                let outsideTemp;
                                                /** @type {number} */
                                                let sunLight;
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(result[i].tempSensor, (err, state) => {
                                                    if (typeof state != undefined && state != null) {
                                                        insideTemp = parseFloat(state.val);

                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: string; }} state
                                                         */
                                                        adapter.getForeignState(result[i].outsideTempSensor, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                outsideTemp = parseFloat(state.val);
                                                            }

                                                            /**
                                                             * @param {any} err
                                                             * @param {{ val: string; }} state
                                                             */
                                                            adapter.getForeignState(result[i].lightSensor, (err, state) => {
                                                                if (typeof state != undefined && state != null) {
                                                                    sunLight = parseFloat(state.val);
                                                                }
                                                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp') || (result[i].triggerID == '')) {
                                                                    if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth && insideTemp > result[i].tempInside) {
                                                                        if (result[i].tempOutside < outsideTemp && (result[i].lightSensor != '' && result[i].valueLight < sunLight || result[i].lightSensor == '') && result[i].currentAction != 'sunProtect' && result[i].currentAction != 'OpenInSunProtect' && result[i].currentAction != 'Manu_Mode') {

                                                                            /**
                                                                             * @param {any} err
                                                                             * @param {{ val: string; }} state
                                                                             */
                                                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                                                if (typeof state != undefined && state != null) {
                                                                                    adapter.log.debug(result[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + result[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + result[i].currentHeight + ' AND currentHeight:' + result[i].currentHeight + ' == heightUp:' + result[i].heightUp);
                                                                                    //if (parseFloat(state.val) > parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                                    if (((parseFloat(state.val) > parseFloat(result[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(result[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                                        result[i].currentAction = 'sunProtect';
                                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                                        adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is active');
                                                                                        adapter.log.debug('Temperature inside: ' + insideTemp + ' > ' + result[i].tempInside + ' AND ( Temperatur outside: ' + outsideTemp + ' > ' + result[i].tempOutside + ' AND Light: ' + sunLight + ' > ' + result[i].valueLight + ' )');
                                                                                        adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDownSun + '%');
                                                                                        adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%');

                                                                                        adapter.setForeignState(result[i].name, parseFloat(result[i].heightDownSun), false);
                                                                                        result[i].currentHeight = result[i].heightDownSun;
                                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                                                        adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDownSun + '%')
                                                                                        shutterState(result[i].name, adapter);
                                                                                    }
                                                                                    // Shutter closed. Set currentAction = sunProtect when sunProtect starts => 
                                                                                    // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                                    else if (parseFloat(state.val) == parseFloat(result[i].heightDown) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentAction != 'down' && result[i].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                                        result[i].currentAction = 'OpenInSunProtect';
                                                                                        adapter.log.debug('Set sunprotect mode for ' + result[i].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                                    }
                                                                                    // Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set -> 
                                                                                    // set sunProtect again
                                                                                    else if (parseFloat(state.val) == parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentHeight != result[i].heightDown && result[i].currentAction == '') {
                                                                                        adapter.log.debug(result[i].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + result[i].heightDownSun);
                                                                                        result[i].currentAction = 'sunProtect';
                                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                                    }
                                                                                }
                                                                            });
                                                                        }
                                                                    }
                                                                }
                                                                if (currentValue != mustValue && result[i].autoDrive == 'onlyUp' && result[i].driveAfterClose == true) {
																	if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth && insideTemp > result[i].tempInside) {
                                                                        if (result[i].tempOutside < outsideTemp && (result[i].lightSensor != '' && result[i].valueLight < sunLight || result[i].lightSensor == '') && result[i].triggerAction != 'sunProtect' && result[i].triggerAction != 'OpenInSunProtect' && result[i].triggerAction != 'Manu_Mode') {
                                                                            /**
                                                                             * @param {any} err
                                                                             * @param {{ val: string; }} state
                                                                             */
                                                                            adapter.getForeignState(result[i].name, (err, state) => {
                                                                                if (typeof state != undefined && state != null) {
                                                                                    adapter.log.debug(result[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + result[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + result[i].currentHeight + ' AND currentHeight:' + result[i].currentHeight + ' == heightUp:' + result[i].heightUp + ' AND triggerAction:' + result[i].triggerAction + ' != down ');
                                                                                    if (((parseFloat(state.val) > parseFloat(result[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(result[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp && result[i].triggerAction != 'down') {
                                                                                        adapter.log.info(' Will sunprotect ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                                        result[i].triggerHeight = parseFloat(result[i].heightDownSun);
                                                                                        adapter.log.debug('save new trigger height: ' + result[i].heightDownSun + '%');
                                                                                        result[i].triggerAction = 'sunProtect';
                                                                                        adapter.log.debug('save new trigger action: ' + result[i].triggerAction);
                                                                                    }
                                                                                   
                                                                                }
                                                                            });
                                                                        }
                                                                    }
																}
                                                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown') || (result[i].triggerID == '')) {
                                                                    let hysteresisOutside = (((100 - result[i].hysteresisOutside) / 100) * result[i].tempOutside).toFixed(2);
                                                                    let hysteresisInside = (((100 - result[i].hysteresisInside) / 100) * result[i].tempInside).toFixed(2);
                                                                    let hysteresisLight = (((100 - result[i].hysteresisLight) / 100) * result[i].valueLight).toFixed(2);

                                                                    if (insideTemp < parseFloat(hysteresisInside) || (resultDirectionRangePlus) < azimuth || (parseFloat(hysteresisOutside) > outsideTemp || result[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && result[i].lightSensor == '')) {
                                                                        /**
                                                                         * @param {any} err
                                                                         * @param {{ val: string; }} state
                                                                         */
                                                                        adapter.getForeignState(result[i].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                if (result[i].currentAction == 'sunProtect' && result[i].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                                    result[i].currentAction = 'up';
                                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                                    adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active');
                                                                                    adapter.log.debug('Range: ' + resultDirectionRangePlus + ' < ' + azimuth + ' OR Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ')');
                                                                                    adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightUp + '%');
                                                                                    adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightUp + '%');

                                                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                                                                    result[i].currentHeight = result[i].heightUp;
                                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                                                    adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightUp + '%')
                                                                                    shutterState(result[i].name, adapter);
                                                                                }
                                                                                else if (result[i].currentAction == 'OpenInSunProtect') {
                                                                                    result[i].currentAction = 'none';
                                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                                    adapter.log.debug('OpenInSunProtect for ' + result[i].shutterName + ' is not longer active');
                                                                                }
                                                                            }
                                                                        });
                                                                    }
                                                                }
                                                                if (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].driveAfterClose == true) {
																	let hysteresisOutside = (((100 - result[i].hysteresisOutside) / 100) * result[i].tempOutside).toFixed(2);
                                                                    let hysteresisInside = (((100 - result[i].hysteresisInside) / 100) * result[i].tempInside).toFixed(2);
                                                                    let hysteresisLight = (((100 - result[i].hysteresisLight) / 100) * result[i].valueLight).toFixed(2);

                                                                    if (insideTemp < parseFloat(hysteresisInside) || (resultDirectionRangePlus) < azimuth || (parseFloat(hysteresisOutside) > outsideTemp || result[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && result[i].lightSensor == '')) {

																		/**
																		 * @param {any} err
																		 * @param {{ val: any; }} state
																		 */
																		adapter.getForeignState(result[i].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                if (result[i].triggerAction == 'sunProtect' && result[i].KeepSunProtect === false && (parseFloat(result[i].triggerHeight) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                                    adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active anymore');
                                                                                    adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                                    adapter.log.info(' Will end sunprotect ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                                    result[i].triggerHeight = parseFloat(result[i].heightUp);
                                                                                    adapter.log.debug('save new trigger height: ' + result[i].triggerHeight + '%');
                                                                                    result[i].triggerAction = 'up';
                                                                                    adapter.log.debug('save new trigger action: ' + result[i].triggerAction);
                                                                                }
                                                                                else if (result[i].currentAction == 'OpenInSunProtect') {
                                                                                    result[i].triggerAction = 'none';
                                                                                    adapter.log.debug('OpenInSunProtect for ' + result[i].shutterName + ' is not longer active');
                                                                                }
                                                                            }
																		});
																	}
																}
                                                            });
                                                        });
                                                    }
                                                });
                                            }
                                        });
                                    }, driveDelayUpSleep * i, i);
                                break;

                                //////////////////////////////////////////////////////////////////////////////////////////////////////

                                // +++++++++++++++++ sunprotect with outside temperature, Lightsensor and direction +++++++++++++++

                                case 'outside temperature and direction': //outside temperature and direction
                                    resultDirectionRangeMinus = parseInt(result[i].direction) - parseInt(result[i].directionRange);
                                    resultDirectionRangePlus = parseInt(result[i].direction) + parseInt(result[i].directionRange);

                                    setTimeout(function () {
                                        let currentValue = '';
                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'off') || (result[i].triggerID == '')) {
                                                /** @type {number} */
                                                let outsideTemp;
                                                /** @type {number} */
                                                let sunLight;

                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(result[i].outsideTempSensor, (err, state) => {
                                                    if (typeof state != undefined && state != null) {
                                                        outsideTemp = parseFloat(state.val);
                                                    }

                                                    /**
                                                     * @param {any} err
                                                     * @param {{ val: string; }} state
                                                     */
                                                    adapter.getForeignState(result[i].lightSensor, (err, state) => {
                                                        if (typeof state != undefined && state != null) {
                                                            sunLight = parseFloat(state.val);
                                                        }
                                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp') || (result[i].triggerID == '')) {
                                                            if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth) {
                                                                if (result[i].tempOutside < outsideTemp && (result[i].lightSensor != '' && result[i].valueLight < sunLight || result[i].lightSensor == '') && result[i].currentAction != 'sunProtect' && result[i].currentAction != 'OpenInSunProtect' && result[i].currentAction != 'Manu_Mode') {
                                                                    /**
                                                                     * @param {any} err
                                                                     * @param {{ val: string; }} state
                                                                     */
                                                                    adapter.getForeignState(result[i].name, (err, state) => {
                                                                        if (typeof state != undefined && state != null) {
                                                                            adapter.log.debug(result[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + result[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + result[i].currentHeight + ' AND currentHeight:' + result[i].currentHeight + ' == heightUp:' + result[i].heightUp);
                                                                            //if (parseFloat(state.val) > parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                            if (((parseFloat(state.val) > parseFloat(result[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(result[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                                result[i].currentAction = 'sunProtect';
                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                                adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is active');
                                                                                adapter.log.debug('Temperatur outside: ' + outsideTemp + ' > ' + result[i].tempOutside + ' AND Light: ' + sunLight + ' > ' + result[i].valueLight);
                                                                                adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%')

                                                                                adapter.setForeignState(result[i].name, parseFloat(result[i].heightDownSun), false);
                                                                                result[i].currentHeight = result[i].heightDownSun;
                                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                                                adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDownSun + '%')
                                                                                shutterState(result[i].name, adapter);
                                                                            }
                                                                            // Shutter closed. Set currentAction = sunProtect when sunProtect starts => 
                                                                            // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                            else if (parseFloat(state.val) == parseFloat(result[i].heightDown) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentAction != 'down' && result[i].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                                result[i].currentAction = 'OpenInSunProtect';
                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                                adapter.log.debug('Set sunprotect mode for ' + result[i].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                            }
                                                                            // Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set ->
                                                                            // set sunProtect again
                                                                            else if (parseFloat(state.val) == parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentHeight != result[i].heightDown && result[i].currentAction == '') {
                                                                                adapter.log.debug(result[i].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + result[i].heightDownSun);
                                                                                result[i].currentAction = 'sunProtect';
                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                            }
                                                                        }
                                                                    });
                                                                }
                                                            }
                                                        }
                                                        if (currentValue != mustValue && result[i].autoDrive == 'onlyUp' && result[i].driveAfterClose == true) {
                                                            if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth) {
                                                                if (result[i].tempOutside < outsideTemp && (result[i].lightSensor != '' && result[i].valueLight < sunLight || result[i].lightSensor == '') && result[i].triggerAction != 'sunProtect' && result[i].triggerAction != 'OpenInSunProtect' && result[i].triggerAction != 'Manu_Mode') {
                                                                    /**
                                                                     * @param {any} err
                                                                     * @param {{ val: string; }} state
                                                                     */
                                                                    adapter.getForeignState(result[i].name, (err, state) => {
                                                                        if (typeof state != undefined && state != null) {
                                                                            adapter.log.debug(result[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + result[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + result[i].currentHeight + ' AND currentHeight:' + result[i].currentHeight + ' == heightUp:' + result[i].heightUp);
                                                                            if (((parseFloat(state.val) > parseFloat(result[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(result[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp && result[i].triggerAction != 'down') {
                                                                                adapter.log.info(' Will sunprotect ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                                result[i].triggerHeight = parseFloat(result[i].heightDownSun);
                                                                                adapter.log.debug('save new trigger height: ' + result[i].heightDownSun + '%');
                                                                                result[i].triggerAction = 'sunProtect';
                                                                                adapter.log.debug('save new trigger action: ' + result[i].triggerAction);
                                                                            }
                                                                           
                                                                        }
                                                                    });
                                                                }
                                                            }
                                                        } 
                                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown') || (result[i].triggerID == '')) {
                                                            const hysteresisOutside = (((100 - result[i].hysteresisOutside) / 100) * result[i].tempOutside).toFixed(2);
                                                            const hysteresisLight = (((100 - result[i].hysteresisLight) / 100) * result[i].valueLight).toFixed(2);

                                                            if ((resultDirectionRangePlus) < azimuth || (parseFloat(hysteresisOutside) > outsideTemp || result[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && result[i].lightSensor == '')) {

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        if (result[i].currentAction == 'sunProtect' && result[i].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                            result[i].currentAction = 'up';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                            adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active');
                                                                            adapter.log.debug('Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight);
                                                                            adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightUp + '%')
                                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                                                            result[i].currentHeight = result[i].heightUp;
                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                                            adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightUp + '%')
                                                                            shutterState(result[i].name, adapter);
                                                                        }
                                                                        else if (result[i].currentAction == 'OpenInSunProtect') {
                                                                            result[i].currentAction = 'none';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                            adapter.log.debug('OpenInSunProtect for ' + result[i].shutterName + ' is not longer active');
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                        if (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].driveAfterClose == true) {
                                                            const hysteresisOutside = (((100 - result[i].hysteresisOutside) / 100) * result[i].tempOutside).toFixed(2);
                                                            const hysteresisLight = (((100 - result[i].hysteresisLight) / 100) * result[i].valueLight).toFixed(2);

                                                            if ((resultDirectionRangePlus) < azimuth || (parseFloat(hysteresisOutside) > outsideTemp || result[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && result[i].lightSensor == '')) {

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: any; }} state
                                                                 */
                                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        if (result[i].triggerAction == 'sunProtect' && result[i].KeepSunProtect === false && (parseFloat(result[i].triggerHeight) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                            adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active anymore');
                                                                            adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                            adapter.log.info(' Will end sunprotect ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                            result[i].triggerHeight = parseFloat(result[i].heightUp);
                                                                            adapter.log.debug('save new trigger height: ' + result[i].triggerHeight + '%');
                                                                            result[i].triggerAction = 'up';
                                                                            adapter.log.debug('save new trigger action: ' + result[i].triggerAction);
                                                                        }
                                                                        else if (result[i].currentAction == 'OpenInSunProtect') {
                                                                            result[i].triggerAction = 'none';
                                                                            adapter.log.debug('OpenInSunProtect for ' + result[i].shutterName + ' is not longer active');
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                    });
                                                });
                                            }
                                        });
                                    }, driveDelayUpSleep * i, i);
                                break;

                                //////////////////////////////////////////////////////////////////////////////////////////////////////

                                // ++++++++++++++++++++++++++++++ sunprotect with direction ++++++++++++++++++++++++++++++++++

                                case 'only direction': //only direction
                                    resultDirectionRangeMinus = parseInt(result[i].direction) - parseInt(result[i].directionRange);
                                    resultDirectionRangePlus = parseInt(result[i].direction) + parseInt(result[i].directionRange);
                                    setTimeout(function () {
                                        let currentValue = '';
                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'off') || (result[i].triggerID == '')) {
                                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp') || (result[i].triggerID == '')) {
                                                    if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth && result[i].currentAction != 'sunProtect' && result[i].currentAction != 'OpenInSunProtect' && result[i].currentAction != 'Manu_Mode') {

                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: string; }} state
                                                         */
                                                        adapter.getForeignState(result[i].name, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                adapter.log.debug(result[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + result[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + result[i].currentHeight + ' AND currentHeight:' + result[i].currentHeight + ' == heightUp:' + result[i].heightUp);
                                                                if (((parseFloat(state.val) > parseFloat(result[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(result[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                    result[i].currentAction = 'sunProtect';
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                    adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is active');
                                                                    adapter.log.debug('RangeMinus: ' + resultDirectionRangeMinus + ' < ' + azimuth + 'RangePlus: ' + resultDirectionRangePlus + ' > ' + azimuth);
                                                                    adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%')

                                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightDownSun), false);
                                                                    result[i].currentHeight = result[i].heightDownSun;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                                    adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDownSun + '%')
                                                                    shutterState(result[i].name, adapter);
                                                                }
                                                                // Shutter closed. Set currentAction = sunProtect when sunProtect starts => 
                                                                // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                else if (parseFloat(state.val) == parseFloat(result[i].heightDown) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentAction != 'down' && result[i].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                    result[i].currentAction = 'OpenInSunProtect';
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                    adapter.log.debug('Set sunprotect mode for ' + result[i].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                }
                                                                // Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set ->
                                                                // set sunProtect again
                                                                else if (parseFloat(state.val) == parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentHeight != result[i].heightDown && result[i].currentAction == '') {
                                                                    adapter.log.debug(result[i].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + result[i].heightDownSun);
                                                                    result[i].currentAction = 'sunProtect';
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                }
                                                            }
                                                        });
                                                    }
                                                }
                                                if (currentValue != mustValue && result[i].autoDrive == 'onlyUp' && result[i].driveAfterClose == true) {
                                                    if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth && result[i].triggerAction != 'sunProtect' && result[i].triggerAction != 'OpenInSunProtect' && result[i].triggerAction != 'Manu_Mode') {
                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: string; }} state
                                                         */
                                                        adapter.getForeignState(result[i].name, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                adapter.log.debug(result[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + result[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + result[i].currentHeight + ' AND currentHeight:' + result[i].currentHeight + ' == heightUp:' + result[i].heightUp);
                                                                if (((parseFloat(state.val) > parseFloat(result[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(result[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp && result[i].triggerAction != 'down') {
                                                                    adapter.log.info(' Will sunprotect ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                    result[i].triggerHeight = parseFloat(result[i].heightDownSun);
                                                                    adapter.log.debug('save new trigger height: ' + result[i].heightDownSun + '%');
                                                                    result[i].triggerAction = 'sunProtect';
                                                                    adapter.log.debug('save new trigger action: ' + result[i].triggerAction);
                                                                }
                                                            }    
                                                        });
                                                        
                                                    }
                                                } 
                                                if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown') || (result[i].triggerID == '')) {
                                                    if ((resultDirectionRangePlus) < azimuth) {
                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: string; }} state
                                                         */
                                                        adapter.getForeignState(result[i].name, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                if (result[i].currentAction == 'sunProtect' && result[i].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                    result[i].currentAction = 'up';
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                    adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active');
                                                                    adapter.log.debug('Range: ' + resultDirectionRangePlus + ' < ' + azimuth);
                                                                    adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightUp + '%')
                                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                                                    result[i].currentHeight = result[i].heightUp;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                                    adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightUp + '%')
                                                                    shutterState(result[i].name, adapter);
                                                                }
                                                                else if (result[i].currentAction == 'OpenInSunProtect') {
                                                                    result[i].currentAction = 'none';
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                    adapter.log.debug('OpenInSunProtect for ' + result[i].shutterName + ' is not longer active');
                                                                }
                                                            }
                                                        });
                                                    }
                                                }
                                                if (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].driveAfterClose == true) {
                                                    if ((resultDirectionRangePlus) < azimuth) {
                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: any; }} state
                                                         */
                                                        adapter.getForeignState(result[i].name, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                if (result[i].triggerAction == 'sunProtect' && result[i].KeepSunProtect === false && (parseFloat(result[i].triggerHeight) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                    adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active anymore');
                                                                    adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                    adapter.log.info(' Will end sunprotect ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                    result[i].triggerHeight = parseFloat(result[i].heightUp);
                                                                    adapter.log.debug('save new trigger height: ' + result[i].triggerHeight + '%');
                                                                    result[i].triggerAction = 'up';
                                                                    adapter.log.debug('save new trigger action: ' + result[i].triggerAction);
                                                                }
                                                                else if (result[i].currentAction == 'OpenInSunProtect') {
                                                                    result[i].triggerAction = 'none';
                                                                    adapter.log.debug('OpenInSunProtect for ' + result[i].shutterName + ' is not longer active');
                                                                }
                                                            }
                                                        });
                                                    }
                                                }
                                            }
                                        });
                                    }, driveDelayUpSleep * i, i);
                                break;

                                //////////////////////////////////////////////////////////////////////////////////////////////////////

                                // ++++++++++++++++++++++++ sunprotect with outside temperature and Lightsensor +++++++++++++++++++++++

                                case 'only outside temperature': //only outside temperature
                                    setTimeout(function () {
                                        let currentValue = '';
                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'off') || (result[i].triggerID == '')) {
                                                /** @type {number} */
                                                let outsideTemp;
                                                /** @type {number} */
                                                let sunLight;

                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(result[i].outsideTempSensor, (err, state) => {
                                                    if (typeof state != undefined && state != null) {
                                                        outsideTemp = parseFloat(state.val);
                                                    }

                                                    /**
                                                     * @param {any} err
                                                     * @param {{ val: string; }} state
                                                     */
                                                    adapter.getForeignState(result[i].lightSensor, (err, state) => {
                                                        if (typeof state != undefined && state != null) {
                                                            sunLight = parseFloat(state.val);
                                                        }
                                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp') || (result[i].triggerID == '')) {
                                                            if (result[i].tempOutside < outsideTemp && (result[i].lightSensor != '' && result[i].valueLight < sunLight || result[i].lightSensor == '') && result[i].currentAction != 'sunProtect' && result[i].currentAction != 'OpenInSunProtect' && result[i].currentAction != 'Manu_Mode') {
                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        adapter.log.debug(result[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + result[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + result[i].currentHeight + ' AND currentHeight:' + result[i].currentHeight + ' == heightUp:' + result[i].heightUp);
                                                                        //if (parseFloat(state.val) > parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                        if (((parseFloat(state.val) > parseFloat(result[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(result[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                            result[i].currentAction = 'sunProtect';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                            adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is active');
                                                                            adapter.log.debug('Temperature outside: ' + outsideTemp + ' > ' + result[i].tempOutside + ' AND Light: ' + sunLight + ' > ' + result[i].valueLight);
                                                                            adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%')

                                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightDownSun), false);
                                                                            result[i].currentHeight = result[i].heightDownSun;
                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                                            adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDownSun + '%')
                                                                            shutterState(result[i].name, adapter);
                                                                        }
                                                                        // Shutter closed. Set currentAction = sunProtect when sunProtect starts =>
                                                                        // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                        else if (parseFloat(state.val) == parseFloat(result[i].heightDown) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentAction != 'down' && result[i].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                            result[i].currentAction = 'OpenInSunProtect';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                            adapter.log.debug('Set sunprotect mode for ' + result[i].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                        }
                                                                        // Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set ->
                                                                        // set sunProtect again
                                                                        else if (parseFloat(state.val) == parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentHeight != result[i].heightDown && result[i].currentAction == '') {
                                                                            adapter.log.debug(result[i].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + result[i].heightDownSun);
                                                                            result[i].currentAction = 'sunProtect';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                        if (currentValue != mustValue && result[i].autoDrive == 'onlyUp' && result[i].driveAfterClose == true) {
                                                            if (result[i].tempOutside < outsideTemp && (result[i].lightSensor != '' && result[i].valueLight < sunLight || result[i].lightSensor == '') && result[i].triggerAction != 'sunProtect' && result[i].triggerAction != 'OpenInSunProtect' && result[i].triggerAction != 'Manu_Mode') {
                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        adapter.log.debug(result[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + result[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + result[i].currentHeight + ' AND currentHeight:' + result[i].currentHeight + ' == heightUp:' + result[i].heightUp);
                                                                        if (((parseFloat(state.val) > parseFloat(result[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(result[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp && result[i].triggerAction != 'down') {
                                                                            adapter.log.info(' Will sunprotect ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                            result[i].triggerHeight = parseFloat(result[i].heightDownSun);
                                                                            adapter.log.debug('save new trigger height: ' + result[i].heightDownSun + '%');
                                                                            result[i].triggerAction = 'sunProtect';
                                                                            adapter.log.debug('save new trigger action: ' + result[i].triggerAction);
                                                                        }
                                                                    }
                                                                });
                                                                
                                                            }
                                                        } 
                                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown') || (result[i].triggerID == '')) {

                                                            let hysteresisOutside = (((100 - result[i].hysteresisOutside) / 100) * result[i].tempOutside).toFixed(2);
                                                            let hysteresisLight = (((100 - result[i].hysteresisLight) / 100) * result[i].valueLight).toFixed(2);

                                                            if ((result[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp)) {

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        if (result[i].currentAction == 'sunProtect' && result[i].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                            result[i].currentAction = 'up';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                            adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active');
                                                                            adapter.log.debug('Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight);
                                                                            adapter.log.info('Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightUp + '%')

                                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                                                            result[i].currentHeight = result[i].heightUp;
                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                                            adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightUp + '%')
                                                                            shutterState(result[i].name, adapter);
                                                                        }
                                                                        else if (result[i].currentAction == 'OpenInSunProtect') {
                                                                            result[i].currentAction = 'none';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                            adapter.log.debug('OpenInSunProtect for ' + result[i].shutterName + ' is not longer active');
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                        if (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].driveAfterClose == true) {

                                                            let hysteresisOutside = (((100 - result[i].hysteresisOutside) / 100) * result[i].tempOutside).toFixed(2);
                                                            let hysteresisLight = (((100 - result[i].hysteresisLight) / 100) * result[i].valueLight).toFixed(2);

                                                            if ((result[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp)) {

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: any; }} state
                                                                 */
                                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        if (result[i].triggerAction == 'sunProtect' && result[i].KeepSunProtect === false && (parseFloat(result[i].triggerHeight) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                            adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active anymore');
                                                                            adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                            adapter.log.info(' Will end sunprotect ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                            result[i].triggerHeight = parseFloat(result[i].heightUp);
                                                                            adapter.log.debug('save new trigger height: ' + result[i].triggerHeight + '%');
                                                                            result[i].triggerAction = 'up';
                                                                            adapter.log.debug('save new trigger action: ' + result[i].triggerAction);
                                                                        }
                                                                        else if (result[i].currentAction == 'OpenInSunProtect') {
                                                                            result[i].triggerAction = 'none';
                                                                            adapter.log.debug('OpenInSunProtect for ' + result[i].shutterName + ' is not longer active');
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                    });
                                                });
                                            }
                                        });
                                    }, driveDelayUpSleep * i, i);
                                break;

                                //////////////////////////////////////////////////////////////////////////////////////////////////////

                                // ++++++++++++++++++++++++++++ sunprotect with inside temperature ++++++++++++++++++++++++++++++++++

                                case 'only inside temperature': //only inside temperature
                                    setTimeout(function () {
                                        let currentValue = '';
                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(result[i].triggerID, (err, state) => {
                                            let mustValue = ('' + result[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue && result[i].tempSensor != '' || (currentValue != mustValue && result[i].autoDrive != 'off' && result[i].tempSensor != '') || (result[i].triggerID == '' && result[i].tempSensor != '')) {
                                                /** @type {string | number} */
                                                let insideTemp;
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(result[i].tempSensor, (err, state) => {
                                                    if (typeof state != undefined && state != null) {
                                                        insideTemp = parseFloat(state.val);

                                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyUp') || (result[i].triggerID == '')) {
                                                            if (insideTemp > result[i].tempInside && result[i].currentAction != 'sunProtect' && result[i].currentAction != 'OpenInSunProtect' && result[i].currentAction != 'Manu_Mode') {

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        //if (parseFloat(state.val) > parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                        if (((parseFloat(state.val) > parseFloat(result[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(result[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp) {
                                                                            result[i].currentAction = 'sunProtect';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                            adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is active');
                                                                            adapter.log.info('#40 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%');
                                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightDownSun), false);
                                                                            result[i].currentHeight = result[i].heightDownSun;
                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                                            adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightDownSun + '%')
                                                                            shutterState(result[i].name, adapter);
                                                                        }
                                                                        // Shutter closed. Set currentAction = sunProtect when sunProtect starts =>
                                                                        // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                        else if (parseFloat(state.val) == parseFloat(result[i].heightDown) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentAction != 'down' && result[i].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                            result[i].currentAction = 'OpenInSunProtect';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                            adapter.log.debug('Set sunprotect mode for ' + result[i].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                        }
                                                                        // Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set ->
                                                                        // set sunProtect again
                                                                        else if (parseFloat(state.val) == parseFloat(result[i].heightDownSun) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight != result[i].heightUp && result[i].currentHeight != result[i].heightDown && result[i].currentAction == '') {
                                                                            adapter.log.debug(result[i].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + result[i].heightDownSun);
                                                                            result[i].currentAction = 'sunProtect';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                        if (currentValue != mustValue && result[i].autoDrive == 'onlyUp' && result[i].driveAfterClose == true) {
                                                            if (insideTemp > result[i].tempInside && result[i].triggerAction != 'sunProtect' && result[i].triggerAction != 'OpenInSunProtect' && result[i].triggerAction != 'Manu_Mode') {
                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        adapter.log.debug(result[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + result[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + result[i].currentHeight + ' AND currentHeight:' + result[i].currentHeight + ' == heightUp:' + result[i].heightUp);
                                                                        if (((parseFloat(state.val) > parseFloat(result[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(result[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(result[i].currentHeight) && result[i].currentHeight == result[i].heightUp && result[i].triggerAction != 'down') {
                                                                            adapter.log.info(' Will sunprotect ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                            result[i].triggerHeight = parseFloat(result[i].heightDownSun);
                                                                            adapter.log.debug('save new trigger height: ' + result[i].heightDownSun + '%');
                                                                            result[i].triggerAction = 'sunProtect';
                                                                            adapter.log.debug('save new trigger action: ' + result[i].triggerAction);
                                                                        }
                                                                    }
                                                                });
                                                                
                                                            }
                                                        } 
                                                        if (currentValue === mustValue || (currentValue != mustValue && result[i].autoDrive != 'onlyDown') || (result[i].triggerID == '')) {
                                                            let hysteresisInside = (((100 - result[i].hysteresisInside) / 100) * result[i].tempInside).toFixed(2);

                                                            if (insideTemp < parseFloat(hysteresisInside)) {

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        if (result[i].currentAction == 'sunProtect' && result[i].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                            result[i].currentAction = 'up';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                            adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active');
                                                                            adapter.log.info('#41 Set ID: ' + result[i].shutterName + ' value: ' + result[i].heightUp + '%');
                                                                            adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                                                            result[i].currentHeight = result[i].heightUp;
                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                                            adapter.log.debug('Sunprotect ' + result[i].shutterName + ' old height: ' + result[i].oldHeight + '% new height: ' + result[i].heightUp + '%')
                                                                            shutterState(result[i].name, adapter);
                                                                        }
                                                                        else if (result[i].currentAction == 'OpenInSunProtect') {
                                                                            result[i].currentAction = 'none';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                                            adapter.log.debug('OpenInSunProtect for ' + result[i].shutterName + ' is not longer active');
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                        if (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].driveAfterClose == true) {
                                                            let hysteresisInside = (((100 - result[i].hysteresisInside) / 100) * result[i].tempInside).toFixed(2);

                                                            if (insideTemp < parseFloat(hysteresisInside)) {

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: any; }} state
                                                                 */
                                                                adapter.getForeignState(result[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        if (result[i].triggerAction == 'sunProtect' && result[i].KeepSunProtect === false && (parseFloat(result[i].triggerHeight) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                                            adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active anymore');
                                                                            adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                            adapter.log.info(' Will end sunprotect ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                            result[i].triggerHeight = parseFloat(result[i].heightUp);
                                                                            adapter.log.debug('save new trigger height: ' + result[i].triggerHeight + '%');
                                                                            result[i].triggerAction = 'up';
                                                                            adapter.log.debug('save new trigger action: ' + result[i].triggerAction);
                                                                        }
                                                                        else if (result[i].currentAction == 'OpenInSunProtect') {
                                                                            result[i].triggerAction = 'none';
                                                                            adapter.log.debug('OpenInSunProtect for ' + result[i].shutterName + ' is not longer active');
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                    }
                                                });
                                            }
                                        });
                                    }, driveDelayUpSleep * i, i);
                                break;
                            }
                        }
                    });
                }
            }
        }

        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        
        /*
        let upSunProtect = adapter.config.sun_shutterUp;

        if ((upSunProtect) == undefined) {
            upSunProtect = adapter.config.sun_shutterUp;
        }
        let upTimeSun = upSunProtect.split(':');
        */

        // +++++++++++++++++ End of sunprotect with Elevationslimit +++++++++++++++

        // Full Result
        resultFull = adapter.config.events;

        if (resultFull) {
            // Filter enabled
            let /**
                 * @param {{ enabled: boolean; }} d
                 */
                resEnabled = resultFull.filter(d => d.enabled === true);

            let result = resEnabled;
            const sunProtEndStart = parseInt(adapter.config.sunProtEndElevation);
            const sunProtEndStop = (adapter.config.sunProtEndElevation - 1);

            for (const i in result) {
                if (elevation <= sunProtEndStart && elevation >= sunProtEndStop && (result[i].currentAction == 'sunProtect' || result[i].currentAction == 'manu_sunProtect')) {
                    let nameDevice = result[i].shutterName.replace(/[.;, ]/g, '_');

                    let convertShutter;

                    if (parseFloat(result[i].heightDown) < parseFloat(result[i].heightUp)) {
                        convertShutter = false;
                        adapter.log.debug(result[i].shutterName + ' level conversion is disabled ...');
                    } else if (parseFloat(result[i].heightDown) > parseFloat(result[i].heightUp)) {
                        convertShutter = true;
                        adapter.log.debug(result[i].shutterName + ' level conversion is enabled');
                    }

                    /**
                     * @param {any} err
                     * @param {boolean} state
                     */
                    adapter.getState('shutters.autoSun.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {
                            setTimeout(function () {
                                let currentValue = '';
                                /**
                                 * @param {any} err
                                 * @param {{ val: string; }} state
                                 */
                                adapter.getForeignState(result[i].triggerID, (err, state) => {
                                    let mustValue = ('' + result[i].triggerState);
                                    if (typeof state != undefined && state != null) {
                                        currentValue = ('' + state.val);
                                    }
                                    if (currentValue === mustValue && result[i].tempSensor != '' || (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].autoDrive != 'off') || (result[i].triggerID == '')) {

                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null) {
                                                if ((result[i].currentAction == 'sunProtect' || result[i].currentAction == 'manu_sunProtect') && result[i].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                    result[i].currentAction = 'none';
                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: result[i].currentAction, ack: true });
                                                    adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is completed');
                                                    adapter.log.info('#42 Set ID: ' + result[i].shutterName + ' value: ' + parseFloat(result[i].heightUp) + '%');
                                                    adapter.setForeignState(result[i].name, parseFloat(result[i].heightUp), false);
                                                    result[i].currentHeight = result[i].heightUp;
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: result[i].currentHeight, ack: true });
                                                    adapter.log.debug('save current height: ' + result[i].currentHeight + '%' + ' from ' + result[i].shutterName);
                                                    shutterState(result[i].name, adapter);
                                                }
                                            }
                                        });
                                    }
                                    if (currentValue != mustValue && result[i].autoDrive != 'onlyDown' && result[i].driveAfterClose == true) {

                                         /**
                                         * @param {any} err
                                         * @param {{ val: any; }} state
                                         */
                                        adapter.getForeignState(result[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null) {
                                                if ((result[i].triggerAction == 'sunProtect' || result[i].triggerAction == 'manu_sunProtect') && result[i].KeepSunProtect === false && (parseFloat(result[i].triggerHeight) == parseFloat(result[i].heightDownSun) || parseFloat(state.val) == parseFloat(result[i].currentHeight))) {
                                                    adapter.log.debug('Sunprotect for ' + result[i].shutterName + ' is not active anymore');
                                                    adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                    adapter.log.info(' Will end sunprotect ID: ' + result[i].shutterName + ' value: ' + result[i].heightDownSun + '%' + ' after the window has been closed ');
                                                    result[i].triggerHeight = parseFloat(result[i].heightUp);
                                                    adapter.log.debug('save new trigger height: ' + result[i].triggerHeight + '%');
                                                    result[i].triggerAction = 'up';
                                                    adapter.log.debug('save new trigger action: ' + result[i].triggerAction);
                                                 }
                                             }
                                        });
                                        
                                    }
                                });
                            }, driveDelayUpSleep * i, i);
                        }
                    });
                }
            }
        }
    }, 2000);
}
module.exports = sunProtect;
