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
                    for (const s in shutterSettings) {
                        if (shutterSettings[s].shutterName == result[i].shutterName) {
                            let resultDirectionRangeMinus = 0;
                            let resultDirectionRangePlus = 0;

                            let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                            /** @type {boolean} */
                            let convertShutter;

                            if (parseFloat(shutterSettings[s].heightDown) < parseFloat(shutterSettings[s].heightUp)) {
                                convertShutter = false;
                                //adapter.log.debug(shutterSettings[s].shutterName + ' level conversion is disabled ...');
                            } else if (parseFloat(shutterSettings[s].heightDown) > parseFloat(shutterSettings[s].heightUp)) {
                                convertShutter = true;
                                //adapter.log.debug(shutterSettings[s].shutterName + ' level conversion is enabled');
                            }

                            /**
                             * @param {any} err
                             * @param {boolean} state
                             */
                            adapter.getState('shutters.autoSun.' + nameDevice, (err, state) => {
                                if (state && state === true || state && state.val === true) {

                                    switch (shutterSettings[s].type) {

                                        // +++++++++++++++++ sunprotect with in/outside temperature and Lightsensor +++++++++++++++

                                        case 'in- & outside temperature': // in- & outside temperature
                                            setTimeout(function () {
                                                let currentValue = '';
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {
                                                    let mustValue = ('' + shutterSettings[s].triggerState);
                                                    if (typeof state != undefined && state != null) {
                                                        currentValue = ('' + state.val);
                                                    }
                                                    if (currentValue === mustValue && shutterSettings[s].tempSensor != '' || (currentValue != mustValue && shutterSettings[s].autoDrive != 'off' && shutterSettings[s].tempSensor != '') || (shutterSettings[s].triggerID == '' && shutterSettings[s].tempSensor != '')) {
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
                                                        adapter.getForeignState(shutterSettings[s].tempSensor, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                insideTemp = parseFloat(state.val);

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(shutterSettings[s].outsideTempSensor, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        outsideTemp = parseFloat(state.val);
                                                                    }

                                                                    /**
                                                                     * @param {any} err
                                                                     * @param {{ val: string; }} state
                                                                     */
                                                                    adapter.getForeignState(shutterSettings[s].lightSensor, (err, state) => {
                                                                        if (typeof state != undefined && state != null) {
                                                                            sunLight = parseFloat(state.val);
                                                                        }

                                                                        if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyUp') || (shutterSettings[s].triggerID == '')) {
                                                                            if (insideTemp > shutterSettings[s].tempInside) {
                                                                                if (shutterSettings[s].tempOutside < outsideTemp && (shutterSettings[s].lightSensor != '' && shutterSettings[s].valueLight < sunLight || shutterSettings[s].lightSensor == '') && shutterSettings[s].currentAction != 'sunProtect' && shutterSettings[s].currentAction != 'OpenInSunProtect' && shutterSettings[s].currentAction != 'Manu_Mode') {
                                                                                    /**
                                                                                     * @param {any} err
                                                                                     * @param {{ val: string; }} state
                                                                                     */
                                                                                    adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                                        if (typeof state != undefined && state != null) {
                                                                                            adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[s].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp);
                                                                                            //if (parseFloat(state.val) > parseFloat(shutterSettings[s].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp) {
                                                                                            if (((parseFloat(state.val) > parseFloat(shutterSettings[s].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[s].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp) {
                                                                                                shutterSettings[s].currentAction = 'sunProtect';
                                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                                adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is active');
                                                                                                adapter.log.debug('Temperature inside: ' + insideTemp + ' > ' + shutterSettings[s].tempInside + ' AND ( Temperatur outside: ' + outsideTemp + ' > ' + shutterSettings[s].tempOutside + ' AND Light: ' + sunLight + ' > ' + shutterSettings[s].valueLight + ' )');
                                                                                                adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDownSun + '%')
                                                                                                adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].heightDownSun), false);
                                                                                                shutterSettings[s].currentHeight = shutterSettings[s].heightDownSun;
                                                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[s].currentHeight, ack: true });
                                                                                                adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightDownSun + '%');
                                                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                                return (shutterSettings);
                                                                                            }
                                                                                            // Shutter closed. Set currentAction = sunProtect when sunProtect starts => 
                                                                                            // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                                            else if (parseFloat(state.val) == parseFloat(shutterSettings[s].heightDown) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentAction != 'down' && shutterSettings[s].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                                                shutterSettings[s].currentAction = 'OpenInSunProtect';
                                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                                adapter.log.debug('Set sunprotect mode for ' + shutterSettings[s].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                                                return (shutterSettings);
                                                                                            }
                                                                                            //Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set -> 
                                                                                            // set sunProtect again
                                                                                            else if (parseFloat(state.val) == parseFloat(shutterSettings[s].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentHeight != shutterSettings[s].heightDown && shutterSettings[s].currentAction == '') {
                                                                                                adapter.log.debug(shutterSettings[s].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + shutterSettings[s].heightDownSun);
                                                                                                shutterSettings[s].currentAction = 'sunProtect';
                                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                                return (shutterSettings);
                                                                                            }
                                                                                        }
                                                                                    });
                                                                                }
                                                                            }
                                                                        }
                                                                        if (currentValue != mustValue && shutterSettings[s].autoDrive == 'onlyUp' && shutterSettings[s].driveAfterClose == true) {
                                                                            if (insideTemp > shutterSettings[s].tempInside) {
                                                                                if (shutterSettings[s].tempOutside < outsideTemp && (shutterSettings[s].lightSensor != '' && shutterSettings[s].valueLight < sunLight || shutterSettings[s].lightSensor == '') && shutterSettings[s].triggerAction != 'sunProtect' && shutterSettings[s].triggerAction != 'OpenInSunProtect' && shutterSettings[s].triggerAction != 'Manu_Mode') {
                                                                                    /**
                                                                                     * @param {any} err
                                                                                     * @param {{ val: string; }} state
                                                                                     */
                                                                                    adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                                        if (typeof state != undefined && state != null) {
                                                                                            adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[s].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp + ' AND triggerAction:' + shutterSettings[s].triggerAction + ' != down ');
                                                                                            if (((parseFloat(state.val) > parseFloat(shutterSettings[s].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[s].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp && shutterSettings[s].triggerAction != 'down') {
                                                                                                adapter.log.info(' Will sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDownSun + '%' + ' after the window has been closed ');
                                                                                                shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].heightDownSun);
                                                                                                adapter.log.debug('save new trigger height: ' + shutterSettings[s].heightDownSun + '%');
                                                                                                shutterSettings[s].triggerAction = 'sunProtect';
                                                                                                adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                                                return (shutterSettings);
                                                                                            }

                                                                                        }
                                                                                    });
                                                                                }
                                                                            }
                                                                        }
                                                                        if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyDown') || (shutterSettings[s].triggerID == '')) {
                                                                            let hysteresisOutside = (((100 - shutterSettings[s].hysteresisOutside) / 100) * shutterSettings[s].tempOutside).toFixed(2);
                                                                            let hysteresisInside = (((100 - shutterSettings[s].hysteresisInside) / 100) * shutterSettings[s].tempInside).toFixed(2);
                                                                            let hysteresisLight = (((100 - shutterSettings[s].hysteresisLight) / 100) * shutterSettings[s].valueLight).toFixed(2);

                                                                            if (insideTemp < parseFloat(hysteresisInside) || (parseFloat(hysteresisOutside) > outsideTemp || shutterSettings[s].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && shutterSettings[s].lightSensor == '')) {

                                                                                /**
                                                                                 * @param {any} err
                                                                                 * @param {{ val: string; }} state
                                                                                 */
                                                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                                    if (typeof state != undefined && state != null) {
                                                                                        if (shutterSettings[s].currentAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(shutterSettings[s].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight))) {
                                                                                            shutterSettings[s].currentAction = 'up';
                                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active');
                                                                                            adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                                            adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%')
                                                                                            adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].heightUp), false);
                                                                                            shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[s].currentHeight, ack: true });
                                                                                            adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightDownSun + '%')
                                                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                            return (shutterSettings);
                                                                                        }
                                                                                        else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                                                            shutterSettings[s].currentAction = 'none';
                                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
                                                                                            return (shutterSettings);
                                                                                        }
                                                                                    }
                                                                                });
                                                                            }
                                                                        }
                                                                        if (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyDown' && shutterSettings[s].driveAfterClose == true) {
                                                                            let hysteresisOutside = (((100 - shutterSettings[s].hysteresisOutside) / 100) * shutterSettings[s].tempOutside).toFixed(2);
                                                                            let hysteresisInside = (((100 - shutterSettings[s].hysteresisInside) / 100) * shutterSettings[s].tempInside).toFixed(2);
                                                                            let hysteresisLight = (((100 - shutterSettings[s].hysteresisLight) / 100) * shutterSettings[s].valueLight).toFixed(2);

                                                                            if (insideTemp < parseFloat(hysteresisInside) || (parseFloat(hysteresisOutside) > outsideTemp || shutterSettings[s].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && shutterSettings[s].lightSensor == '')) {

                                                                                /**
                                                                                 * @param {any} err
                                                                                 * @param {{ val: any; }} state
                                                                                 */
                                                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                                    if (typeof state != undefined && state != null) {
                                                                                        if (shutterSettings[s].triggerAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (parseFloat(shutterSettings[s].triggerHeight) == parseFloat(shutterSettings[s].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight))) {
                                                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active anymore');
                                                                                            adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                                            adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDownSun + '%' + ' after the window has been closed ');
                                                                                            shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].heightUp);
                                                                                            adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                                                            shutterSettings[s].triggerAction = 'up';
                                                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                                            return (shutterSettings);
                                                                                        }
                                                                                        else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                                                            shutterSettings[s].triggerAction = 'none';
                                                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
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
                                            resultDirectionRangeMinus = parseInt(shutterSettings[s].direction) - parseInt(shutterSettings[s].directionRange);
                                            resultDirectionRangePlus = parseInt(shutterSettings[s].direction) + parseInt(shutterSettings[s].directionRange);
                                            setTimeout(function () {
                                                let currentValue = '';
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {
                                                    let mustValue = ('' + shutterSettings[s].triggerState);
                                                    if (typeof state != undefined && state != null) {
                                                        currentValue = ('' + state.val);
                                                    }
                                                    if (currentValue === mustValue && shutterSettings[s].tempSensor != '' || (currentValue != mustValue && shutterSettings[s].autoDrive != 'off' && shutterSettings[s].tempSensor != '') || (shutterSettings[s].triggerID == '' && shutterSettings[s].tempSensor != '')) {
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
                                                        adapter.getForeignState(shutterSettings[s].tempSensor, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                insideTemp = parseFloat(state.val);

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(shutterSettings[s].outsideTempSensor, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        outsideTemp = parseFloat(state.val);
                                                                    }

                                                                    /**
                                                                     * @param {any} err
                                                                     * @param {{ val: string; }} state
                                                                     */
                                                                    adapter.getForeignState(shutterSettings[s].lightSensor, (err, state) => {
                                                                        if (typeof state != undefined && state != null) {
                                                                            sunLight = parseFloat(state.val);
                                                                        }
                                                                        if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyUp') || (shutterSettings[s].triggerID == '')) {
                                                                            if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth && insideTemp > shutterSettings[s].tempInside) {
                                                                                if (shutterSettings[s].tempOutside < outsideTemp && (shutterSettings[s].lightSensor != '' && shutterSettings[s].valueLight < sunLight || shutterSettings[s].lightSensor == '') && shutterSettings[s].currentAction != 'sunProtect' && shutterSettings[s].currentAction != 'OpenInSunProtect' && shutterSettings[s].currentAction != 'Manu_Mode') {

                                                                                    /**
                                                                                     * @param {any} err
                                                                                     * @param {{ val: string; }} state
                                                                                     */
                                                                                    adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                                        if (typeof state != undefined && state != null) {
                                                                                            adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[s].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp);
                                                                                            //if (parseFloat(state.val) > parseFloat(shutterSettings[s].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp) {
                                                                                            if (((parseFloat(state.val) > parseFloat(shutterSettings[s].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[s].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp) {
                                                                                                shutterSettings[s].currentAction = 'sunProtect';
                                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                                adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is active');
                                                                                                adapter.log.debug('Temperature inside: ' + insideTemp + ' > ' + shutterSettings[s].tempInside + ' AND ( Temperatur outside: ' + outsideTemp + ' > ' + shutterSettings[s].tempOutside + ' AND Light: ' + sunLight + ' > ' + shutterSettings[s].valueLight + ' )');
                                                                                                adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightDownSun + '%');
                                                                                                adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDownSun + '%');

                                                                                                adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].heightDownSun), false);
                                                                                                shutterSettings[s].currentHeight = shutterSettings[s].heightDownSun;
                                                                                                adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[s].currentHeight, ack: true });
                                                                                                adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightDownSun + '%')
                                                                                                shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                                return (shutterSettings);
                                                                                            }
                                                                                            // Shutter closed. Set currentAction = sunProtect when sunProtect starts => 
                                                                                            // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                                            else if (parseFloat(state.val) == parseFloat(shutterSettings[s].heightDown) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentAction != 'down' && shutterSettings[s].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                                                shutterSettings[s].currentAction = 'OpenInSunProtect';
                                                                                                adapter.log.debug('Set sunprotect mode for ' + shutterSettings[s].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                                                return (shutterSettings);
                                                                                            }
                                                                                            // Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set -> 
                                                                                            // set sunProtect again
                                                                                            else if (parseFloat(state.val) == parseFloat(shutterSettings[s].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentHeight != shutterSettings[s].heightDown && shutterSettings[s].currentAction == '') {
                                                                                                adapter.log.debug(shutterSettings[s].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + shutterSettings[s].heightDownSun);
                                                                                                shutterSettings[s].currentAction = 'sunProtect';
                                                                                                adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                                return (shutterSettings);
                                                                                            }
                                                                                        }
                                                                                    });
                                                                                }
                                                                            }
                                                                        }
                                                                        if (currentValue != mustValue && shutterSettings[s].autoDrive == 'onlyUp' && shutterSettings[s].driveAfterClose == true) {
                                                                            if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth && insideTemp > shutterSettings[s].tempInside) {
                                                                                if (shutterSettings[s].tempOutside < outsideTemp && (shutterSettings[s].lightSensor != '' && shutterSettings[s].valueLight < sunLight || shutterSettings[s].lightSensor == '') && shutterSettings[s].triggerAction != 'sunProtect' && shutterSettings[s].triggerAction != 'OpenInSunProtect' && shutterSettings[s].triggerAction != 'Manu_Mode') {
                                                                                    /**
                                                                                     * @param {any} err
                                                                                     * @param {{ val: string; }} state
                                                                                     */
                                                                                    adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                                        if (typeof state != undefined && state != null) {
                                                                                            adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[s].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp + ' AND triggerAction:' + shutterSettings[s].triggerAction + ' != down ');
                                                                                            if (((parseFloat(state.val) > parseFloat(shutterSettings[s].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[s].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp && shutterSettings[s].triggerAction != 'down') {
                                                                                                adapter.log.info(' Will sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDownSun + '%' + ' after the window has been closed ');
                                                                                                shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].heightDownSun);
                                                                                                adapter.log.debug('save new trigger height: ' + shutterSettings[s].heightDownSun + '%');
                                                                                                shutterSettings[s].triggerAction = 'sunProtect';
                                                                                                adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                                                return (shutterSettings);
                                                                                            }

                                                                                        }
                                                                                    });
                                                                                }
                                                                            }
                                                                        }
                                                                        if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyDown') || (shutterSettings[s].triggerID == '')) {
                                                                            let hysteresisOutside = (((100 - shutterSettings[s].hysteresisOutside) / 100) * shutterSettings[s].tempOutside).toFixed(2);
                                                                            let hysteresisInside = (((100 - shutterSettings[s].hysteresisInside) / 100) * shutterSettings[s].tempInside).toFixed(2);
                                                                            let hysteresisLight = (((100 - shutterSettings[s].hysteresisLight) / 100) * shutterSettings[s].valueLight).toFixed(2);

                                                                            if (insideTemp < parseFloat(hysteresisInside) || (resultDirectionRangePlus) < azimuth || (parseFloat(hysteresisOutside) > outsideTemp || shutterSettings[s].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && shutterSettings[s].lightSensor == '')) {
                                                                                /**
                                                                                 * @param {any} err
                                                                                 * @param {{ val: string; }} state
                                                                                 */
                                                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                                    if (typeof state != undefined && state != null) {
                                                                                        if (shutterSettings[s].currentAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(shutterSettings[s].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight))) {
                                                                                            shutterSettings[s].currentAction = 'up';
                                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active');
                                                                                            adapter.log.debug('Range: ' + resultDirectionRangePlus + ' < ' + azimuth + ' OR Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ')');
                                                                                            adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightUp + '%');
                                                                                            adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%');

                                                                                            adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].heightUp), false);
                                                                                            shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[s].currentHeight, ack: true });
                                                                                            adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightUp + '%')
                                                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                            return (shutterSettings);
                                                                                        }
                                                                                        else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                                                            shutterSettings[s].currentAction = 'none';
                                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
                                                                                            return (shutterSettings);
                                                                                        }
                                                                                    }
                                                                                });
                                                                            }
                                                                        }
                                                                        if (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyDown' && shutterSettings[s].driveAfterClose == true) {
                                                                            let hysteresisOutside = (((100 - shutterSettings[s].hysteresisOutside) / 100) * shutterSettings[s].tempOutside).toFixed(2);
                                                                            let hysteresisInside = (((100 - shutterSettings[s].hysteresisInside) / 100) * shutterSettings[s].tempInside).toFixed(2);
                                                                            let hysteresisLight = (((100 - shutterSettings[s].hysteresisLight) / 100) * shutterSettings[s].valueLight).toFixed(2);

                                                                            if (insideTemp < parseFloat(hysteresisInside) || (resultDirectionRangePlus) < azimuth || (parseFloat(hysteresisOutside) > outsideTemp || shutterSettings[s].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && shutterSettings[s].lightSensor == '')) {

                                                                                /**
                                                                                 * @param {any} err
                                                                                 * @param {{ val: any; }} state
                                                                                 */
                                                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                                    if (typeof state != undefined && state != null) {
                                                                                        if (shutterSettings[s].triggerAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (parseFloat(shutterSettings[s].triggerHeight) == parseFloat(shutterSettings[s].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight))) {
                                                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active anymore');
                                                                                            adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                                            adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDownSun + '%' + ' after the window has been closed ');
                                                                                            shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].heightUp);
                                                                                            adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                                                            shutterSettings[s].triggerAction = 'up';
                                                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                                            return (shutterSettings);
                                                                                        }
                                                                                        else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                                                            shutterSettings[s].triggerAction = 'none';
                                                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
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
                                            resultDirectionRangeMinus = parseInt(shutterSettings[s].direction) - parseInt(shutterSettings[s].directionRange);
                                            resultDirectionRangePlus = parseInt(shutterSettings[s].direction) + parseInt(shutterSettings[s].directionRange);

                                            setTimeout(function () {
                                                let currentValue = '';
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {
                                                    let mustValue = ('' + shutterSettings[s].triggerState);
                                                    if (typeof state != undefined && state != null) {
                                                        currentValue = ('' + state.val);
                                                    }
                                                    if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'off') || (shutterSettings[s].triggerID == '')) {
                                                        /** @type {number} */
                                                        let outsideTemp;
                                                        /** @type {number} */
                                                        let sunLight;

                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: string; }} state
                                                         */
                                                        adapter.getForeignState(shutterSettings[s].outsideTempSensor, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                outsideTemp = parseFloat(state.val);
                                                            }

                                                            /**
                                                             * @param {any} err
                                                             * @param {{ val: string; }} state
                                                             */
                                                            adapter.getForeignState(shutterSettings[s].lightSensor, (err, state) => {
                                                                if (typeof state != undefined && state != null) {
                                                                    sunLight = parseFloat(state.val);
                                                                }
                                                                if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyUp') || (shutterSettings[s].triggerID == '')) {
                                                                    if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth) {
                                                                        if (shutterSettings[s].tempOutside < outsideTemp && (shutterSettings[s].lightSensor != '' && shutterSettings[s].valueLight < sunLight || shutterSettings[s].lightSensor == '') && shutterSettings[s].currentAction != 'sunProtect' && shutterSettings[s].currentAction != 'OpenInSunProtect' && shutterSettings[s].currentAction != 'Manu_Mode') {
                                                                            /**
                                                                             * @param {any} err
                                                                             * @param {{ val: string; }} state
                                                                             */
                                                                            adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                                if (typeof state != undefined && state != null) {
                                                                                    adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[s].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp);
                                                                                    //if (parseFloat(state.val) > parseFloat(shutterSettings[s].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp) {
                                                                                    if (((parseFloat(state.val) > parseFloat(shutterSettings[s].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[s].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp) {
                                                                                        shutterSettings[s].currentAction = 'sunProtect';
                                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                        adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is active');
                                                                                        adapter.log.debug('Temperatur outside: ' + outsideTemp + ' > ' + shutterSettings[s].tempOutside + ' AND Light: ' + sunLight + ' > ' + shutterSettings[s].valueLight);
                                                                                        adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDownSun + '%')

                                                                                        adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].heightDownSun), false);
                                                                                        shutterSettings[s].currentHeight = shutterSettings[s].heightDownSun;
                                                                                        adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[s].currentHeight, ack: true });
                                                                                        adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightDownSun + '%')
                                                                                        shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                        return (shutterSettings);
                                                                                    }
                                                                                    // Shutter closed. Set currentAction = sunProtect when sunProtect starts => 
                                                                                    // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                                    else if (parseFloat(state.val) == parseFloat(shutterSettings[s].heightDown) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentAction != 'down' && shutterSettings[s].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                                        shutterSettings[s].currentAction = 'OpenInSunProtect';
                                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                        adapter.log.debug('Set sunprotect mode for ' + shutterSettings[s].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                                        return (shutterSettings);
                                                                                    }
                                                                                    // Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set ->
                                                                                    // set sunProtect again
                                                                                    else if (parseFloat(state.val) == parseFloat(shutterSettings[s].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentHeight != shutterSettings[s].heightDown && shutterSettings[s].currentAction == '') {
                                                                                        adapter.log.debug(shutterSettings[s].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + shutterSettings[s].heightDownSun);
                                                                                        shutterSettings[s].currentAction = 'sunProtect';
                                                                                        adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                        return (shutterSettings);
                                                                                    }
                                                                                }
                                                                            });
                                                                        }
                                                                    }
                                                                }
                                                                if (currentValue != mustValue && shutterSettings[s].autoDrive == 'onlyUp' && shutterSettings[s].driveAfterClose == true) {
                                                                    if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth) {
                                                                        if (shutterSettings[s].tempOutside < outsideTemp && (shutterSettings[s].lightSensor != '' && shutterSettings[s].valueLight < sunLight || shutterSettings[s].lightSensor == '') && shutterSettings[s].triggerAction != 'sunProtect' && shutterSettings[s].triggerAction != 'OpenInSunProtect' && shutterSettings[s].triggerAction != 'Manu_Mode') {
                                                                            /**
                                                                             * @param {any} err
                                                                             * @param {{ val: string; }} state
                                                                             */
                                                                            adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                                if (typeof state != undefined && state != null) {
                                                                                    adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[s].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp);
                                                                                    if (((parseFloat(state.val) > parseFloat(shutterSettings[s].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[s].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp && shutterSettings[s].triggerAction != 'down') {
                                                                                        adapter.log.info(' Will sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDownSun + '%' + ' after the window has been closed ');
                                                                                        shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].heightDownSun);
                                                                                        adapter.log.debug('save new trigger height: ' + shutterSettings[s].heightDownSun + '%');
                                                                                        shutterSettings[s].triggerAction = 'sunProtect';
                                                                                        adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                                        return (shutterSettings);
                                                                                    }

                                                                                }
                                                                            });
                                                                        }
                                                                    }
                                                                }
                                                                if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyDown') || (shutterSettings[s].triggerID == '')) {
                                                                    const hysteresisOutside = (((100 - shutterSettings[s].hysteresisOutside) / 100) * shutterSettings[s].tempOutside).toFixed(2);
                                                                    const hysteresisLight = (((100 - shutterSettings[s].hysteresisLight) / 100) * shutterSettings[s].valueLight).toFixed(2);

                                                                    if ((resultDirectionRangePlus) < azimuth || (parseFloat(hysteresisOutside) > outsideTemp || shutterSettings[s].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && shutterSettings[s].lightSensor == '')) {

                                                                        /**
                                                                         * @param {any} err
                                                                         * @param {{ val: string; }} state
                                                                         */
                                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                if (shutterSettings[s].currentAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(shutterSettings[s].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight))) {
                                                                                    shutterSettings[s].currentAction = 'up';
                                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                    adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active');
                                                                                    adapter.log.debug('Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight);
                                                                                    adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%')
                                                                                    adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].heightUp), false);
                                                                                    shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[s].currentHeight, ack: true });
                                                                                    adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightUp + '%')
                                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                    return (shutterSettings);
                                                                                }
                                                                                else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                                                    shutterSettings[s].currentAction = 'none';
                                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                    adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
                                                                                    return (shutterSettings);
                                                                                }
                                                                            }
                                                                        });
                                                                    }
                                                                }
                                                                if (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyDown' && shutterSettings[s].driveAfterClose == true) {
                                                                    const hysteresisOutside = (((100 - shutterSettings[s].hysteresisOutside) / 100) * shutterSettings[s].tempOutside).toFixed(2);
                                                                    const hysteresisLight = (((100 - shutterSettings[s].hysteresisLight) / 100) * shutterSettings[s].valueLight).toFixed(2);

                                                                    if ((resultDirectionRangePlus) < azimuth || (parseFloat(hysteresisOutside) > outsideTemp || shutterSettings[s].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp && shutterSettings[s].lightSensor == '')) {

                                                                        /**
                                                                         * @param {any} err
                                                                         * @param {{ val: any; }} state
                                                                         */
                                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                if (shutterSettings[s].triggerAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (parseFloat(shutterSettings[s].triggerHeight) == parseFloat(shutterSettings[s].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight))) {
                                                                                    adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active anymore');
                                                                                    adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                                    adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDownSun + '%' + ' after the window has been closed ');
                                                                                    shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].heightUp);
                                                                                    adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                                                    shutterSettings[s].triggerAction = 'up';
                                                                                    adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                                    return (shutterSettings);
                                                                                }
                                                                                else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                                                    shutterSettings[s].triggerAction = 'none';
                                                                                    adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
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
                                            resultDirectionRangeMinus = parseInt(shutterSettings[s].direction) - parseInt(shutterSettings[s].directionRange);
                                            resultDirectionRangePlus = parseInt(shutterSettings[s].direction) + parseInt(shutterSettings[s].directionRange);
                                            setTimeout(function () {
                                                let currentValue = '';
                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {
                                                    let mustValue = ('' + shutterSettings[s].triggerState);
                                                    if (typeof state != undefined && state != null) {
                                                        currentValue = ('' + state.val);
                                                    }
                                                    if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'off') || (shutterSettings[s].triggerID == '')) {
                                                        if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyUp') || (shutterSettings[s].triggerID == '')) {
                                                            if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth && shutterSettings[s].currentAction != 'sunProtect' && shutterSettings[s].currentAction != 'OpenInSunProtect' && shutterSettings[s].currentAction != 'Manu_Mode') {

                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[s].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp);
                                                                        if (((parseFloat(state.val) > parseFloat(shutterSettings[s].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[s].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp) {
                                                                            shutterSettings[s].currentAction = 'sunProtect';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is active');
                                                                            adapter.log.debug('RangeMinus: ' + resultDirectionRangeMinus + ' < ' + azimuth + 'RangePlus: ' + resultDirectionRangePlus + ' > ' + azimuth);
                                                                            adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDownSun + '%')

                                                                            adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].heightDownSun), false);
                                                                            shutterSettings[s].currentHeight = shutterSettings[s].heightDownSun;
                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[s].currentHeight, ack: true });
                                                                            adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightDownSun + '%')
                                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                            return (shutterSettings);
                                                                        }
                                                                        // Shutter closed. Set currentAction = sunProtect when sunProtect starts => 
                                                                        // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                        else if (parseFloat(state.val) == parseFloat(shutterSettings[s].heightDown) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentAction != 'down' && shutterSettings[s].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                            shutterSettings[s].currentAction = 'OpenInSunProtect';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                            adapter.log.debug('Set sunprotect mode for ' + shutterSettings[s].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                            return (shutterSettings);
                                                                        }
                                                                        // Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set ->
                                                                        // set sunProtect again
                                                                        else if (parseFloat(state.val) == parseFloat(shutterSettings[s].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentHeight != shutterSettings[s].heightDown && shutterSettings[s].currentAction == '') {
                                                                            adapter.log.debug(shutterSettings[s].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + shutterSettings[s].heightDownSun);
                                                                            shutterSettings[s].currentAction = 'sunProtect';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                            return (shutterSettings);
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                        if (currentValue != mustValue && shutterSettings[s].autoDrive == 'onlyUp' && shutterSettings[s].driveAfterClose == true) {
                                                            if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth && shutterSettings[s].triggerAction != 'sunProtect' && shutterSettings[s].triggerAction != 'OpenInSunProtect' && shutterSettings[s].triggerAction != 'Manu_Mode') {
                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[s].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp);
                                                                        if (((parseFloat(state.val) > parseFloat(shutterSettings[s].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[s].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp && shutterSettings[s].triggerAction != 'down') {
                                                                            adapter.log.info(' Will sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDownSun + '%' + ' after the window has been closed ');
                                                                            shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].heightDownSun);
                                                                            adapter.log.debug('save new trigger height: ' + shutterSettings[s].heightDownSun + '%');
                                                                            shutterSettings[s].triggerAction = 'sunProtect';
                                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                            return (shutterSettings);
                                                                        }
                                                                    }
                                                                });

                                                            }
                                                        }
                                                        if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyDown') || (shutterSettings[s].triggerID == '')) {
                                                            if ((resultDirectionRangePlus) < azimuth) {
                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: string; }} state
                                                                 */
                                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        if (shutterSettings[s].currentAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(shutterSettings[s].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight))) {
                                                                            shutterSettings[s].currentAction = 'up';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active');
                                                                            adapter.log.debug('Range: ' + resultDirectionRangePlus + ' < ' + azimuth);
                                                                            adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%')
                                                                            adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].heightUp), false);
                                                                            shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[s].currentHeight, ack: true });
                                                                            adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightUp + '%')
                                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                            return (shutterSettings);
                                                                        }
                                                                        else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                                            shutterSettings[s].currentAction = 'none';
                                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
                                                                            return (shutterSettings);
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        }
                                                        if (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyDown' && shutterSettings[s].driveAfterClose == true) {
                                                            if ((resultDirectionRangePlus) < azimuth) {
                                                                /**
                                                                 * @param {any} err
                                                                 * @param {{ val: any; }} state
                                                                 */
                                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                    if (typeof state != undefined && state != null) {
                                                                        if (shutterSettings[s].triggerAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (parseFloat(shutterSettings[s].triggerHeight) == parseFloat(shutterSettings[s].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight))) {
                                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active anymore');
                                                                            adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                            adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDownSun + '%' + ' after the window has been closed ');
                                                                            shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].heightUp);
                                                                            adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                                            shutterSettings[s].triggerAction = 'up';
                                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                            return (shutterSettings);
                                                                        }
                                                                        else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                                            shutterSettings[s].triggerAction = 'none';
                                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
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
                                                adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {
                                                    let mustValue = ('' + shutterSettings[s].triggerState);
                                                    if (typeof state != undefined && state != null) {
                                                        currentValue = ('' + state.val);
                                                    }
                                                    if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'off') || (shutterSettings[s].triggerID == '')) {
                                                        /** @type {number} */
                                                        let outsideTemp;
                                                        /** @type {number} */
                                                        let sunLight;

                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: string; }} state
                                                         */
                                                        adapter.getForeignState(shutterSettings[s].outsideTempSensor, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                outsideTemp = parseFloat(state.val);
                                                            }

                                                            /**
                                                             * @param {any} err
                                                             * @param {{ val: string; }} state
                                                             */
                                                            adapter.getForeignState(shutterSettings[s].lightSensor, (err, state) => {
                                                                if (typeof state != undefined && state != null) {
                                                                    sunLight = parseFloat(state.val);
                                                                }
                                                                if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyUp') || (shutterSettings[s].triggerID == '')) {
                                                                    if (shutterSettings[s].tempOutside < outsideTemp && (shutterSettings[s].lightSensor != '' && shutterSettings[s].valueLight < sunLight || shutterSettings[s].lightSensor == '') && shutterSettings[s].currentAction != 'sunProtect' && shutterSettings[s].currentAction != 'OpenInSunProtect' && shutterSettings[s].currentAction != 'Manu_Mode') {
                                                                        /**
                                                                         * @param {any} err
                                                                         * @param {{ val: string; }} state
                                                                         */
                                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[s].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp);
                                                                                //if (parseFloat(state.val) > parseFloat(shutterSettings[s].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp) {
                                                                                if (((parseFloat(state.val) > parseFloat(shutterSettings[s].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[s].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp) {
                                                                                    shutterSettings[s].currentAction = 'sunProtect';
                                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                    adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is active');
                                                                                    adapter.log.debug('Temperature outside: ' + outsideTemp + ' > ' + shutterSettings[s].tempOutside + ' AND Light: ' + sunLight + ' > ' + shutterSettings[s].valueLight);
                                                                                    adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDownSun + '%')

                                                                                    adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].heightDownSun), false);
                                                                                    shutterSettings[s].currentHeight = shutterSettings[s].heightDownSun;
                                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[s].currentHeight, ack: true });
                                                                                    adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightDownSun + '%')
                                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                    return (shutterSettings);
                                                                                }
                                                                                // Shutter closed. Set currentAction = sunProtect when sunProtect starts =>
                                                                                // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                                else if (parseFloat(state.val) == parseFloat(shutterSettings[s].heightDown) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentAction != 'down' && shutterSettings[s].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                                    shutterSettings[s].currentAction = 'OpenInSunProtect';
                                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                    adapter.log.debug('Set sunprotect mode for ' + shutterSettings[s].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                                    return (shutterSettings);
                                                                                }
                                                                                // Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set ->
                                                                                // set sunProtect again
                                                                                else if (parseFloat(state.val) == parseFloat(shutterSettings[s].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentHeight != shutterSettings[s].heightDown && shutterSettings[s].currentAction == '') {
                                                                                    adapter.log.debug(shutterSettings[s].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + shutterSettings[s].heightDownSun);
                                                                                    shutterSettings[s].currentAction = 'sunProtect';
                                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                    return (shutterSettings);
                                                                                }
                                                                            }
                                                                        });
                                                                    }
                                                                }
                                                                if (currentValue != mustValue && shutterSettings[s].autoDrive == 'onlyUp' && shutterSettings[s].driveAfterClose == true) {
                                                                    if (shutterSettings[s].tempOutside < outsideTemp && (shutterSettings[s].lightSensor != '' && shutterSettings[s].valueLight < sunLight || shutterSettings[s].lightSensor == '') && shutterSettings[s].triggerAction != 'sunProtect' && shutterSettings[s].triggerAction != 'OpenInSunProtect' && shutterSettings[s].triggerAction != 'Manu_Mode') {
                                                                        /**
                                                                         * @param {any} err
                                                                         * @param {{ val: string; }} state
                                                                         */
                                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[s].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp);
                                                                                if (((parseFloat(state.val) > parseFloat(shutterSettings[s].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[s].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp && shutterSettings[s].triggerAction != 'down') {
                                                                                    adapter.log.info(' Will sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDownSun + '%' + ' after the window has been closed ');
                                                                                    shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].heightDownSun);
                                                                                    adapter.log.debug('save new trigger height: ' + shutterSettings[s].heightDownSun + '%');
                                                                                    shutterSettings[s].triggerAction = 'sunProtect';
                                                                                    adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                                    return (shutterSettings);
                                                                                }
                                                                            }
                                                                        });

                                                                    }
                                                                }
                                                                if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyDown') || (shutterSettings[s].triggerID == '')) {

                                                                    let hysteresisOutside = (((100 - shutterSettings[s].hysteresisOutside) / 100) * shutterSettings[s].tempOutside).toFixed(2);
                                                                    let hysteresisLight = (((100 - shutterSettings[s].hysteresisLight) / 100) * shutterSettings[s].valueLight).toFixed(2);

                                                                    if ((shutterSettings[s].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp)) {

                                                                        /**
                                                                         * @param {any} err
                                                                         * @param {{ val: string; }} state
                                                                         */
                                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                if (shutterSettings[s].currentAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(shutterSettings[s].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight))) {
                                                                                    shutterSettings[s].currentAction = 'up';
                                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                    adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active');
                                                                                    adapter.log.debug('Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight);
                                                                                    adapter.log.info('Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%')

                                                                                    adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].heightUp), false);
                                                                                    shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[s].currentHeight, ack: true });
                                                                                    adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightUp + '%')
                                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                    return (shutterSettings);
                                                                                }
                                                                                else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                                                    shutterSettings[s].currentAction = 'none';
                                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                    adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
                                                                                    return (shutterSettings);
                                                                                }
                                                                            }
                                                                        });
                                                                    }
                                                                }
                                                                if (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyDown' && shutterSettings[s].driveAfterClose == true) {

                                                                    let hysteresisOutside = (((100 - shutterSettings[s].hysteresisOutside) / 100) * shutterSettings[s].tempOutside).toFixed(2);
                                                                    let hysteresisLight = (((100 - shutterSettings[s].hysteresisLight) / 100) * shutterSettings[s].valueLight).toFixed(2);

                                                                    if ((shutterSettings[s].lightSensor != '' && parseFloat(hysteresisLight) > sunLight) || (parseFloat(hysteresisOutside) > outsideTemp)) {

                                                                        /**
                                                                         * @param {any} err
                                                                         * @param {{ val: any; }} state
                                                                         */
                                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                if (shutterSettings[s].triggerAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (parseFloat(shutterSettings[s].triggerHeight) == parseFloat(shutterSettings[s].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight))) {
                                                                                    adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active anymore');
                                                                                    adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                                    adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDownSun + '%' + ' after the window has been closed ');
                                                                                    shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].heightUp);
                                                                                    adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                                                    shutterSettings[s].triggerAction = 'up';
                                                                                    adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                                    return (shutterSettings);
                                                                                }
                                                                                else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                                                    shutterSettings[s].triggerAction = 'none';
                                                                                    adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
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
                                                adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {
                                                    let mustValue = ('' + shutterSettings[s].triggerState);
                                                    if (typeof state != undefined && state != null) {
                                                        currentValue = ('' + state.val);
                                                    }
                                                    if (currentValue === mustValue && shutterSettings[s].tempSensor != '' || (currentValue != mustValue && shutterSettings[s].autoDrive != 'off' && shutterSettings[s].tempSensor != '') || (shutterSettings[s].triggerID == '' && shutterSettings[s].tempSensor != '')) {
                                                        /** @type {string | number} */
                                                        let insideTemp;
                                                        /**
                                                         * @param {any} err
                                                         * @param {{ val: string; }} state
                                                         */
                                                        adapter.getForeignState(shutterSettings[s].tempSensor, (err, state) => {
                                                            if (typeof state != undefined && state != null) {
                                                                insideTemp = parseFloat(state.val);

                                                                if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyUp') || (shutterSettings[s].triggerID == '')) {
                                                                    if (insideTemp > shutterSettings[s].tempInside && shutterSettings[s].currentAction != 'sunProtect' && shutterSettings[s].currentAction != 'OpenInSunProtect' && shutterSettings[s].currentAction != 'Manu_Mode') {

                                                                        /**
                                                                         * @param {any} err
                                                                         * @param {{ val: string; }} state
                                                                         */
                                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                //if (parseFloat(state.val) > parseFloat(shutterSettings[s].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp) {
                                                                                if (((parseFloat(state.val) > parseFloat(shutterSettings[s].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[s].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp) {
                                                                                    shutterSettings[s].currentAction = 'sunProtect';
                                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                    adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is active');
                                                                                    adapter.log.info('#40 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDownSun + '%');
                                                                                    adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].heightDownSun), false);
                                                                                    shutterSettings[s].currentHeight = shutterSettings[s].heightDownSun;
                                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[s].currentHeight, ack: true });
                                                                                    adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightDownSun + '%')
                                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                    return (shutterSettings);
                                                                                }
                                                                                // Shutter closed. Set currentAction = sunProtect when sunProtect starts =>
                                                                                // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                                                else if (parseFloat(state.val) == parseFloat(shutterSettings[s].heightDown) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentAction != 'down' && shutterSettings[s].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                                    shutterSettings[s].currentAction = 'OpenInSunProtect';
                                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                    adapter.log.debug('Set sunprotect mode for ' + shutterSettings[s].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                                                    return (shutterSettings);
                                                                                }
                                                                                // Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set ->
                                                                                // set sunProtect again
                                                                                else if (parseFloat(state.val) == parseFloat(shutterSettings[s].heightDownSun) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentHeight != shutterSettings[s].heightDown && shutterSettings[s].currentAction == '') {
                                                                                    adapter.log.debug(shutterSettings[s].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + state.val + ' HeightDownSun:' + shutterSettings[s].heightDownSun);
                                                                                    shutterSettings[s].currentAction = 'sunProtect';
                                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                    return (shutterSettings);
                                                                                }
                                                                            }
                                                                        });
                                                                    }
                                                                }
                                                                if (currentValue != mustValue && shutterSettings[s].autoDrive == 'onlyUp' && shutterSettings[s].driveAfterClose == true) {
                                                                    if (insideTemp > shutterSettings[s].tempInside && shutterSettings[s].triggerAction != 'sunProtect' && shutterSettings[s].triggerAction != 'OpenInSunProtect' && shutterSettings[s].triggerAction != 'Manu_Mode') {
                                                                        /**
                                                                         * @param {any} err
                                                                         * @param {{ val: string; }} state
                                                                         */
                                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + state.val + ' > HeightDownSun: ' + shutterSettings[s].heightDownSun + ' AND Height:' + state.val + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp);
                                                                                if (((parseFloat(state.val) > parseFloat(shutterSettings[s].heightDownSun) && convertShutter == false) || (parseFloat(state.val) < parseFloat(shutterSettings[s].heightDownSun) && convertShutter == true)) && parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp && shutterSettings[s].triggerAction != 'down') {
                                                                                    adapter.log.info(' Will sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDownSun + '%' + ' after the window has been closed ');
                                                                                    shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].heightDownSun);
                                                                                    adapter.log.debug('save new trigger height: ' + shutterSettings[s].heightDownSun + '%');
                                                                                    shutterSettings[s].triggerAction = 'sunProtect';
                                                                                    adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                                    return (shutterSettings);
                                                                                }
                                                                            }
                                                                        });

                                                                    }
                                                                }
                                                                if (currentValue === mustValue || (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyDown') || (shutterSettings[s].triggerID == '')) {
                                                                    let hysteresisInside = (((100 - shutterSettings[s].hysteresisInside) / 100) * shutterSettings[s].tempInside).toFixed(2);

                                                                    if (insideTemp < parseFloat(hysteresisInside)) {

                                                                        /**
                                                                         * @param {any} err
                                                                         * @param {{ val: string; }} state
                                                                         */
                                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                if (shutterSettings[s].currentAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(shutterSettings[s].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight))) {
                                                                                    shutterSettings[s].currentAction = 'up';
                                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                    adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active');
                                                                                    adapter.log.info('#41 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%');
                                                                                    adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].heightUp), false);
                                                                                    shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                                                                    adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[s].currentHeight, ack: true });
                                                                                    adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightUp + '%')
                                                                                    shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                                                    return (shutterSettings);
                                                                                }
                                                                                else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                                                    shutterSettings[s].currentAction = 'none';
                                                                                    adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                                                    adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
                                                                                    return (shutterSettings);
                                                                                }
                                                                            }
                                                                        });
                                                                    }
                                                                }
                                                                if (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyDown' && shutterSettings[s].driveAfterClose == true) {
                                                                    let hysteresisInside = (((100 - shutterSettings[s].hysteresisInside) / 100) * shutterSettings[s].tempInside).toFixed(2);

                                                                    if (insideTemp < parseFloat(hysteresisInside)) {

                                                                        /**
                                                                         * @param {any} err
                                                                         * @param {{ val: any; }} state
                                                                         */
                                                                        adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                                            if (typeof state != undefined && state != null) {
                                                                                if (shutterSettings[s].triggerAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (parseFloat(shutterSettings[s].triggerHeight) == parseFloat(shutterSettings[s].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight))) {
                                                                                    adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active anymore');
                                                                                    adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                                                    adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDownSun + '%' + ' after the window has been closed ');
                                                                                    shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].heightUp);
                                                                                    adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                                                    shutterSettings[s].triggerAction = 'up';
                                                                                    adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                                                    return (shutterSettings);
                                                                                }
                                                                                else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                                                    shutterSettings[s].triggerAction = 'none';
                                                                                    adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
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
                for (const s in shutterSettings) {
                    if (shutterSettings[s].shutterName == result[i].shutterName) {
                        if (elevation <= sunProtEndStart && elevation >= sunProtEndStop && (shutterSettings[s].currentAction == 'sunProtect' || shutterSettings[s].currentAction == 'manu_sunProtect')) {
                            let nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                            let convertShutter;

                            if (parseFloat(shutterSettings[s].heightDown) < parseFloat(shutterSettings[s].heightUp)) {
                                convertShutter = false;
                                adapter.log.debug(shutterSettings[s].shutterName + ' level conversion is disabled ...');
                            } else if (parseFloat(shutterSettings[s].heightDown) > parseFloat(shutterSettings[s].heightUp)) {
                                convertShutter = true;
                                adapter.log.debug(shutterSettings[s].shutterName + ' level conversion is enabled');
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
                                        adapter.getForeignState(shutterSettings[s].triggerID, (err, state) => {
                                            let mustValue = ('' + shutterSettings[s].triggerState);
                                            if (typeof state != undefined && state != null) {
                                                currentValue = ('' + state.val);
                                            }
                                            if (currentValue === mustValue && shutterSettings[s].tempSensor != '' || (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyDown' && shutterSettings[s].autoDrive != 'off') || (shutterSettings[s].triggerID == '')) {

                                                /**
                                                 * @param {any} err
                                                 * @param {{ val: string; }} state
                                                 */
                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                    if (typeof state != undefined && state != null) {
                                                        if ((shutterSettings[s].currentAction == 'sunProtect' || shutterSettings[s].currentAction == 'manu_sunProtect') && shutterSettings[s].KeepSunProtect === false && (parseFloat(state.val) == parseFloat(shutterSettings[s].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight))) {
                                                            shutterSettings[s].currentAction = 'none';
                                                            adapter.setState('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true });
                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is completed');
                                                            adapter.log.info('#42 Set ID: ' + shutterSettings[s].shutterName + ' value: ' + parseFloat(shutterSettings[s].heightUp) + '%');
                                                            adapter.setForeignState(shutterSettings[s].name, parseFloat(shutterSettings[s].heightUp), false);
                                                            shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                                            adapter.setState('shutters.autoLevel.' + nameDevice, { val: shutterSettings[s].currentHeight, ack: true });
                                                            adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                                            shutterState(shutterSettings[s].name, adapter, shutterSettings);
                                                            return (shutterSettings);
                                                        }
                                                    }
                                                });
                                            }
                                            if (currentValue != mustValue && shutterSettings[s].autoDrive != 'onlyDown' && shutterSettings[s].driveAfterClose == true) {

                                                /**
                                                * @param {any} err
                                                * @param {{ val: any; }} state
                                                */
                                                adapter.getForeignState(shutterSettings[s].name, (err, state) => {
                                                    if (typeof state != undefined && state != null) {
                                                        if ((shutterSettings[s].triggerAction == 'sunProtect' || shutterSettings[s].triggerAction == 'manu_sunProtect') && shutterSettings[s].KeepSunProtect === false && (parseFloat(shutterSettings[s].triggerHeight) == parseFloat(shutterSettings[s].heightDownSun) || parseFloat(state.val) == parseFloat(shutterSettings[s].currentHeight))) {
                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active anymore');
                                                            //adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                            adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightDownSun + '%' + ' after the window has been closed ');
                                                            shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].heightUp);
                                                            adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                            shutterSettings[s].triggerAction = 'up';
                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
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
            }
        }
    }, 2000);
}
module.exports = sunProtect;
