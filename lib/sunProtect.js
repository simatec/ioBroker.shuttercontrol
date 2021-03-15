'use strict';

// ++++++++++++++++++++++++++ sunprotect  +++++++++++++++++++++++++++

const shutterState = require('./shutterState.js');         // shutterState

function sunProtect(adapter, elevation, azimuth, shutterSettings) {

    const driveDelayUpSleep = adapter.config.driveDelayUpAstro * 1000;

    setTimeout(function () {
        // Full Result
        let resultFull = shutterSettings;

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

                    let nameDevice = shutterSettings[i].shutterName.replace(/[.;, ]/g, '_');

                    /** @type {boolean} */
                    let convertShutter;

                    if (parseFloat(shutterSettings[i].heightDown) < parseFloat(shutterSettings[i].heightUp)) {
                        convertShutter = false;
                        //adapter.log.debug(shutterSettings[i].shutterName + ' level conversion is disabled ...');
                    } else if (parseFloat(shutterSettings[i].heightDown) > parseFloat(shutterSettings[i].heightUp)) {
                        convertShutter = true;
                        //adapter.log.debug(shutterSettings[i].shutterName + ' level conversion is enabled');
                    }

                    /**
                     * @param {any} err
                     * @param {boolean} state
                     */
                    adapter.getState('shutters.autoSun.' + nameDevice, (err, state) => {
                        if (state && state === true || state && state.val === true) {

                            switch (shutterSettings[i].type) {

                                // +++++++++++++++++ sunprotect with in/outside temperature and Lightsensor +++++++++++++++

                                case 'in- & outside temperature': // in- & outside temperature
                                    setTimeout(function () {
                                        let currentValue = '';
                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(shutterSettings[i].triggerID, (err, state) => {
                                            let mustValue = ('' + shutterSettings[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue && shutterSettings[i].tempSensor != '' || (currentValue != mustValue && shutterSettings[i].autoDrive != 'off' && shutterSettings[i].tempSensor != '') || (shutterSettings[i].triggerID == '' && shutterSettings[i].tempSensor != '')) {
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
                                                adapter.getForeignState(shutterSettings[i].tempSensor, (err, state) => {
                                                    if (typeof state != undefined && state != null) {
                                                        insideTemp = parseFloat(state.val);

                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: string; }} state
                                                         */
                                                        adapter.getForeignState(shutterSettings[i].outsideTempSensor, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                outsideTemp = parseFloat(state.val);
                                                            }

                                                            /**
                                                             * @param {any} err
                                                             * @param {{ val: string; }} state
                                                             */
                                                            adapter.getForeignState(shutterSettings[i].lightSensor, (err, state) => {
                                                                if (typeof state != undefined && state != null) {
                                                                    sunLight = parseFloat(state.val);
                                                                }

                                                                if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyUp') || (shutterSettings[i].triggerID == '')) {
                                                                    if (insideTemp > shutterSettings[i].tempInside) {
                                                                        if (shutterSettings[i].tempOutside < outsideTemp && (shutterSettings[i].lightSensor != '' && shutterSettings[i].valueLight < sunLight || shutterSettings[i].lightSensor == '') && shutterSettings[i].currentAction != 'sunProtect' && shutterSettings[i].currentAction != 'OpenInSunProtect' && shutterSettings[i].currentAction != 'Manu_Mode') {
                                                                            /**
                                                                             * @param {any} err
                                                                             * @param {{ val: string; }} state
                                                                             */
                                                                            adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                                                if (typeof state != undefined && state != null) {
                                                                                    adapter.log.debug(shutterSettings[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[i].currentHeight + ' AND currentHeight:' + shutterSettings[i].currentHeight + ' == heightUp:' + shutterSettings[i].heightUp);
                                                                                    //if (parseFloat(state.val) > parseFloat(shutterSettings[i].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight == shutterSettings[i].heightUp) {
                                                                                    if (((parseFloat(state.val) > parseFloat(shutterSettings[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight == shutterSettings[i].heightUp) {
                                                                                        shutterSettings[i].currentAction = 'sunProtect';
                                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                                        adapter.log.debug('Sunprotect for ' + shutterSettings[i].shutterName + ' is active');
                                                                                        adapter.log.debug('Temperature inside: ' + insideTemp + ' > ' + shutterSettings[i].tempInside + ' AND ( Temperatur outside: ' + outsideTemp + ' > ' + shutterSettings[i].tempOutside + ' AND Light: ' + sunLight + ' > ' + shutterSettings[i].valueLight + ' )');
                                                                                        adapter.log.info('Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDownSun + '%')
                                                                                        adapter.setForeignState(shutterSettings[i].name, parseFloat(shutterSettings[i].heightDownSun), false);
                                                                                        shutterSettings[i].currentHeight = shutterSettings[i].heightDownSun;
                                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                                                        adapter.log.debug('Sunprotect ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterSettings[i].heightDownSun + '%');
                                                                                        shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                                                        return (shutterSettings);
                                                                                    }
                                                                                    // Shutter closed. Set currentAction = sunProtect when sunProtect starts => 
                                                                                    // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                                    else if (parseFloat(state.val) == parseFloat(shutterSettings[i].heightDown) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight != shutterSettings[i].heightUp && shutterSettings[i].currentAction != 'down' && shutterSettings[i].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                                        shutterSettings[i].currentAction = 'OpenInSunProtect';
                                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                                        adapter.log.debug('Set sunprotect mode for ' + shutterSettings[i].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                                        return (shutterSettings);
                                                                                    }
                                                                                    //Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set -> 
                                                                                    // set sunProtect again
                                                                                    else if (parseFloat(state.val) == parseFloat(shutterSettings[i].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight != shutterSettings[i].heightUp && shutterSettings[i].currentHeight != shutterSettings[i].heightDown && shutterSettings[i].currentAction == '') {
                                                                                        adapter.log.debug(shutterSettings[i].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + shutterSettings[i].heightDownSun);
                                                                                        shutterSettings[i].currentAction = 'sunProtect';
                                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                                        return (shutterSettings);
                                                                                    }
                                                                                }
                                                                            });
                                                                        }
                                                                    }
                                                                }
                                                                if (currentValue != mustValue && shutterSettings[i].autoDrive == 'onlyUp' && shutterSettings[i].driveAfterClose == true) {
                                                                    if (insideTemp > shutterSettings[i].tempInside) {
                                                                        if (shutterSettings[i].tempOutside < outsideTemp && (shutterSettings[i].lightSensor != '' && shutterSettings[i].valueLight < sunLight || shutterSettings[i].lightSensor == '') && shutterSettings[i].triggerAction != 'sunProtect' && shutterSettings[i].triggerAction != 'OpenInSunProtect' && shutterSettings[i].triggerAction != 'Manu_Mode') {
                                                                            /**
                                                                             * @param {any} err
                                                                             * @param {{ val: string; }} state
                                                                             */
                                                                            adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                                                if (typeof state != undefined && state != null) {
                                                                                    adapter.log.debug(shutterSettings[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[i].currentHeight + ' AND currentHeight:' + shutterSettings[i].currentHeight + ' == heightUp:' + shutterSettings[i].heightUp + ' AND triggerAction:' + shutterSettings[i].triggerAction + ' != down ');
                                                                                    if (((parseFloat(state.val) > parseFloat(shutterSettings[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight == shutterSettings[i].heightUp && shutterSettings[i].triggerAction != 'down') {
                                                                                        adapter.log.info(' Will sunprotect ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                                        shutterSettings[i].triggerHeight = parseFloat(shutterSettings[i].heightDownSun);
                                                                                        adapter.log.debug('save new trigger height: ' + shutterSettings[i].heightDownSun + '%');
                                                                                        shutterSettings[i].triggerAction = 'sunProtect';
                                                                                        adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
                                                                                        return (shutterSettings);
                                                                                    }

                                                                                }
                                                                            });
                                                                        }
                                                                    }
                                                                }
                                                                if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyDown') || (shutterSettings[i].triggerID == '')) {
                                                                    let hysteresisOutside = (((100 - shutterSettings[i].hysteresisOutside) / 100) * shutterSettings[i].tempOutside).toFixed(2);
                                                                    let hysteresisInside = (((100 - shutterSettings[i].hysteresisInside) / 100) * shutterSettings[i].tempInside).toFixed(2);
                                                                    let hysteresisLight = (((100 - shutterSettings[i].hysteresisLight) / 100) * shutterSettings[i].valueLight).toFixed(2);

                                                                    if (insideTemp < parseFloat(hysteresisInside) || (parseFloat(hysteresisOutside) > outsideTemp || shutterSettings[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && shutterSettings[i].lightSensor == '')) {

                                                                        /**
                                                                         * @param {any} err
                                                                         * @param {{ val: string; }} state
                                                                         */
                                                                        adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                if (shutterSettings[i].currentAction == 'sunProtect' && shutterSettings[i].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(shutterSettings[i].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight))) {
                                                                                    shutterSettings[i].currentAction = 'up';
                                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                                    adapter.log.debug('Sunprotect for ' + shutterSettings[i].shutterName + ' is not active');
                                                                                    adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                                    adapter.log.info('Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightUp + '%')
                                                                                    adapter.setForeignState(shutterSettings[i].name, parseFloat(shutterSettings[i].heightUp), false);
                                                                                    shutterSettings[i].currentHeight = shutterSettings[i].heightUp;
                                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                                                    adapter.log.debug('Sunprotect ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterSettings[i].heightDownSun + '%')
                                                                                    shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                                                    return (shutterSettings);
                                                                                }
                                                                                else if (shutterSettings[i].currentAction == 'OpenInSunProtect') {
                                                                                    shutterSettings[i].currentAction = 'none';
                                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                                    adapter.log.debug('OpenInSunProtect for ' + shutterSettings[i].shutterName + ' is not longer active');
                                                                                    return (shutterSettings);
                                                                                }
                                                                            }
                                                                        });
                                                                    }
                                                                }
                                                                if (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyDown' && shutterSettings[i].driveAfterClose == true) {
                                                                    let hysteresisOutside = (((100 - shutterSettings[i].hysteresisOutside) / 100) * shutterSettings[i].tempOutside).toFixed(2);
                                                                    let hysteresisInside = (((100 - shutterSettings[i].hysteresisInside) / 100) * shutterSettings[i].tempInside).toFixed(2);
                                                                    let hysteresisLight = (((100 - shutterSettings[i].hysteresisLight) / 100) * shutterSettings[i].valueLight).toFixed(2);

                                                                    if (insideTemp < parseFloat(hysteresisInside) || (parseFloat(hysteresisOutside) > outsideTemp || shutterSettings[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && shutterSettings[i].lightSensor == '')) {

                                                                        /**
                                                                         * @param {any} err
                                                                         * @param {{ val: any; }} state
                                                                         */
                                                                        adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                if (shutterSettings[i].triggerAction == 'sunProtect' && shutterSettings[i].KeepSunProtect === false && (parseFloat(shutterSettings[i].triggerHeight) == parseFloat(shutterSettings[i].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight))) {
                                                                                    adapter.log.debug('Sunprotect for ' + shutterSettings[i].shutterName + ' is not active anymore');
                                                                                    adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                                    adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                                    shutterSettings[i].triggerHeight = parseFloat(shutterSettings[i].heightUp);
                                                                                    adapter.log.debug('save new trigger height: ' + shutterSettings[i].triggerHeight + '%');
                                                                                    shutterSettings[i].triggerAction = 'up';
                                                                                    adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
                                                                                    return (shutterSettings);
                                                                                }
                                                                                else if (shutterSettings[i].currentAction == 'OpenInSunProtect') {
                                                                                    shutterSettings[i].triggerAction = 'none';
                                                                                    adapter.log.debug('OpenInSunProtect for ' + shutterSettings[i].shutterName + ' is not longer active');
                                                                                    return (shutterSettings);
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
                                    resultDirectionRangeMinus = parseInt(shutterSettings[i].direction) - parseInt(shutterSettings[i].directionRange);
                                    resultDirectionRangePlus = parseInt(shutterSettings[i].direction) + parseInt(shutterSettings[i].directionRange);
                                    setTimeout(function () {
                                        let currentValue = '';
                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(shutterSettings[i].triggerID, (err, state) => {
                                            let mustValue = ('' + shutterSettings[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue && shutterSettings[i].tempSensor != '' || (currentValue != mustValue && shutterSettings[i].autoDrive != 'off' && shutterSettings[i].tempSensor != '') || (shutterSettings[i].triggerID == '' && shutterSettings[i].tempSensor != '')) {
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
                                                adapter.getForeignState(shutterSettings[i].tempSensor, (err, state) => {
                                                    if (typeof state != undefined && state != null) {
                                                        insideTemp = parseFloat(state.val);

                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: string; }} state
                                                         */
                                                        adapter.getForeignState(shutterSettings[i].outsideTempSensor, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                outsideTemp = parseFloat(state.val);
                                                            }

                                                            /**
                                                             * @param {any} err
                                                             * @param {{ val: string; }} state
                                                             */
                                                            adapter.getForeignState(shutterSettings[i].lightSensor, (err, state) => {
                                                                if (typeof state != undefined && state != null) {
                                                                    sunLight = parseFloat(state.val);
                                                                }
                                                                if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyUp') || (shutterSettings[i].triggerID == '')) {
                                                                    if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth && insideTemp > shutterSettings[i].tempInside) {
                                                                        if (shutterSettings[i].tempOutside < outsideTemp && (shutterSettings[i].lightSensor != '' && shutterSettings[i].valueLight < sunLight || shutterSettings[i].lightSensor == '') && shutterSettings[i].currentAction != 'sunProtect' && shutterSettings[i].currentAction != 'OpenInSunProtect' && shutterSettings[i].currentAction != 'Manu_Mode') {

                                                                            /**
                                                                             * @param {any} err
                                                                             * @param {{ val: string; }} state
                                                                             */
                                                                            adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                                                if (typeof state != undefined && state != null) {
                                                                                    adapter.log.debug(shutterSettings[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[i].currentHeight + ' AND currentHeight:' + shutterSettings[i].currentHeight + ' == heightUp:' + shutterSettings[i].heightUp);
                                                                                    //if (parseFloat(state.val) > parseFloat(shutterSettings[i].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight == shutterSettings[i].heightUp) {
                                                                                    if (((parseFloat(state.val) > parseFloat(shutterSettings[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight == shutterSettings[i].heightUp) {
                                                                                        shutterSettings[i].currentAction = 'sunProtect';
                                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                                        adapter.log.debug('Sunprotect for ' + shutterSettings[i].shutterName + ' is active');
                                                                                        adapter.log.debug('Temperature inside: ' + insideTemp + ' > ' + shutterSettings[i].tempInside + ' AND ( Temperatur outside: ' + outsideTemp + ' > ' + shutterSettings[i].tempOutside + ' AND Light: ' + sunLight + ' > ' + shutterSettings[i].valueLight + ' )');
                                                                                        adapter.log.debug('Sunprotect ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterSettings[i].heightDownSun + '%');
                                                                                        adapter.log.info('Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDownSun + '%');

                                                                                        adapter.setForeignState(shutterSettings[i].name, parseFloat(shutterSettings[i].heightDownSun), false);
                                                                                        shutterSettings[i].currentHeight = shutterSettings[i].heightDownSun;
                                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                                                        adapter.log.debug('Sunprotect ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterSettings[i].heightDownSun + '%')
                                                                                        shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                                                        return (shutterSettings);
                                                                                    }
                                                                                    // Shutter closed. Set currentAction = sunProtect when sunProtect starts => 
                                                                                    // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                                    else if (parseFloat(state.val) == parseFloat(shutterSettings[i].heightDown) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight != shutterSettings[i].heightUp && shutterSettings[i].currentAction != 'down' && shutterSettings[i].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                                        shutterSettings[i].currentAction = 'OpenInSunProtect';
                                                                                        adapter.log.debug('Set sunprotect mode for ' + shutterSettings[i].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                                        return (shutterSettings);
                                                                                    }
                                                                                    // Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set -> 
                                                                                    // set sunProtect again
                                                                                    else if (parseFloat(state.val) == parseFloat(shutterSettings[i].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight != shutterSettings[i].heightUp && shutterSettings[i].currentHeight != shutterSettings[i].heightDown && shutterSettings[i].currentAction == '') {
                                                                                        adapter.log.debug(shutterSettings[i].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + shutterSettings[i].heightDownSun);
                                                                                        shutterSettings[i].currentAction = 'sunProtect';
                                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                                        return (shutterSettings);
                                                                                    }
                                                                                }
                                                                            });
                                                                        }
                                                                    }
                                                                }
                                                                if (currentValue != mustValue && shutterSettings[i].autoDrive == 'onlyUp' && shutterSettings[i].driveAfterClose == true) {
                                                                    if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth && insideTemp > shutterSettings[i].tempInside) {
                                                                        if (shutterSettings[i].tempOutside < outsideTemp && (shutterSettings[i].lightSensor != '' && shutterSettings[i].valueLight < sunLight || shutterSettings[i].lightSensor == '') && shutterSettings[i].triggerAction != 'sunProtect' && shutterSettings[i].triggerAction != 'OpenInSunProtect' && shutterSettings[i].triggerAction != 'Manu_Mode') {
                                                                            /**
                                                                             * @param {any} err
                                                                             * @param {{ val: string; }} state
                                                                             */
                                                                            adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                                                if (typeof state != undefined && state != null) {
                                                                                    adapter.log.debug(shutterSettings[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[i].currentHeight + ' AND currentHeight:' + shutterSettings[i].currentHeight + ' == heightUp:' + shutterSettings[i].heightUp + ' AND triggerAction:' + shutterSettings[i].triggerAction + ' != down ');
                                                                                    if (((parseFloat(state.val) > parseFloat(shutterSettings[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight == shutterSettings[i].heightUp && shutterSettings[i].triggerAction != 'down') {
                                                                                        adapter.log.info(' Will sunprotect ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                                        shutterSettings[i].triggerHeight = parseFloat(shutterSettings[i].heightDownSun);
                                                                                        adapter.log.debug('save new trigger height: ' + shutterSettings[i].heightDownSun + '%');
                                                                                        shutterSettings[i].triggerAction = 'sunProtect';
                                                                                        adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
                                                                                        return (shutterSettings);
                                                                                    }

                                                                                }
                                                                            });
                                                                        }
                                                                    }
                                                                }
                                                                if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyDown') || (shutterSettings[i].triggerID == '')) {
                                                                    let hysteresisOutside = (((100 - shutterSettings[i].hysteresisOutside) / 100) * shutterSettings[i].tempOutside).toFixed(2);
                                                                    let hysteresisInside = (((100 - shutterSettings[i].hysteresisInside) / 100) * shutterSettings[i].tempInside).toFixed(2);
                                                                    let hysteresisLight = (((100 - shutterSettings[i].hysteresisLight) / 100) * shutterSettings[i].valueLight).toFixed(2);

                                                                    if (insideTemp < parseFloat(hysteresisInside) || (resultDirectionRangePlus) < azimuth || (parseFloat(hysteresisOutside) > outsideTemp || shutterSettings[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && shutterSettings[i].lightSensor == '')) {
                                                                        /**
                                                                         * @param {any} err
                                                                         * @param {{ val: string; }} state
                                                                         */
                                                                        adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                if (shutterSettings[i].currentAction == 'sunProtect' && shutterSettings[i].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(shutterSettings[i].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight))) {
                                                                                    shutterSettings[i].currentAction = 'up';
                                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                                    adapter.log.debug('Sunprotect for ' + shutterSettings[i].shutterName + ' is not active');
                                                                                    adapter.log.debug('Range: ' + resultDirectionRangePlus + ' < ' + azimuth + ' OR Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ')');
                                                                                    adapter.log.debug('Sunprotect ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterSettings[i].heightUp + '%');
                                                                                    adapter.log.info('Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightUp + '%');

                                                                                    adapter.setForeignState(shutterSettings[i].name, parseFloat(shutterSettings[i].heightUp), false);
                                                                                    shutterSettings[i].currentHeight = shutterSettings[i].heightUp;
                                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                                                    adapter.log.debug('Sunprotect ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterSettings[i].heightUp + '%')
                                                                                    shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                                                    return (shutterSettings);
                                                                                }
                                                                                else if (shutterSettings[i].currentAction == 'OpenInSunProtect') {
                                                                                    shutterSettings[i].currentAction = 'none';
                                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                                    adapter.log.debug('OpenInSunProtect for ' + shutterSettings[i].shutterName + ' is not longer active');
                                                                                    return (shutterSettings);
                                                                                }
                                                                            }
                                                                        });
                                                                    }
                                                                }
                                                                if (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyDown' && shutterSettings[i].driveAfterClose == true) {
                                                                    let hysteresisOutside = (((100 - shutterSettings[i].hysteresisOutside) / 100) * shutterSettings[i].tempOutside).toFixed(2);
                                                                    let hysteresisInside = (((100 - shutterSettings[i].hysteresisInside) / 100) * shutterSettings[i].tempInside).toFixed(2);
                                                                    let hysteresisLight = (((100 - shutterSettings[i].hysteresisLight) / 100) * shutterSettings[i].valueLight).toFixed(2);

                                                                    if (insideTemp < parseFloat(hysteresisInside) || (resultDirectionRangePlus) < azimuth || (parseFloat(hysteresisOutside) > outsideTemp || shutterSettings[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && shutterSettings[i].lightSensor == '')) {

                                                                        /**
                                                                         * @param {any} err
                                                                         * @param {{ val: any; }} state
                                                                         */
                                                                        adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                if (shutterSettings[i].triggerAction == 'sunProtect' && shutterSettings[i].KeepSunProtect === false && (parseFloat(shutterSettings[i].triggerHeight) == parseFloat(shutterSettings[i].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight))) {
                                                                                    adapter.log.debug('Sunprotect for ' + shutterSettings[i].shutterName + ' is not active anymore');
                                                                                    adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                                    adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                                    shutterSettings[i].triggerHeight = parseFloat(shutterSettings[i].heightUp);
                                                                                    adapter.log.debug('save new trigger height: ' + shutterSettings[i].triggerHeight + '%');
                                                                                    shutterSettings[i].triggerAction = 'up';
                                                                                    adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
                                                                                    return (shutterSettings);
                                                                                }
                                                                                else if (shutterSettings[i].currentAction == 'OpenInSunProtect') {
                                                                                    shutterSettings[i].triggerAction = 'none';
                                                                                    adapter.log.debug('OpenInSunProtect for ' + shutterSettings[i].shutterName + ' is not longer active');
                                                                                    return (shutterSettings);
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
                                    resultDirectionRangeMinus = parseInt(shutterSettings[i].direction) - parseInt(shutterSettings[i].directionRange);
                                    resultDirectionRangePlus = parseInt(shutterSettings[i].direction) + parseInt(shutterSettings[i].directionRange);

                                    setTimeout(function () {
                                        let currentValue = '';
                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(shutterSettings[i].triggerID, (err, state) => {
                                            let mustValue = ('' + shutterSettings[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[i].autoDrive != 'off') || (shutterSettings[i].triggerID == '')) {
                                                /** @type {number} */
                                                let outsideTemp;
                                                /** @type {number} */
                                                let sunLight;

                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[i].outsideTempSensor, (err, state) => {
                                                    if (typeof state != undefined && state != null) {
                                                        outsideTemp = parseFloat(state.val);
                                                    }

                                                    /**
                                                     * @param {any} err
                                                     * @param {{ val: string; }} state
                                                     */
                                                    adapter.getForeignState(shutterSettings[i].lightSensor, (err, state) => {
                                                        if (typeof state != undefined && state != null) {
                                                            sunLight = parseFloat(state.val);
                                                        }
                                                        if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyUp') || (shutterSettings[i].triggerID == '')) {
                                                            if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth) {
                                                                if (shutterSettings[i].tempOutside < outsideTemp && (shutterSettings[i].lightSensor != '' && shutterSettings[i].valueLight < sunLight || shutterSettings[i].lightSensor == '') && shutterSettings[i].currentAction != 'sunProtect' && shutterSettings[i].currentAction != 'OpenInSunProtect' && shutterSettings[i].currentAction != 'Manu_Mode') {
                                                                    /**
                                                                     * @param {any} err
                                                                     * @param {{ val: string; }} state
                                                                     */
                                                                    adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                                        if (typeof state != undefined && state != null) {
                                                                            adapter.log.debug(shutterSettings[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[i].currentHeight + ' AND currentHeight:' + shutterSettings[i].currentHeight + ' == heightUp:' + shutterSettings[i].heightUp);
                                                                            //if (parseFloat(state.val) > parseFloat(shutterSettings[i].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight == shutterSettings[i].heightUp) {
                                                                            if (((parseFloat(state.val) > parseFloat(shutterSettings[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight == shutterSettings[i].heightUp) {
                                                                                shutterSettings[i].currentAction = 'sunProtect';
                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                                adapter.log.debug('Sunprotect for ' + shutterSettings[i].shutterName + ' is active');
                                                                                adapter.log.debug('Temperatur outside: ' + outsideTemp + ' > ' + shutterSettings[i].tempOutside + ' AND Light: ' + sunLight + ' > ' + shutterSettings[i].valueLight);
                                                                                adapter.log.info('Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDownSun + '%')

                                                                                adapter.setForeignState(shutterSettings[i].name, parseFloat(shutterSettings[i].heightDownSun), false);
                                                                                shutterSettings[i].currentHeight = shutterSettings[i].heightDownSun;
                                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                                                adapter.log.debug('Sunprotect ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterSettings[i].heightDownSun + '%')
                                                                                shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                                                return (shutterSettings);
                                                                            }
                                                                            // Shutter closed. Set currentAction = sunProtect when sunProtect starts => 
                                                                            // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                            else if (parseFloat(state.val) == parseFloat(shutterSettings[i].heightDown) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight != shutterSettings[i].heightUp && shutterSettings[i].currentAction != 'down' && shutterSettings[i].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                                shutterSettings[i].currentAction = 'OpenInSunProtect';
                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                                adapter.log.debug('Set sunprotect mode for ' + shutterSettings[i].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                                return (shutterSettings);
                                                                            }
                                                                            // Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set ->
                                                                            // set sunProtect again
                                                                            else if (parseFloat(state.val) == parseFloat(shutterSettings[i].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight != shutterSettings[i].heightUp && shutterSettings[i].currentHeight != shutterSettings[i].heightDown && shutterSettings[i].currentAction == '') {
                                                                                adapter.log.debug(shutterSettings[i].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + shutterSettings[i].heightDownSun);
                                                                                shutterSettings[i].currentAction = 'sunProtect';
                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                                return (shutterSettings);
                                                                            }
                                                                        }
                                                                    });
                                                                }
                                                            }
                                                        }
                                                        if (currentValue != mustValue && shutterSettings[i].autoDrive == 'onlyUp' && shutterSettings[i].driveAfterClose == true) {
                                                            if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth) {
                                                                if (shutterSettings[i].tempOutside < outsideTemp && (shutterSettings[i].lightSensor != '' && shutterSettings[i].valueLight < sunLight || shutterSettings[i].lightSensor == '') && shutterSettings[i].triggerAction != 'sunProtect' && shutterSettings[i].triggerAction != 'OpenInSunProtect' && shutterSettings[i].triggerAction != 'Manu_Mode') {
                                                                    /**
                                                                     * @param {any} err
                                                                     * @param {{ val: string; }} state
                                                                     */
                                                                    adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                                        if (typeof state != undefined && state != null) {
                                                                            adapter.log.debug(shutterSettings[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[i].currentHeight + ' AND currentHeight:' + shutterSettings[i].currentHeight + ' == heightUp:' + shutterSettings[i].heightUp);
                                                                            if (((parseFloat(state.val) > parseFloat(shutterSettings[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight == shutterSettings[i].heightUp && shutterSettings[i].triggerAction != 'down') {
                                                                                adapter.log.info(' Will sunprotect ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                                shutterSettings[i].triggerHeight = parseFloat(shutterSettings[i].heightDownSun);
                                                                                adapter.log.debug('save new trigger height: ' + shutterSettings[i].heightDownSun + '%');
                                                                                shutterSettings[i].triggerAction = 'sunProtect';
                                                                                adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
                                                                                return (shutterSettings);
                                                                            }

                                                                        }
                                                                    });
                                                                }
                                                            }
                                                        }
                                                        if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyDown') || (shutterSettings[i].triggerID == '')) {
                                                            const hysteresisOutside = (((100 - shutterSettings[i].hysteresisOutside) / 100) * shutterSettings[i].tempOutside).toFixed(2);
                                                            const hysteresisLight = (((100 - shutterSettings[i].hysteresisLight) / 100) * shutterSettings[i].valueLight).toFixed(2);

                                                            if ((resultDirectionRangePlus) < azimuth || (parseFloat(hysteresisOutside) > outsideTemp || shutterSettings[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && shutterSettings[i].lightSensor == '')) {

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        if (shutterSettings[i].currentAction == 'sunProtect' && shutterSettings[i].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(shutterSettings[i].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight))) {
                                                                            shutterSettings[i].currentAction = 'up';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[i].shutterName + ' is not active');
                                                                            adapter.log.debug('Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight);
                                                                            adapter.log.info('Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightUp + '%')
                                                                            adapter.setForeignState(shutterSettings[i].name, parseFloat(shutterSettings[i].heightUp), false);
                                                                            shutterSettings[i].currentHeight = shutterSettings[i].heightUp;
                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                                            adapter.log.debug('Sunprotect ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterSettings[i].heightUp + '%')
                                                                            shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                                            return (shutterSettings);
                                                                        }
                                                                        else if (shutterSettings[i].currentAction == 'OpenInSunProtect') {
                                                                            shutterSettings[i].currentAction = 'none';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[i].shutterName + ' is not longer active');
                                                                            return (shutterSettings);
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                        if (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyDown' && shutterSettings[i].driveAfterClose == true) {
                                                            const hysteresisOutside = (((100 - shutterSettings[i].hysteresisOutside) / 100) * shutterSettings[i].tempOutside).toFixed(2);
                                                            const hysteresisLight = (((100 - shutterSettings[i].hysteresisLight) / 100) * shutterSettings[i].valueLight).toFixed(2);

                                                            if ((resultDirectionRangePlus) < azimuth || (parseFloat(hysteresisOutside) > outsideTemp || shutterSettings[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && shutterSettings[i].lightSensor == '')) {

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: any; }} state
                                                                 */
                                                                adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        if (shutterSettings[i].triggerAction == 'sunProtect' && shutterSettings[i].KeepSunProtect === false && (parseFloat(shutterSettings[i].triggerHeight) == parseFloat(shutterSettings[i].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight))) {
                                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[i].shutterName + ' is not active anymore');
                                                                            adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                            adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                            shutterSettings[i].triggerHeight = parseFloat(shutterSettings[i].heightUp);
                                                                            adapter.log.debug('save new trigger height: ' + shutterSettings[i].triggerHeight + '%');
                                                                            shutterSettings[i].triggerAction = 'up';
                                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
                                                                            return (shutterSettings);
                                                                        }
                                                                        else if (shutterSettings[i].currentAction == 'OpenInSunProtect') {
                                                                            shutterSettings[i].triggerAction = 'none';
                                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[i].shutterName + ' is not longer active');
                                                                            return (shutterSettings);
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
                                    resultDirectionRangeMinus = parseInt(shutterSettings[i].direction) - parseInt(shutterSettings[i].directionRange);
                                    resultDirectionRangePlus = parseInt(shutterSettings[i].direction) + parseInt(shutterSettings[i].directionRange);
                                    setTimeout(function () {
                                        let currentValue = '';
                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(shutterSettings[i].triggerID, (err, state) => {
                                            let mustValue = ('' + shutterSettings[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[i].autoDrive != 'off') || (shutterSettings[i].triggerID == '')) {
                                                if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyUp') || (shutterSettings[i].triggerID == '')) {
                                                    if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth && shutterSettings[i].currentAction != 'sunProtect' && shutterSettings[i].currentAction != 'OpenInSunProtect' && shutterSettings[i].currentAction != 'Manu_Mode') {

                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: string; }} state
                                                         */
                                                        adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                adapter.log.debug(shutterSettings[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[i].currentHeight + ' AND currentHeight:' + shutterSettings[i].currentHeight + ' == heightUp:' + shutterSettings[i].heightUp);
                                                                if (((parseFloat(state.val) > parseFloat(shutterSettings[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight == shutterSettings[i].heightUp) {
                                                                    shutterSettings[i].currentAction = 'sunProtect';
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                    adapter.log.debug('Sunprotect for ' + shutterSettings[i].shutterName + ' is active');
                                                                    adapter.log.debug('RangeMinus: ' + resultDirectionRangeMinus + ' < ' + azimuth + 'RangePlus: ' + resultDirectionRangePlus + ' > ' + azimuth);
                                                                    adapter.log.info('Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDownSun + '%')

                                                                    adapter.setForeignState(shutterSettings[i].name, parseFloat(shutterSettings[i].heightDownSun), false);
                                                                    shutterSettings[i].currentHeight = shutterSettings[i].heightDownSun;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                                    adapter.log.debug('Sunprotect ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterSettings[i].heightDownSun + '%')
                                                                    shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                                // Shutter closed. Set currentAction = sunProtect when sunProtect starts => 
                                                                // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                else if (parseFloat(state.val) == parseFloat(shutterSettings[i].heightDown) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight != shutterSettings[i].heightUp && shutterSettings[i].currentAction != 'down' && shutterSettings[i].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                    shutterSettings[i].currentAction = 'OpenInSunProtect';
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                    adapter.log.debug('Set sunprotect mode for ' + shutterSettings[i].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                    return (shutterSettings);
                                                                }
                                                                // Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set ->
                                                                // set sunProtect again
                                                                else if (parseFloat(state.val) == parseFloat(shutterSettings[i].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight != shutterSettings[i].heightUp && shutterSettings[i].currentHeight != shutterSettings[i].heightDown && shutterSettings[i].currentAction == '') {
                                                                    adapter.log.debug(shutterSettings[i].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + shutterSettings[i].heightDownSun);
                                                                    shutterSettings[i].currentAction = 'sunProtect';
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                    return (shutterSettings);
                                                                }
                                                            }
                                                        });
                                                    }
                                                }
                                                if (currentValue != mustValue && shutterSettings[i].autoDrive == 'onlyUp' && shutterSettings[i].driveAfterClose == true) {
                                                    if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth && shutterSettings[i].triggerAction != 'sunProtect' && shutterSettings[i].triggerAction != 'OpenInSunProtect' && shutterSettings[i].triggerAction != 'Manu_Mode') {
                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: string; }} state
                                                         */
                                                        adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                adapter.log.debug(shutterSettings[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[i].currentHeight + ' AND currentHeight:' + shutterSettings[i].currentHeight + ' == heightUp:' + shutterSettings[i].heightUp);
                                                                if (((parseFloat(state.val) > parseFloat(shutterSettings[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight == shutterSettings[i].heightUp && shutterSettings[i].triggerAction != 'down') {
                                                                    adapter.log.info(' Will sunprotect ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                    shutterSettings[i].triggerHeight = parseFloat(shutterSettings[i].heightDownSun);
                                                                    adapter.log.debug('save new trigger height: ' + shutterSettings[i].heightDownSun + '%');
                                                                    shutterSettings[i].triggerAction = 'sunProtect';
                                                                    adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
                                                                    return (shutterSettings);
                                                                }
                                                            }
                                                        });

                                                    }
                                                }
                                                if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyDown') || (shutterSettings[i].triggerID == '')) {
                                                    if ((resultDirectionRangePlus) < azimuth) {
                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: string; }} state
                                                         */
                                                        adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                if (shutterSettings[i].currentAction == 'sunProtect' && shutterSettings[i].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(shutterSettings[i].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight))) {
                                                                    shutterSettings[i].currentAction = 'up';
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                    adapter.log.debug('Sunprotect for ' + shutterSettings[i].shutterName + ' is not active');
                                                                    adapter.log.debug('Range: ' + resultDirectionRangePlus + ' < ' + azimuth);
                                                                    adapter.log.info('Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightUp + '%')
                                                                    adapter.setForeignState(shutterSettings[i].name, parseFloat(shutterSettings[i].heightUp), false);
                                                                    shutterSettings[i].currentHeight = shutterSettings[i].heightUp;
                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                                    adapter.log.debug('Sunprotect ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterSettings[i].heightUp + '%')
                                                                    shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                                    return (shutterSettings);
                                                                }
                                                                else if (shutterSettings[i].currentAction == 'OpenInSunProtect') {
                                                                    shutterSettings[i].currentAction = 'none';
                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                    adapter.log.debug('OpenInSunProtect for ' + shutterSettings[i].shutterName + ' is not longer active');
                                                                    return (shutterSettings);
                                                                }
                                                            }
                                                        });
                                                    }
                                                }
                                                if (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyDown' && shutterSettings[i].driveAfterClose == true) {
                                                    if ((resultDirectionRangePlus) < azimuth) {
                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: any; }} state
                                                         */
                                                        adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                if (shutterSettings[i].triggerAction == 'sunProtect' && shutterSettings[i].KeepSunProtect === false && (parseFloat(shutterSettings[i].triggerHeight) == parseFloat(shutterSettings[i].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight))) {
                                                                    adapter.log.debug('Sunprotect for ' + shutterSettings[i].shutterName + ' is not active anymore');
                                                                    adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                    adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                    shutterSettings[i].triggerHeight = parseFloat(shutterSettings[i].heightUp);
                                                                    adapter.log.debug('save new trigger height: ' + shutterSettings[i].triggerHeight + '%');
                                                                    shutterSettings[i].triggerAction = 'up';
                                                                    adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
                                                                    return (shutterSettings);
                                                                }
                                                                else if (shutterSettings[i].currentAction == 'OpenInSunProtect') {
                                                                    shutterSettings[i].triggerAction = 'none';
                                                                    adapter.log.debug('OpenInSunProtect for ' + shutterSettings[i].shutterName + ' is not longer active');
                                                                    return (shutterSettings);
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
                                        adapter.getForeignState(shutterSettings[i].triggerID, (err, state) => {
                                            let mustValue = ('' + shutterSettings[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[i].autoDrive != 'off') || (shutterSettings[i].triggerID == '')) {
                                                /** @type {number} */
                                                let outsideTemp;
                                                /** @type {number} */
                                                let sunLight;

                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[i].outsideTempSensor, (err, state) => {
                                                    if (typeof state != undefined && state != null) {
                                                        outsideTemp = parseFloat(state.val);
                                                    }

                                                    /**
                                                     * @param {any} err
                                                     * @param {{ val: string; }} state
                                                     */
                                                    adapter.getForeignState(shutterSettings[i].lightSensor, (err, state) => {
                                                        if (typeof state != undefined && state != null) {
                                                            sunLight = parseFloat(state.val);
                                                        }
                                                        if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyUp') || (shutterSettings[i].triggerID == '')) {
                                                            if (shutterSettings[i].tempOutside < outsideTemp && (shutterSettings[i].lightSensor != '' && shutterSettings[i].valueLight < sunLight || shutterSettings[i].lightSensor == '') && shutterSettings[i].currentAction != 'sunProtect' && shutterSettings[i].currentAction != 'OpenInSunProtect' && shutterSettings[i].currentAction != 'Manu_Mode') {
                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        adapter.log.debug(shutterSettings[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[i].currentHeight + ' AND currentHeight:' + shutterSettings[i].currentHeight + ' == heightUp:' + shutterSettings[i].heightUp);
                                                                        //if (parseFloat(state.val) > parseFloat(shutterSettings[i].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight == shutterSettings[i].heightUp) {
                                                                        if (((parseFloat(state.val) > parseFloat(shutterSettings[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight == shutterSettings[i].heightUp) {
                                                                            shutterSettings[i].currentAction = 'sunProtect';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[i].shutterName + ' is active');
                                                                            adapter.log.debug('Temperature outside: ' + outsideTemp + ' > ' + shutterSettings[i].tempOutside + ' AND Light: ' + sunLight + ' > ' + shutterSettings[i].valueLight);
                                                                            adapter.log.info('Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDownSun + '%')

                                                                            adapter.setForeignState(shutterSettings[i].name, parseFloat(shutterSettings[i].heightDownSun), false);
                                                                            shutterSettings[i].currentHeight = shutterSettings[i].heightDownSun;
                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                                            adapter.log.debug('Sunprotect ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterSettings[i].heightDownSun + '%')
                                                                            shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                                            return (shutterSettings);
                                                                        }
                                                                        // Shutter closed. Set currentAction = sunProtect when sunProtect starts =>
                                                                        // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                        else if (parseFloat(state.val) == parseFloat(shutterSettings[i].heightDown) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight != shutterSettings[i].heightUp && shutterSettings[i].currentAction != 'down' && shutterSettings[i].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                            shutterSettings[i].currentAction = 'OpenInSunProtect';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                            adapter.log.debug('Set sunprotect mode for ' + shutterSettings[i].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                            return (shutterSettings);
                                                                        }
                                                                        // Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set ->
                                                                        // set sunProtect again
                                                                        else if (parseFloat(state.val) == parseFloat(shutterSettings[i].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight != shutterSettings[i].heightUp && shutterSettings[i].currentHeight != shutterSettings[i].heightDown && shutterSettings[i].currentAction == '') {
                                                                            adapter.log.debug(shutterSettings[i].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + shutterSettings[i].heightDownSun);
                                                                            shutterSettings[i].currentAction = 'sunProtect';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                            return (shutterSettings);
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                        if (currentValue != mustValue && shutterSettings[i].autoDrive == 'onlyUp' && shutterSettings[i].driveAfterClose == true) {
                                                            if (shutterSettings[i].tempOutside < outsideTemp && (shutterSettings[i].lightSensor != '' && shutterSettings[i].valueLight < sunLight || shutterSettings[i].lightSensor == '') && shutterSettings[i].triggerAction != 'sunProtect' && shutterSettings[i].triggerAction != 'OpenInSunProtect' && shutterSettings[i].triggerAction != 'Manu_Mode') {
                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        adapter.log.debug(shutterSettings[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[i].currentHeight + ' AND currentHeight:' + shutterSettings[i].currentHeight + ' == heightUp:' + shutterSettings[i].heightUp);
                                                                        if (((parseFloat(state.val) > parseFloat(shutterSettings[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight == shutterSettings[i].heightUp && shutterSettings[i].triggerAction != 'down') {
                                                                            adapter.log.info(' Will sunprotect ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                            shutterSettings[i].triggerHeight = parseFloat(shutterSettings[i].heightDownSun);
                                                                            adapter.log.debug('save new trigger height: ' + shutterSettings[i].heightDownSun + '%');
                                                                            shutterSettings[i].triggerAction = 'sunProtect';
                                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
                                                                            return (shutterSettings);
                                                                        }
                                                                    }
                                                                });

                                                            }
                                                        }
                                                        if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyDown') || (shutterSettings[i].triggerID == '')) {

                                                            let hysteresisOutside = (((100 - shutterSettings[i].hysteresisOutside) / 100) * shutterSettings[i].tempOutside).toFixed(2);
                                                            let hysteresisLight = (((100 - shutterSettings[i].hysteresisLight) / 100) * shutterSettings[i].valueLight).toFixed(2);

                                                            if ((shutterSettings[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp)) {

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        if (shutterSettings[i].currentAction == 'sunProtect' && shutterSettings[i].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(shutterSettings[i].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight))) {
                                                                            shutterSettings[i].currentAction = 'up';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[i].shutterName + ' is not active');
                                                                            adapter.log.debug('Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight);
                                                                            adapter.log.info('Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightUp + '%')

                                                                            adapter.setForeignState(shutterSettings[i].name, parseFloat(shutterSettings[i].heightUp), false);
                                                                            shutterSettings[i].currentHeight = shutterSettings[i].heightUp;
                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                                            adapter.log.debug('Sunprotect ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterSettings[i].heightUp + '%')
                                                                            shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                                            return (shutterSettings);
                                                                        }
                                                                        else if (shutterSettings[i].currentAction == 'OpenInSunProtect') {
                                                                            shutterSettings[i].currentAction = 'none';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[i].shutterName + ' is not longer active');
                                                                            return (shutterSettings);
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                        if (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyDown' && shutterSettings[i].driveAfterClose == true) {

                                                            let hysteresisOutside = (((100 - shutterSettings[i].hysteresisOutside) / 100) * shutterSettings[i].tempOutside).toFixed(2);
                                                            let hysteresisLight = (((100 - shutterSettings[i].hysteresisLight) / 100) * shutterSettings[i].valueLight).toFixed(2);

                                                            if ((shutterSettings[i].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp)) {

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: any; }} state
                                                                 */
                                                                adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        if (shutterSettings[i].triggerAction == 'sunProtect' && shutterSettings[i].KeepSunProtect === false && (parseFloat(shutterSettings[i].triggerHeight) == parseFloat(shutterSettings[i].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight))) {
                                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[i].shutterName + ' is not active anymore');
                                                                            adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                            adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                            shutterSettings[i].triggerHeight = parseFloat(shutterSettings[i].heightUp);
                                                                            adapter.log.debug('save new trigger height: ' + shutterSettings[i].triggerHeight + '%');
                                                                            shutterSettings[i].triggerAction = 'up';
                                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
                                                                            return (shutterSettings);
                                                                        }
                                                                        else if (shutterSettings[i].currentAction == 'OpenInSunProtect') {
                                                                            shutterSettings[i].triggerAction = 'none';
                                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[i].shutterName + ' is not longer active');
                                                                            return (shutterSettings);
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
                                        adapter.getForeignState(shutterSettings[i].triggerID, (err, state) => {
                                            let mustValue = ('' + shutterSettings[i].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue && shutterSettings[i].tempSensor != '' || (currentValue != mustValue && shutterSettings[i].autoDrive != 'off' && shutterSettings[i].tempSensor != '') || (shutterSettings[i].triggerID == '' && shutterSettings[i].tempSensor != '')) {
                                                /** @type {string | number} */
                                                let insideTemp;
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[i].tempSensor, (err, state) => {
                                                    if (typeof state != undefined && state != null) {
                                                        insideTemp = parseFloat(state.val);

                                                        if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyUp') || (shutterSettings[i].triggerID == '')) {
                                                            if (insideTemp > shutterSettings[i].tempInside && shutterSettings[i].currentAction != 'sunProtect' && shutterSettings[i].currentAction != 'OpenInSunProtect' && shutterSettings[i].currentAction != 'Manu_Mode') {

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        //if (parseFloat(state.val) > parseFloat(shutterSettings[i].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight == shutterSettings[i].heightUp) {
                                                                        if (((parseFloat(state.val) > parseFloat(shutterSettings[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight == shutterSettings[i].heightUp) {
                                                                            shutterSettings[i].currentAction = 'sunProtect';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[i].shutterName + ' is active');
                                                                            adapter.log.info('#40 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDownSun + '%');
                                                                            adapter.setForeignState(shutterSettings[i].name, parseFloat(shutterSettings[i].heightDownSun), false);
                                                                            shutterSettings[i].currentHeight = shutterSettings[i].heightDownSun;
                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                                            adapter.log.debug('Sunprotect ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterSettings[i].heightDownSun + '%')
                                                                            shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                                            return (shutterSettings);
                                                                        }
                                                                        // Shutter closed. Set currentAction = sunProtect when sunProtect starts =>
                                                                        // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                        else if (parseFloat(state.val) == parseFloat(shutterSettings[i].heightDown) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight != shutterSettings[i].heightUp && shutterSettings[i].currentAction != 'down' && shutterSettings[i].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                            shutterSettings[i].currentAction = 'OpenInSunProtect';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                            adapter.log.debug('Set sunprotect mode for ' + shutterSettings[i].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                            return (shutterSettings);
                                                                        }
                                                                        // Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set ->
                                                                        // set sunProtect again
                                                                        else if (parseFloat(state.val) == parseFloat(shutterSettings[i].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight != shutterSettings[i].heightUp && shutterSettings[i].currentHeight != shutterSettings[i].heightDown && shutterSettings[i].currentAction == '') {
                                                                            adapter.log.debug(shutterSettings[i].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + shutterSettings[i].heightDownSun);
                                                                            shutterSettings[i].currentAction = 'sunProtect';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                            return (shutterSettings);
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                        if (currentValue != mustValue && shutterSettings[i].autoDrive == 'onlyUp' && shutterSettings[i].driveAfterClose == true) {
                                                            if (insideTemp > shutterSettings[i].tempInside && shutterSettings[i].triggerAction != 'sunProtect' && shutterSettings[i].triggerAction != 'OpenInSunProtect' && shutterSettings[i].triggerAction != 'Manu_Mode') {
                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        adapter.log.debug(shutterSettings[i].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[i].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[i].currentHeight + ' AND currentHeight:' + shutterSettings[i].currentHeight + ' == heightUp:' + shutterSettings[i].heightUp);
                                                                        if (((parseFloat(state.val) > parseFloat(shutterSettings[i].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[i].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight) && shutterSettings[i].currentHeight == shutterSettings[i].heightUp && shutterSettings[i].triggerAction != 'down') {
                                                                            adapter.log.info(' Will sunprotect ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                            shutterSettings[i].triggerHeight = parseFloat(shutterSettings[i].heightDownSun);
                                                                            adapter.log.debug('save new trigger height: ' + shutterSettings[i].heightDownSun + '%');
                                                                            shutterSettings[i].triggerAction = 'sunProtect';
                                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
                                                                            return (shutterSettings);
                                                                        }
                                                                    }
                                                                });

                                                            }
                                                        }
                                                        if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyDown') || (shutterSettings[i].triggerID == '')) {
                                                            let hysteresisInside = (((100 - shutterSettings[i].hysteresisInside) / 100) * shutterSettings[i].tempInside).toFixed(2);

                                                            if (insideTemp < parseFloat(hysteresisInside)) {

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        if (shutterSettings[i].currentAction == 'sunProtect' && shutterSettings[i].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(shutterSettings[i].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight))) {
                                                                            shutterSettings[i].currentAction = 'up';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[i].shutterName + ' is not active');
                                                                            adapter.log.info('#41 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightUp + '%');
                                                                            adapter.setForeignState(shutterSettings[i].name, parseFloat(shutterSettings[i].heightUp), false);
                                                                            shutterSettings[i].currentHeight = shutterSettings[i].heightUp;
                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                                            adapter.log.debug('Sunprotect ' + shutterSettings[i].shutterName + ' old height: ' + shutterSettings[i].oldHeight + '% new height: ' + shutterSettings[i].heightUp + '%')
                                                                            shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                                            return (shutterSettings);
                                                                        }
                                                                        else if (shutterSettings[i].currentAction == 'OpenInSunProtect') {
                                                                            shutterSettings[i].currentAction = 'none';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[i].shutterName + ' is not longer active');
                                                                            return (shutterSettings);
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                        if (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyDown' && shutterSettings[i].driveAfterClose == true) {
                                                            let hysteresisInside = (((100 - shutterSettings[i].hysteresisInside) / 100) * shutterSettings[i].tempInside).toFixed(2);

                                                            if (insideTemp < parseFloat(hysteresisInside)) {

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: any; }} state
                                                                 */
                                                                adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        if (shutterSettings[i].triggerAction == 'sunProtect' && shutterSettings[i].KeepSunProtect === false && (parseFloat(shutterSettings[i].triggerHeight) == parseFloat(shutterSettings[i].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight))) {
                                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[i].shutterName + ' is not active anymore');
                                                                            adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                            adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDownSun + '%' + ' after the window has been closed ');
                                                                            shutterSettings[i].triggerHeight = parseFloat(shutterSettings[i].heightUp);
                                                                            adapter.log.debug('save new trigger height: ' + shutterSettings[i].triggerHeight + '%');
                                                                            shutterSettings[i].triggerAction = 'up';
                                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
                                                                            return (shutterSettings);
                                                                        }
                                                                        else if (shutterSettings[i].currentAction == 'OpenInSunProtect') {
                                                                            shutterSettings[i].triggerAction = 'none';
                                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[i].shutterName + ' is not longer active');
                                                                            return (shutterSettings);
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
        resultFull = shutterSettings;

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
                if (elevation <= sunProtEndStart && elevation >= sunProtEndStop && (shutterSettings[i].currentAction == 'sunProtect' || shutterSettings[i].currentAction == 'manu_sunProtect')) {
                    let nameDevice = shutterSettings[i].shutterName.replace(/[.;, ]/g, '_');

                    let convertShutter;

                    if (parseFloat(shutterSettings[i].heightDown) < parseFloat(shutterSettings[i].heightUp)) {
                        convertShutter = false;
                        adapter.log.debug(shutterSettings[i].shutterName + ' level conversion is disabled ...');
                    } else if (parseFloat(shutterSettings[i].heightDown) > parseFloat(shutterSettings[i].heightUp)) {
                        convertShutter = true;
                        adapter.log.debug(shutterSettings[i].shutterName + ' level conversion is enabled');
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
                                adapter.getForeignState(shutterSettings[i].triggerID, (err, state) => {
                                    let mustValue = ('' + shutterSettings[i].triggerState);
                                    if (typeof state != undefined && state != null) {
                                        currentValue = ('' + state.val);
                                    }
                                    if (currentValue === mustValue && shutterSettings[i].tempSensor != '' || (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyDown' && shutterSettings[i].autoDrive != 'off') || (shutterSettings[i].triggerID == '')) {

                                        /**
                                         * @param {any} err
                                         * @param {{ val: string; }} state
                                         */
                                        adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null) {
                                                if ((shutterSettings[i].currentAction == 'sunProtect' || shutterSettings[i].currentAction == 'manu_sunProtect') && shutterSettings[i].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(shutterSettings[i].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight))) {
                                                    shutterSettings[i].currentAction = 'none';
                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[i].currentAction, ack: true });
                                                    adapter.log.debug('Sunprotect for ' + shutterSettings[i].shutterName + ' is completed');
                                                    adapter.log.info('#42 Set ID: ' + shutterSettings[i].shutterName + ' value: ' + parseFloat(shutterSettings[i].heightUp) + '%');
                                                    adapter.setForeignState(shutterSettings[i].name, parseFloat(shutterSettings[i].heightUp), false);
                                                    shutterSettings[i].currentHeight = shutterSettings[i].heightUp;
                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[i].currentHeight, ack: true });
                                                    adapter.log.debug('save current height: ' + shutterSettings[i].currentHeight + '%' + ' from ' + shutterSettings[i].shutterName);
                                                    shutterState(shutterSettings[i].name, adapter, shutterSettings);
                                                    return (shutterSettings);
                                                }
                                            }
                                        });
                                    }
                                    if (currentValue != mustValue && shutterSettings[i].autoDrive != 'onlyDown' && shutterSettings[i].driveAfterClose == true) {

                                        /**
                                        * @param {any} err
                                        * @param {{ val: any; }} state
                                        */
                                        adapter.getForeignState(shutterSettings[i].name, (err, state) => {
                                            if (typeof state != undefined && state != null) {
                                                if ((shutterSettings[i].triggerAction == 'sunProtect' || shutterSettings[i].triggerAction == 'manu_sunProtect') && shutterSettings[i].KeepSunProtect === false && (parseFloat(shutterSettings[i].triggerHeight) == parseFloat(shutterSettings[i].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[i].currentHeight))) {
                                                    adapter.log.debug('Sunprotect for ' + shutterSettings[i].shutterName + ' is not active anymore');
                                                    //adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                    adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[i].shutterName + ' value: ' + shutterSettings[i].heightDownSun + '%' + ' after the window has been closed ');
                                                    shutterSettings[i].triggerHeight = parseFloat(shutterSettings[i].heightUp);
                                                    adapter.log.debug('save new trigger height: ' + shutterSettings[i].triggerHeight + '%');
                                                    shutterSettings[i].triggerAction = 'up';
                                                    adapter.log.debug('save new trigger action: ' + shutterSettings[i].triggerAction);
                                                    return (shutterSettings);
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
