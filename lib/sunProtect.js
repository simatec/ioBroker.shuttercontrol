'use strict';

const checkPendingAlarm = require('./shutterAlarm.js').checkPendingAlarm;           // shutterAlarm
const setShutterState = require('./setShutter.js').setShutterState;                 // set Shutter State

let timerSleep = 0;

async function sleep(ms) {
    return new Promise(async (resolve) => {
        // @ts-ignore
        timerSleep = setTimeout(async () => resolve(), ms);
    });
}

// @ts-ignore
async function sunProtect(adapter, elevation, azimuth, shutterSettings) {
    const driveDelayUpSleep = adapter.config.driveDelayUpAstro != 0 ? adapter.config.driveDelayUpAstro * 1000 : 20;
    const vRound = adapter.config.shutterStateRound;

    await sleep(2000);
    if (shutterSettings) {
        const result = shutterSettings.filter((/** @type {{ enabled: boolean | string; }} */ d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

        if (elevation > adapter.config.sunProtEndElevation) {
            for (const i in result) {
                for (const s in shutterSettings) {
                    if (shutterSettings[s].shutterName == result[i].shutterName) {
                        let resultDirectionRangeMinus = 0;
                        let resultDirectionRangePlus = 0;
                        let convertShutter = false;
                        let heightDownSun = shutterSettings[s].heightDownSun;

                        const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                        if (parseFloat(shutterSettings[s].heightDown) < parseFloat(shutterSettings[s].heightUp)) {
                            convertShutter = false;
                        } else if (parseFloat(shutterSettings[s].heightDown) > parseFloat(shutterSettings[s].heightUp)) {
                            convertShutter = true;
                        }

                        const pendingAlarm = await checkPendingAlarm(adapter, shutterSettings[s]);

                        const _autoSunState = await adapter.getStateAsync(`shutters.autoSun.${nameDevice}`).catch((e) => adapter.log.warn(e));

                        if (_autoSunState && _autoSunState.val === true) {
                            let currentValue = '';
                            let _triggerState;
                            let mustValue = '';
                            let mustValueTilted = '';

                            switch (shutterSettings[s].type) {

                                // +++++++++++++++++ sunprotect with in/outside temperature and Lightsensor +++++++++++++++

                                case 'in- & outside temperature': // in- & outside temperature
                                    _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;
                                    mustValue = ('' + shutterSettings[s].triggerState);
                                    mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                    if (typeof _triggerState != undefined && _triggerState != null && _triggerState.val != undefined) {
                                        currentValue = ('' + _triggerState.val);
                                    }

                                    if ((currentValue === mustValue || currentValue === mustValueTilted) && shutterSettings[s].tempSensor != '' ||
                                        (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'off' && shutterSettings[s].tempSensor != '') ||
                                        (shutterSettings[s].triggerID == '' && shutterSettings[s].tempSensor != '')) {

                                        let insideTemp = 0;
                                        let outsideTemp = 0;
                                        let sunLight = 0;

                                        const _insideTempState = shutterSettings[s].tempSensor != '' ? await adapter.getForeignStateAsync(shutterSettings[s].tempSensor).catch((e) => adapter.log.warn(e)) : null;
                                        if (typeof _insideTempState != undefined && _insideTempState != null && _insideTempState.val != undefined) {
                                            insideTemp = parseFloat(_insideTempState.val);
                                        }

                                        const _outsideTempState = shutterSettings[s].outsideTempSensor != '' ? await adapter.getForeignStateAsync(shutterSettings[s].outsideTempSensor).catch((e) => adapter.log.warn(e)) : null;
                                        if (typeof _outsideTempState != undefined && _outsideTempState != null && _outsideTempState.val != undefined) {
                                            outsideTemp = parseFloat(_outsideTempState.val);
                                        }

                                        const _sunLight = shutterSettings[s].lightSensor != '' ? await adapter.getForeignStateAsync(shutterSettings[s].lightSensor).catch((e) => adapter.log.warn(e)) : null;
                                        if (typeof _sunLight != undefined && _sunLight != null && _sunLight.val != undefined) {
                                            sunLight = parseFloat(_sunLight.val);
                                        }

                                        // heatProtection
                                        if (shutterSettings[s].heatProtection == true &&
                                            shutterSettings[s].tempHeatProtection < outsideTemp &&
                                            shutterSettings[s].currentHeight != shutterSettings[s].heightDown) {

                                            shutterSettings[s].currentAction = shutterSettings[s].currentAction == 'sunProtect' ? '' : shutterSettings[s].currentAction;
                                            heightDownSun = shutterSettings[s].heightDown;
                                            adapter.log.debug(`Heat Protection for ${shutterSettings[s].shutterName} is active`);
                                            adapter.log.debug(`currentAction ${shutterSettings[s].currentAction}`);

                                        } else {
                                            heightDownSun = shutterSettings[s].heightDownSun;
                                        }

                                        if (shutterSettings[s].sunProtectEndtimerid != '' &&
                                            shutterSettings[s].sunProtectEndtimerid != '0' &&
                                            shutterSettings[s].lightSensor != '' &&
                                            shutterSettings[s].valueLight < sunLight) {

                                            adapter.log.debug('Stopping sunprotect delay for ' + shutterSettings[s].shutterName);
                                            clearTimeout(shutterSettings[s].sunProtectEndtimerid);
                                            shutterSettings[s].sunProtectEndtimerid = '';
                                        }

                                        if (currentValue === mustValue || currentValue === mustValueTilted ||
                                            (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyUp') ||
                                            (shutterSettings[s].triggerID == '')) {

                                            if (insideTemp > shutterSettings[s].tempInside) {
                                                if (shutterSettings[s].tempOutside < outsideTemp &&
                                                    (shutterSettings[s].lightSensor != '' &&
                                                        shutterSettings[s].valueLight < sunLight ||
                                                        shutterSettings[s].lightSensor == '') &&
                                                    shutterSettings[s].currentAction != 'sunProtect' &&
                                                    shutterSettings[s].currentAction != 'OpenInSunProtect' &&
                                                    shutterSettings[s].currentAction != 'Manu_Mode') {

                                                    if (pendingAlarm == false) {
                                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                        if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                            adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + Math.round(_shutterState.val / vRound) * vRound + ' > HeightDownSun: ' + heightDownSun + ' AND Height:' + Math.round(_shutterState.val / vRound) * vRound + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp);

                                                            if (((Math.round(parseFloat(_shutterState.val) / vRound) * vRound > parseFloat(heightDownSun) &&
                                                                convertShutter == false) ||
                                                                (Math.round(parseFloat(_shutterState.val) / vRound) * vRound < parseFloat(heightDownSun) &&
                                                                    convertShutter == true)) &&
                                                                Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) &&
                                                                (shutterSettings[s].currentHeight == shutterSettings[s].heightUp ||
                                                                    (shutterSettings[s].heatProtection == true &&
                                                                        shutterSettings[s].tempHeatProtection < outsideTemp))) {

                                                                shutterSettings[s].currentAction = 'sunProtect';
                                                                shutterSettings[s].lastAutoAction = 'down_Sunprotect';
                                                                shutterSettings[s].currentHeight = heightDownSun;

                                                                await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(heightDownSun), nameDevice, 'Sunprotect #410');

                                                                adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is active');
                                                                adapter.log.debug('Temperature inside: ' + insideTemp + ' > ' + shutterSettings[s].tempInside + ' AND ( Temperatur outside: ' + outsideTemp + ' > ' + shutterSettings[s].tempOutside + ' AND Light: ' + sunLight + ' > ' + shutterSettings[s].valueLight + ' )');
                                                                adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                                adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + heightDownSun + '%');
                                                            }
                                                            // Shutter closed. Set currentAction = sunProtect when sunProtect starts => 
                                                            // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                            else if (Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].heightDown) &&
                                                                Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) &&
                                                                shutterSettings[s].currentHeight != shutterSettings[s].heightUp &&
                                                                shutterSettings[s].currentAction != 'down' &&
                                                                shutterSettings[s].currentAction != 'middle' &&
                                                                shutterSettings[s].currentAction != 'Xmas' &&
                                                                shutterSettings[s].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!

                                                                shutterSettings[s].currentAction = 'OpenInSunProtect';

                                                                await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true }).catch((e) => adapter.log.warn(e));

                                                                adapter.log.debug('Set sunprotect mode for ' + shutterSettings[s].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                            }
                                                            //Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set -> 
                                                            // set sunProtect again
                                                            else if (Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(heightDownSun) &&
                                                                Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) &&
                                                                shutterSettings[s].currentHeight != shutterSettings[s].heightUp &&
                                                                shutterSettings[s].currentHeight != shutterSettings[s].heightDown &&
                                                                shutterSettings[s].currentAction == '') {

                                                                shutterSettings[s].currentAction = 'sunProtect';

                                                                await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true }).catch((e) => adapter.log.warn(e));

                                                                adapter.log.debug(shutterSettings[s].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + Math.round(_shutterState.val / vRound) * vRound + ' HeightDownSun:' + heightDownSun);
                                                            }
                                                        }
                                                    } else {
                                                        adapter.log.info('SunProtect not moving down now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%');
                                                        shutterSettings[s].alarmTriggerLevel = parseFloat(heightDownSun);
                                                        shutterSettings[s].alarmTriggerAction = 'sunProtect';
                                                    }
                                                }
                                            }
                                        }
                                        if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                            if (insideTemp > shutterSettings[s].tempInside) {
                                                if (shutterSettings[s].tempOutside < outsideTemp &&
                                                    (shutterSettings[s].lightSensor != '' &&
                                                        shutterSettings[s].valueLight < sunLight ||
                                                        shutterSettings[s].lightSensor == '') &&
                                                    shutterSettings[s].triggerAction != 'sunProtect' &&
                                                    shutterSettings[s].triggerAction != 'OpenInSunProtect' &&
                                                    shutterSettings[s].triggerAction != 'Manu_Mode') {

                                                    if (pendingAlarm == false) {
                                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                        if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                            adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + Math.round(_shutterState.val / vRound) * vRound + ' > HeightDownSun: ' + heightDownSun + ' AND Height:' + Math.round(_shutterState.val / vRound) * vRound + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp + ' AND triggerAction:' + shutterSettings[s].triggerAction + ' != down ');

                                                            if (((Math.round(parseFloat(_shutterState.val) / vRound) * vRound > parseFloat(heightDownSun) &&
                                                                convertShutter == false) ||
                                                                (Math.round(parseFloat(_shutterState.val) / vRound) * vRound < parseFloat(heightDownSun) &&
                                                                    convertShutter == true)) &&
                                                                Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) &&
                                                                shutterSettings[s].currentHeight == shutterSettings[s].heightUp &&
                                                                shutterSettings[s].triggerAction != 'down' &&
                                                                shutterSettings[s].currentAction != 'middle' &&
                                                                shutterSettings[s].currentAction != 'Xmas') {

                                                                shutterSettings[s].triggerHeight = parseFloat(heightDownSun);
                                                                shutterSettings[s].triggerAction = 'sunProtect';

                                                                adapter.log.info(' Will sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%' + ' after the window has been closed ');
                                                                adapter.log.debug('save new trigger height: ' + heightDownSun + '%');
                                                                adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                            }

                                                        }
                                                    } else {
                                                        adapter.log.info('SunProtect not moving down now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%');
                                                        shutterSettings[s].alarmTriggerLevel = parseFloat(heightDownSun);
                                                        shutterSettings[s].alarmTriggerAction = 'sunProtect';
                                                    }
                                                }
                                            }
                                        }
                                        if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyDown') || (shutterSettings[s].triggerID == '')) {
                                            const hysteresisOutside = (((100 - shutterSettings[s].hysteresisOutside) / 100) * shutterSettings[s].tempOutside).toFixed(2);
                                            const hysteresisInside = (((100 - shutterSettings[s].hysteresisInside) / 100) * shutterSettings[s].tempInside).toFixed(2);
                                            const hysteresisLight = (((100 - shutterSettings[s].hysteresisLight) / 100) * shutterSettings[s].valueLight).toFixed(2);

                                            if (shutterSettings[s].sunProtectEndtimerid === '' &&
                                                shutterSettings[s].lightSensor != '' &&
                                                parseFloat(hysteresisLight) > sunLight &&
                                                (shutterSettings[s].currentAction == 'sunProtect' || (shutterSettings[s].currentAction == 'triggered' && shutterSettings[s].lastAutoAction == 'down_Sunprotect')) &&
                                                shutterSettings[s].KeepSunProtect === false) {

                                                adapter.log.debug(`#1 Started sunprotect end delay for ${shutterSettings[s].shutterName} with ${shutterSettings[s].sunProtectEndDely * 60000} minutes`);
                                                shutterSettings[s].sunProtectEndtimerid = setTimeout(async function () {
                                                    adapter.log.debug(`#1.1 End sunprotect delay for ${shutterSettings[s].shutterName}`);
                                                    shutterSettings[s].sunProtectEndtimerid = '0';
                                                }, shutterSettings[s].sunProtectEndDely * 60000, s);
                                            }
                                            if (insideTemp < parseFloat(hysteresisInside) || (parseFloat(hysteresisOutside) > outsideTemp || shutterSettings[s].lightSensor != '' && parseFloat(hysteresisLight) > sunLight && shutterSettings[s].sunProtectEndtimerid === '0') || (parseFloat(hysteresisOutside) > outsideTemp && shutterSettings[s].lightSensor == '')) {

                                                if (pendingAlarm == false) {
                                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                        if (shutterSettings[s].currentAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(heightDownSun) || Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight))) {
                                                            shutterSettings[s].sunProtectEndtimerid = '';
                                                            shutterSettings[s].currentAction = 'up';
                                                            shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                                            shutterSettings[s].lastAutoAction = 'up_Sunprotect_end';

                                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].heightUp), nameDevice, 'Sunprotect #411');

                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active');
                                                            adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                            adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + heightDownSun + '%')
                                                        }
                                                        else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                            shutterSettings[s].sunProtectEndtimerid = ''
                                                            shutterSettings[s].currentAction = 'none';

                                                            await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true }).catch((e) => adapter.log.warn(e));

                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
                                                        }
                                                    }
                                                } else if (shutterSettings[s].alarmTriggerAction == 'sunProtect') {
                                                    adapter.log.info('SunProtect not moving up now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%');
                                                    shutterSettings[s].sunProtectEndtimerid = '';
                                                    shutterSettings[s].alarmTriggerLevel = parseFloat(shutterSettings[s].heightUp);
                                                    shutterSettings[s].alarmTriggerAction = 'up';
                                                }
                                            }
                                        }
                                        if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                            const hysteresisOutside = (((100 - shutterSettings[s].hysteresisOutside) / 100) * shutterSettings[s].tempOutside).toFixed(2);
                                            const hysteresisInside = (((100 - shutterSettings[s].hysteresisInside) / 100) * shutterSettings[s].tempInside).toFixed(2);
                                            const hysteresisLight = (((100 - shutterSettings[s].hysteresisLight) / 100) * shutterSettings[s].valueLight).toFixed(2);

                                            if (shutterSettings[s].sunProtectEndtimerid === '' &&
                                                shutterSettings[s].lightSensor != '' &&
                                                parseFloat(hysteresisLight) > sunLight &&
                                                (shutterSettings[s].currentAction == 'sunProtect' || (shutterSettings[s].currentAction == 'triggered' && shutterSettings[s].lastAutoAction == 'down_Sunprotect')) &&
                                                shutterSettings[s].KeepSunProtect === false) {
                                                adapter.log.debug(`#2 Started sunprotect end delay for ${shutterSettings[s].shutterName} with ${shutterSettings[s].sunProtectEndDely * 60000} minutes`);
                                                shutterSettings[s].sunProtectEndtimerid = setTimeout(async function () {
                                                    adapter.log.debug(`#2.1 End sunprotect delay for ${shutterSettings[s].shutterName}`);
                                                    shutterSettings[s].sunProtectEndtimerid = '0';
                                                }, shutterSettings[s].sunProtectEndDely * 60000, s);
                                            }
                                            if (insideTemp < parseFloat(hysteresisInside) || (parseFloat(hysteresisOutside) > outsideTemp || shutterSettings[s].lightSensor != '' && parseFloat(hysteresisLight) > sunLight && shutterSettings[s].sunProtectEndtimerid === '0') || (parseFloat(hysteresisOutside) > outsideTemp && shutterSettings[s].lightSensor == '')) {

                                                if (pendingAlarm == false) {
                                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                        if (shutterSettings[s].triggerAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (parseFloat(shutterSettings[s].triggerHeight) == parseFloat(heightDownSun) || Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight))) {
                                                            shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].heightUp);
                                                            shutterSettings[s].triggerAction = 'up';

                                                            adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%' + ' after the window has been closed ');

                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active anymore');
                                                            adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                            adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                        }
                                                        else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                            shutterSettings[s].sunProtectEndtimerid = ''
                                                            shutterSettings[s].triggerAction = 'none';
                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
                                                        }
                                                    }
                                                } else if (shutterSettings[s].alarmTriggerAction == 'sunProtect') {
                                                    adapter.log.info('SunProtect not moving up now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%');
                                                    shutterSettings[s].sunProtectEndtimerid = '';
                                                    shutterSettings[s].alarmTriggerLevel = parseFloat(shutterSettings[s].heightUp);
                                                    shutterSettings[s].alarmTriggerAction = 'up';
                                                }
                                            }
                                        }
                                    }
                                    await sleep(driveDelayUpSleep);
                                    break;

                                //////////////////////////////////////////////////////////////////////////////////////////////////////

                                // +++++++++++++++++ sunprotect with in/outside temperature, Lightsensor and direction +++++++++++++++

                                case 'in- & outside temperature and direction': // in- & outside temperature and direction
                                    resultDirectionRangeMinus = parseInt(shutterSettings[s].direction) - parseInt(shutterSettings[s].directionRange);
                                    resultDirectionRangePlus = parseInt(shutterSettings[s].direction) + parseInt(shutterSettings[s].directionRange);

                                    _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;
                                    mustValue = ('' + shutterSettings[s].triggerState);
                                    mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                    if (typeof _triggerState != undefined && _triggerState != null && _triggerState.val != undefined) {
                                        currentValue = ('' + _triggerState.val);
                                    }

                                    if ((currentValue === mustValue || currentValue === mustValueTilted) && shutterSettings[s].tempSensor != '' || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'off' && shutterSettings[s].tempSensor != '') || (shutterSettings[s].triggerID == '' && shutterSettings[s].tempSensor != '')) {
                                        let insideTemp = 0;
                                        let outsideTemp = 0;
                                        let sunLight = 0;

                                        const _insideTempState = shutterSettings[s].tempSensor != '' ? await adapter.getForeignStateAsync(shutterSettings[s].tempSensor).catch((e) => adapter.log.warn(e)) : null;
                                        if (typeof _insideTempState != undefined && _insideTempState != null && _insideTempState.val != undefined) {
                                            insideTemp = parseFloat(_insideTempState.val);
                                        }

                                        const _outsideTempState = shutterSettings[s].outsideTempSensor != '' ? await adapter.getForeignStateAsync(shutterSettings[s].outsideTempSensor).catch((e) => adapter.log.warn(e)) : null;
                                        if (typeof _outsideTempState != undefined && _outsideTempState != null && _outsideTempState.val != undefined) {
                                            outsideTemp = parseFloat(_outsideTempState.val);
                                        }

                                        // heatProtection
                                        if (shutterSettings[s].heatProtection == true && shutterSettings[s].tempHeatProtection < outsideTemp && shutterSettings[s].currentHeight != shutterSettings[s].heightDown) {
                                            shutterSettings[s].currentAction = shutterSettings[s].currentAction == 'sunProtect' ? '' : shutterSettings[s].currentAction;
                                            heightDownSun = shutterSettings[s].heightDown;
                                            adapter.log.debug(`Heat Protection for ${shutterSettings[s].shutterName} is active`);
                                        } else {
                                            heightDownSun = shutterSettings[s].heightDownSun;
                                        }

                                        const _sunLight = shutterSettings[s].lightSensor != '' ? await adapter.getForeignStateAsync(shutterSettings[s].lightSensor).catch((e) => adapter.log.warn(e)) : null;
                                        if (typeof _sunLight != undefined && _sunLight != null && _sunLight.val != undefined) {
                                            sunLight = parseFloat(_sunLight.val);
                                        }

                                        if (shutterSettings[s].sunProtectEndtimerid != '' && shutterSettings[s].sunProtectEndtimerid != '0' && shutterSettings[s].lightSensor != '' && shutterSettings[s].valueLight < sunLight) {
                                            adapter.log.debug('Stopping sunprotect delay for ' + shutterSettings[s].shutterName);
                                            clearTimeout(shutterSettings[s].sunProtectEndtimerid);
                                            shutterSettings[s].sunProtectEndtimerid = '';
                                        }

                                        if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyUp') || (shutterSettings[s].triggerID == '')) {
                                            if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth && insideTemp > shutterSettings[s].tempInside) {
                                                if (shutterSettings[s].tempOutside < outsideTemp && (shutterSettings[s].lightSensor != '' && shutterSettings[s].valueLight < sunLight || shutterSettings[s].lightSensor == '') && shutterSettings[s].currentAction != 'sunProtect' && shutterSettings[s].currentAction != 'OpenInSunProtect' && shutterSettings[s].currentAction != 'Manu_Mode') {
                                                    if (pendingAlarm == false) {
                                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                        if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                            adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + Math.round(_shutterState.val / vRound) * vRound + ' > HeightDownSun: ' + heightDownSun + ' AND Height:' + Math.round(_shutterState.val / vRound) * vRound + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp);

                                                            if (((Math.round(parseFloat(_shutterState.val) / vRound) * vRound > parseFloat(heightDownSun) && convertShutter == false) ||
                                                                (Math.round(parseFloat(_shutterState.val) / vRound) * vRound < parseFloat(heightDownSun) && convertShutter == true)) && Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) &&
                                                                (shutterSettings[s].currentHeight == shutterSettings[s].heightUp || (shutterSettings[s].heatProtection == true && shutterSettings[s].tempHeatProtection < outsideTemp))) {

                                                                shutterSettings[s].currentAction = 'sunProtect';
                                                                shutterSettings[s].currentHeight = heightDownSun;
                                                                shutterSettings[s].lastAutoAction = 'down_Sunprotect';

                                                                await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(heightDownSun), nameDevice, 'Sunprotect #412');

                                                                adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is active');
                                                                adapter.log.debug('Temperature inside: ' + insideTemp + ' > ' + shutterSettings[s].tempInside + ' AND ( Temperatur outside: ' + outsideTemp + ' > ' + shutterSettings[s].tempOutside + ' AND Light: ' + sunLight + ' > ' + shutterSettings[s].valueLight + ' )');
                                                                adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + heightDownSun + '%');
                                                                adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                                adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + heightDownSun + '%')
                                                            }
                                                            // Shutter closed. Set currentAction = sunProtect when sunProtect starts => 
                                                            // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                            else if (Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].heightDown) && Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentAction != 'down' && shutterSettings[s].currentAction != 'middle' && shutterSettings[s].currentAction != 'Xmas' && shutterSettings[s].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                shutterSettings[s].currentAction = 'OpenInSunProtect';
                                                                adapter.log.debug('Set sunprotect mode for ' + shutterSettings[s].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                            }
                                                            // Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set -> 
                                                            // set sunProtect again
                                                            else if (Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(heightDownSun) && Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentHeight != shutterSettings[s].heightDown && shutterSettings[s].currentAction == '') {
                                                                shutterSettings[s].currentAction = 'sunProtect';

                                                                await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true }).catch((e) => adapter.log.warn(e));

                                                                adapter.log.debug(shutterSettings[s].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + Math.round(_shutterState.val / vRound) * vRound + ' HeightDownSun:' + heightDownSun);
                                                            }
                                                        }
                                                    } else {
                                                        adapter.log.info('SunProtect not moving down now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%');
                                                        shutterSettings[s].alarmTriggerLevel = parseFloat(heightDownSun);
                                                        shutterSettings[s].alarmTriggerAction = 'sunProtect';
                                                    }
                                                }
                                            }
                                        }
                                        if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                            if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth && insideTemp > shutterSettings[s].tempInside) {
                                                if (shutterSettings[s].tempOutside < outsideTemp && (shutterSettings[s].lightSensor != '' && shutterSettings[s].valueLight < sunLight || shutterSettings[s].lightSensor == '') && shutterSettings[s].triggerAction != 'sunProtect' && shutterSettings[s].triggerAction != 'OpenInSunProtect' && shutterSettings[s].triggerAction != 'Manu_Mode') {
                                                    if (pendingAlarm == false) {
                                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                        if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                            adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + Math.round(_shutterState.val / vRound) * vRound + ' > HeightDownSun: ' + heightDownSun + ' AND Height:' + Math.round(_shutterState.val / vRound) * vRound + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp + ' AND triggerAction:' + shutterSettings[s].triggerAction + ' != down ');
                                                            if (((Math.round(parseFloat(_shutterState.val) / vRound) * vRound > parseFloat(heightDownSun) && convertShutter == false) || (Math.round(parseFloat(_shutterState.val) / vRound) * vRound < parseFloat(heightDownSun) && convertShutter == true)) && Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp && shutterSettings[s].triggerAction != 'down' && shutterSettings[s].currentAction != 'middle' && shutterSettings[s].currentAction != 'Xmas') {
                                                                shutterSettings[s].triggerHeight = parseFloat(heightDownSun);
                                                                shutterSettings[s].triggerAction = 'sunProtect';

                                                                adapter.log.info(' Will sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%' + ' after the window has been closed ');

                                                                adapter.log.debug('save new trigger height: ' + heightDownSun + '%');
                                                                adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                            }
                                                        }
                                                    } else {
                                                        shutterSettings[s].alarmTriggerLevel = parseFloat(heightDownSun);
                                                        shutterSettings[s].alarmTriggerAction = 'sunProtect';

                                                        adapter.log.info('SunProtect not moving down now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%');
                                                    }
                                                }
                                            }
                                        }
                                        if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyDown') || (shutterSettings[s].triggerID == '')) {
                                            const hysteresisOutside = (((100 - shutterSettings[s].hysteresisOutside) / 100) * shutterSettings[s].tempOutside).toFixed(2);
                                            const hysteresisInside = (((100 - shutterSettings[s].hysteresisInside) / 100) * shutterSettings[s].tempInside).toFixed(2);
                                            const hysteresisLight = (((100 - shutterSettings[s].hysteresisLight) / 100) * shutterSettings[s].valueLight).toFixed(2);

                                            if (shutterSettings[s].sunProtectEndtimerid === '' &&
                                                shutterSettings[s].lightSensor != '' &&
                                                parseFloat(hysteresisLight) > sunLight &&
                                                (shutterSettings[s].currentAction == 'sunProtect' || (shutterSettings[s].currentAction == 'triggered' && shutterSettings[s].lastAutoAction == 'down_Sunprotect')) &&
                                                shutterSettings[s].KeepSunProtect === false) {
                                                adapter.log.debug(`#3 Started sunprotect end delay for ${shutterSettings[s].shutterName} with ${shutterSettings[s].sunProtectEndDely * 60000} minutes`);
                                                shutterSettings[s].sunProtectEndtimerid = setTimeout(async function () {
                                                    adapter.log.debug(`#3.1 End sunprotect delay for ${shutterSettings[s].shutterName}`);
                                                    shutterSettings[s].sunProtectEndtimerid = '0';
                                                }, shutterSettings[s].sunProtectEndDely * 60000, s);
                                            }

                                            if (insideTemp < parseFloat(hysteresisInside) || (resultDirectionRangePlus) < azimuth || (parseFloat(hysteresisOutside) > outsideTemp || shutterSettings[s].lightSensor != '' && parseFloat(hysteresisLight) > sunLight && shutterSettings[s].sunProtectEndtimerid === '0') || (parseFloat(hysteresisOutside) > outsideTemp && shutterSettings[s].lightSensor == '')) {

                                                if (pendingAlarm == false) {
                                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                        if (shutterSettings[s].currentAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(heightDownSun) || Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight))) {
                                                            shutterSettings[s].sunProtectEndtimerid = '';
                                                            shutterSettings[s].currentAction = 'up';
                                                            shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                                            shutterSettings[s].lastAutoAction = 'up_Sunprotect_end';

                                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].heightUp), nameDevice, 'Sunprotect #413');

                                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active');
                                                            adapter.log.debug('Range: ' + resultDirectionRangePlus + ' < ' + azimuth + ' OR Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ')');
                                                            adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightUp + '%');
                                                        }
                                                        else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                            shutterSettings[s].sunProtectEndtimerid = ''
                                                            shutterSettings[s].currentAction = 'none';

                                                            await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true }).catch((e) => adapter.log.warn(e));

                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
                                                        }
                                                    }
                                                } else if (shutterSettings[s].alarmTriggerAction == 'sunProtect') {
                                                    shutterSettings[s].sunProtectEndtimerid = '';
                                                    shutterSettings[s].alarmTriggerLevel = parseFloat(shutterSettings[s].heightUp);
                                                    shutterSettings[s].alarmTriggerAction = 'up';

                                                    adapter.log.info('SunProtect not moving up now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%');
                                                }
                                            }
                                        }
                                        if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                            const hysteresisOutside = (((100 - shutterSettings[s].hysteresisOutside) / 100) * shutterSettings[s].tempOutside).toFixed(2);
                                            const hysteresisInside = (((100 - shutterSettings[s].hysteresisInside) / 100) * shutterSettings[s].tempInside).toFixed(2);
                                            const hysteresisLight = (((100 - shutterSettings[s].hysteresisLight) / 100) * shutterSettings[s].valueLight).toFixed(2);

                                            if (shutterSettings[s].sunProtectEndtimerid === '' &&
                                                shutterSettings[s].lightSensor != '' &&
                                                parseFloat(hysteresisLight) > sunLight &&
                                                (shutterSettings[s].currentAction == 'sunProtect' || (shutterSettings[s].currentAction == 'triggered' && shutterSettings[s].lastAutoAction == 'down_Sunprotect')) &&
                                                shutterSettings[s].KeepSunProtect === false) {
                                                adapter.log.debug(`#4 Started sunprotect end delay for ${shutterSettings[s].shutterName} with ${shutterSettings[s].sunProtectEndDely * 60000} minutes`);
                                                shutterSettings[s].sunProtectEndtimerid = setTimeout(async function () {
                                                    adapter.log.debug(`#4.1 End sunprotect delay for ${shutterSettings[s].shutterName}`);
                                                    shutterSettings[s].sunProtectEndtimerid = '0';
                                                }, shutterSettings[s].sunProtectEndDely * 60000, s);
                                            }
                                            if (insideTemp < parseFloat(hysteresisInside) || (resultDirectionRangePlus) < azimuth || (parseFloat(hysteresisOutside) > outsideTemp || shutterSettings[s].lightSensor != '' && parseFloat(hysteresisLight) > sunLight && shutterSettings[s].sunProtectEndtimerid === '0') || (parseFloat(hysteresisOutside) > outsideTemp && shutterSettings[s].lightSensor == '')) {

                                                if (pendingAlarm == false) {
                                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                        if (shutterSettings[s].triggerAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (parseFloat(shutterSettings[s].triggerHeight) == parseFloat(heightDownSun) || Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight))) {
                                                            shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].heightUp);
                                                            shutterSettings[s].triggerAction = 'up';

                                                            adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%' + ' after the window has been closed ');

                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active anymore');
                                                            adapter.log.debug('Temperature inside: ' + insideTemp + ' < ' + hysteresisInside + ' OR ( Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight + ' )');
                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                            adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                        }
                                                        else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                            shutterSettings[s].triggerAction = 'none';

                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
                                                        }
                                                    }
                                                } else if (shutterSettings[s].alarmTriggerAction == 'sunProtect') {
                                                    shutterSettings[s].sunProtectEndtimerid = '';
                                                    shutterSettings[s].alarmTriggerLevel = parseFloat(shutterSettings[s].heightUp);
                                                    shutterSettings[s].alarmTriggerAction = 'up';

                                                    adapter.log.info('SunProtect not moving up now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%');
                                                }
                                            }
                                        }
                                    }
                                    await sleep(driveDelayUpSleep);
                                    break;

                                //////////////////////////////////////////////////////////////////////////////////////////////////////

                                // +++++++++++++++++ sunprotect with outside temperature, Lightsensor and direction +++++++++++++++

                                case 'outside temperature and direction': //outside temperature and direction
                                    resultDirectionRangeMinus = parseInt(shutterSettings[s].direction) - parseInt(shutterSettings[s].directionRange);
                                    resultDirectionRangePlus = parseInt(shutterSettings[s].direction) + parseInt(shutterSettings[s].directionRange);

                                    _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;
                                    mustValue = ('' + shutterSettings[s].triggerState);
                                    mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                    if (typeof _triggerState != undefined && _triggerState != null && _triggerState.val != undefined) {
                                        currentValue = ('' + _triggerState.val);
                                    }

                                    if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'off') || (shutterSettings[s].triggerID == '')) {
                                        let outsideTemp = 0;
                                        let sunLight = 0;

                                        const _outsideTempState = shutterSettings[s].outsideTempSensor != '' ? await adapter.getForeignStateAsync(shutterSettings[s].outsideTempSensor).catch((e) => adapter.log.warn(e)) : null;
                                        if (typeof _outsideTempState != undefined && _outsideTempState != null && _outsideTempState.val != undefined) {
                                            outsideTemp = parseFloat(_outsideTempState.val);
                                        }

                                        // heatProtection
                                        if (shutterSettings[s].heatProtection == true && shutterSettings[s].tempHeatProtection < outsideTemp && shutterSettings[s].currentHeight != shutterSettings[s].heightDown) {
                                            shutterSettings[s].currentAction = shutterSettings[s].currentAction == 'sunProtect' ? '' : shutterSettings[s].currentAction;
                                            heightDownSun = shutterSettings[s].heightDown;
                                            adapter.log.debug(`Heat Protection for ${shutterSettings[s].shutterName} is active`);
                                        } else {
                                            heightDownSun = shutterSettings[s].heightDownSun;
                                        }

                                        const _sunLight = shutterSettings[s].lightSensor != '' ? await adapter.getForeignStateAsync(shutterSettings[s].lightSensor).catch((e) => adapter.log.warn(e)) : null;
                                        if (typeof _sunLight != undefined && _sunLight != null && _sunLight.val != undefined) {
                                            sunLight = parseFloat(_sunLight.val);
                                        }

                                        if (shutterSettings[s].sunProtectEndtimerid != '' && shutterSettings[s].sunProtectEndtimerid != '0' && shutterSettings[s].lightSensor != '' && shutterSettings[s].valueLight < sunLight) {
                                            adapter.log.debug('Stopping sunprotect delay for ' + shutterSettings[s].shutterName);
                                            clearTimeout(shutterSettings[s].sunProtectEndtimerid);
                                            shutterSettings[s].sunProtectEndtimerid = '';
                                        }

                                        if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyUp') || (shutterSettings[s].triggerID == '')) {
                                            if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth) {
                                                if (shutterSettings[s].tempOutside < outsideTemp && (shutterSettings[s].lightSensor != '' && shutterSettings[s].valueLight < sunLight || shutterSettings[s].lightSensor == '') && shutterSettings[s].currentAction != 'sunProtect' && shutterSettings[s].currentAction != 'OpenInSunProtect' && shutterSettings[s].currentAction != 'Manu_Mode') {
                                                    if (pendingAlarm == false) {
                                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                        if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                            adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + Math.round(_shutterState.val / vRound) * vRound + ' > HeightDownSun: ' + heightDownSun + ' AND Height:' + Math.round(_shutterState.val / vRound) * vRound + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp);

                                                            if (((Math.round(parseFloat(_shutterState.val) / vRound) * vRound > parseFloat(heightDownSun) && convertShutter == false) ||
                                                                (Math.round(parseFloat(_shutterState.val) / vRound) * vRound < parseFloat(heightDownSun) && convertShutter == true)) && Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) &&
                                                                (shutterSettings[s].currentHeight == shutterSettings[s].heightUp || (shutterSettings[s].heatProtection == true && shutterSettings[s].tempHeatProtection < outsideTemp))) {

                                                                shutterSettings[s].currentAction = 'sunProtect';
                                                                shutterSettings[s].currentHeight = heightDownSun;
                                                                shutterSettings[s].lastAutoAction = 'down_Sunprotect';

                                                                await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(heightDownSun), nameDevice, 'Sunprotect #414');

                                                                adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                                adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is active');
                                                                adapter.log.debug('Temperatur outside: ' + outsideTemp + ' > ' + shutterSettings[s].tempOutside + ' AND Light: ' + sunLight + ' > ' + shutterSettings[s].valueLight);
                                                                adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + heightDownSun + '%')
                                                            }
                                                            // Shutter closed. Set currentAction = sunProtect when sunProtect starts => 
                                                            // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                            else if (Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].heightDown) && Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentAction != 'down' && shutterSettings[s].currentAction != 'middle' && shutterSettings[s].currentAction != 'Xmas' && shutterSettings[s].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                                shutterSettings[s].currentAction = 'OpenInSunProtect';

                                                                await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true }).catch((e) => adapter.log.warn(e));

                                                                adapter.log.debug('Set sunprotect mode for ' + shutterSettings[s].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                            }
                                                            // Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set ->
                                                            // set sunProtect again
                                                            else if (Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(heightDownSun) && Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentHeight != shutterSettings[s].heightDown && shutterSettings[s].currentAction == '') {
                                                                shutterSettings[s].currentAction = 'sunProtect';

                                                                await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true }).catch((e) => adapter.log.warn(e));

                                                                adapter.log.debug(shutterSettings[s].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + Math.round(_shutterState.val / vRound) * vRound + ' HeightDownSun:' + heightDownSun);
                                                            }
                                                        }
                                                    } else {
                                                        shutterSettings[s].alarmTriggerLevel = parseFloat(heightDownSun);
                                                        shutterSettings[s].alarmTriggerAction = 'sunProtect';

                                                        adapter.log.info('SunProtect not moving down now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%');
                                                    }
                                                }
                                            }
                                        }
                                        if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                            if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth) {
                                                if (shutterSettings[s].tempOutside < outsideTemp && (shutterSettings[s].lightSensor != '' && shutterSettings[s].valueLight < sunLight || shutterSettings[s].lightSensor == '') && shutterSettings[s].triggerAction != 'sunProtect' && shutterSettings[s].triggerAction != 'OpenInSunProtect' && shutterSettings[s].triggerAction != 'Manu_Mode') {
                                                    if (pendingAlarm == false) {
                                                        const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                        if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                            adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + Math.round(_shutterState.val / vRound) * vRound + ' > HeightDownSun: ' + heightDownSun + ' AND Height:' + Math.round(_shutterState.val / vRound) * vRound + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp);
                                                            if (((Math.round(parseFloat(_shutterState.val) / vRound) * vRound > parseFloat(heightDownSun) && convertShutter == false) || (Math.round(parseFloat(_shutterState.val) / vRound) * vRound < parseFloat(heightDownSun) && convertShutter == true)) && Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp && shutterSettings[s].triggerAction != 'down' && shutterSettings[s].currentAction != 'middle' && shutterSettings[s].currentAction != 'Xmas') {
                                                                shutterSettings[s].triggerHeight = parseFloat(heightDownSun);
                                                                shutterSettings[s].triggerAction = 'sunProtect';

                                                                adapter.log.info(' Will sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%' + ' after the window has been closed ');

                                                                adapter.log.debug('save new trigger height: ' + heightDownSun + '%');
                                                                adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                            }

                                                        }
                                                    } else {
                                                        shutterSettings[s].alarmTriggerLevel = parseFloat(heightDownSun);
                                                        shutterSettings[s].alarmTriggerAction = 'sunProtect';

                                                        adapter.log.info('SunProtect not moving down now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%');
                                                    }
                                                }
                                            }
                                        }
                                        if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyDown') || (shutterSettings[s].triggerID == '')) {
                                            const hysteresisOutside = (((100 - shutterSettings[s].hysteresisOutside) / 100) * shutterSettings[s].tempOutside).toFixed(2);
                                            const hysteresisLight = (((100 - shutterSettings[s].hysteresisLight) / 100) * shutterSettings[s].valueLight).toFixed(2);

                                            if (shutterSettings[s].sunProtectEndtimerid === '' &&
                                                shutterSettings[s].lightSensor != '' &&
                                                parseFloat(hysteresisLight) > sunLight &&
                                                (shutterSettings[s].currentAction == 'sunProtect' || (shutterSettings[s].currentAction == 'triggered' && shutterSettings[s].lastAutoAction == 'down_Sunprotect')) &&
                                                shutterSettings[s].KeepSunProtect === false) {
                                                adapter.log.debug(`#5 Started sunprotect end delay for ${shutterSettings[s].shutterName} with ${shutterSettings[s].sunProtectEndDely * 60000} minutes`);
                                                shutterSettings[s].sunProtectEndtimerid = setTimeout(async function () {
                                                    adapter.log.debug(`#5.1 End sunprotect delay for ${shutterSettings[s].shutterName}`);
                                                    shutterSettings[s].sunProtectEndtimerid = '0';
                                                }, shutterSettings[s].sunProtectEndDely * 60000, s);
                                            }

                                            if (resultDirectionRangePlus < azimuth ||
                                                (parseFloat(hysteresisOutside) > outsideTemp || shutterSettings[s].lightSensor != '' && parseFloat(hysteresisLight) > sunLight && shutterSettings[s].sunProtectEndtimerid === '0') ||
                                                (parseFloat(hysteresisOutside) > outsideTemp && shutterSettings[s].lightSensor == '')) {
                                                if (pendingAlarm == false) {
                                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                        if (shutterSettings[s].currentAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(heightDownSun) || Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight))) {
                                                            shutterSettings[s].sunProtectEndtimerid = '';
                                                            shutterSettings[s].currentAction = 'up';
                                                            shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                                            shutterSettings[s].lastAutoAction = 'up_Sunprotect_end';

                                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].heightUp), nameDevice, 'Sunprotect #415');

                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active');
                                                            adapter.log.debug('Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight);
                                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                            adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightUp + '%')
                                                        }
                                                        else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                            shutterSettings[s].currentAction = 'none';

                                                            await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true }).catch((e) => adapter.log.warn(e));

                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
                                                        }
                                                    }
                                                } else if (shutterSettings[s].alarmTriggerAction == 'sunProtect') {
                                                    shutterSettings[s].sunProtectEndtimerid = '';
                                                    shutterSettings[s].alarmTriggerLevel = parseFloat(shutterSettings[s].heightUp);
                                                    shutterSettings[s].alarmTriggerAction = 'up';

                                                    adapter.log.info('SunProtect not moving up now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%');
                                                }
                                            }
                                        }
                                        if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                            const hysteresisOutside = (((100 - shutterSettings[s].hysteresisOutside) / 100) * shutterSettings[s].tempOutside).toFixed(2);
                                            const hysteresisLight = (((100 - shutterSettings[s].hysteresisLight) / 100) * shutterSettings[s].valueLight).toFixed(2);

                                            if (shutterSettings[s].sunProtectEndtimerid === '' &&
                                                shutterSettings[s].lightSensor != '' &&
                                                parseFloat(hysteresisLight) > sunLight &&
                                                (shutterSettings[s].currentAction == 'sunProtect' || (shutterSettings[s].currentAction == 'triggered' && shutterSettings[s].lastAutoAction == 'down_Sunprotect')) &&
                                                shutterSettings[s].KeepSunProtect === false) {
                                                adapter.log.debug(`#6 Started sunprotect end delay for ${shutterSettings[s].shutterName} with ${shutterSettings[s].sunProtectEndDely * 60000} minutes`);
                                                shutterSettings[s].sunProtectEndtimerid = setTimeout(async function () {
                                                    adapter.log.debug(`#6.1 End sunprotect delay for ${shutterSettings[s].shutterName}`);
                                                    shutterSettings[s].sunProtectEndtimerid = '0';
                                                }, shutterSettings[s].sunProtectEndDely * 60000, s);
                                            }
                                            if ((resultDirectionRangePlus) < azimuth || (parseFloat(hysteresisOutside) > outsideTemp || shutterSettings[s].lightSensor != '' && parseFloat(hysteresisLight) > sunLight && shutterSettings[s].sunProtectEndtimerid === '0') || (parseFloat(hysteresisOutside) > outsideTemp && shutterSettings[s].lightSensor == '')) {
                                                if (pendingAlarm == false) {
                                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                        if (shutterSettings[s].triggerAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (parseFloat(shutterSettings[s].triggerHeight) == parseFloat(heightDownSun) || Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight))) {
                                                            shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].heightUp);
                                                            shutterSettings[s].triggerAction = 'up';

                                                            adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%' + ' after the window has been closed ');

                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active anymore');
                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                            adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                        }
                                                        else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                            shutterSettings[s].sunProtectEndtimerid = ''
                                                            shutterSettings[s].triggerAction = 'none';

                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
                                                        }
                                                    }
                                                } else if (shutterSettings[s].alarmTriggerAction == 'sunProtect') {
                                                    shutterSettings[s].sunProtectEndtimerid = '';
                                                    shutterSettings[s].alarmTriggerLevel = parseFloat(shutterSettings[s].heightUp);
                                                    shutterSettings[s].alarmTriggerAction = 'up';

                                                    adapter.log.info('SunProtect not moving up now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%');
                                                }
                                            }
                                        }
                                    }
                                    await sleep(driveDelayUpSleep);
                                    break;

                                //////////////////////////////////////////////////////////////////////////////////////////////////////

                                // ++++++++++++++++++++++++++++++ sunprotect with direction ++++++++++++++++++++++++++++++++++

                                case 'only direction': //only direction
                                    resultDirectionRangeMinus = parseInt(shutterSettings[s].direction) - parseInt(shutterSettings[s].directionRange);
                                    resultDirectionRangePlus = parseInt(shutterSettings[s].direction) + parseInt(shutterSettings[s].directionRange);

                                    _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;
                                    mustValue = ('' + shutterSettings[s].triggerState);
                                    mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                    if (typeof _triggerState != undefined && _triggerState != null && _triggerState.val != undefined) {
                                        currentValue = ('' + _triggerState.val);
                                    }

                                    if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'off') || (shutterSettings[s].triggerID == '')) {
                                        if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyUp') || (shutterSettings[s].triggerID == '')) {
                                            if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth && shutterSettings[s].currentAction != 'sunProtect' && shutterSettings[s].currentAction != 'OpenInSunProtect' && shutterSettings[s].currentAction != 'Manu_Mode') {
                                                if (pendingAlarm == false) {
                                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                        adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + Math.round(_shutterState.val / vRound) * vRound + ' > HeightDownSun: ' + heightDownSun + ' AND Height:' + Math.round(_shutterState.val / vRound) * vRound + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp);
                                                        if (((Math.round(parseFloat(_shutterState.val) / vRound) * vRound > parseFloat(heightDownSun) && convertShutter == false) || (Math.round(parseFloat(_shutterState.val) / vRound) * vRound < parseFloat(heightDownSun) && convertShutter == true)) && Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp) {
                                                            shutterSettings[s].currentAction = 'sunProtect';
                                                            shutterSettings[s].currentHeight = heightDownSun;
                                                            shutterSettings[s].lastAutoAction = 'down_Sunprotect';

                                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(heightDownSun), nameDevice, 'Sunprotect #416');

                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is active');
                                                            adapter.log.debug('RangeMinus: ' + resultDirectionRangeMinus + ' < ' + azimuth + 'RangePlus: ' + resultDirectionRangePlus + ' > ' + azimuth);
                                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                            adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + heightDownSun + '%');
                                                        }
                                                        // Shutter closed. Set currentAction = sunProtect when sunProtect starts => 
                                                        // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                        else if (Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].heightDown) && Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentAction != 'down' && shutterSettings[s].currentAction != 'middle' && shutterSettings[s].currentAction != 'Xmas' && shutterSettings[s].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                            shutterSettings[s].currentAction = 'OpenInSunProtect';

                                                            await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true }).catch((e) => adapter.log.warn(e));

                                                            adapter.log.debug('Set sunprotect mode for ' + shutterSettings[s].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                        }
                                                        // Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set ->
                                                        // set sunProtect again
                                                        else if (Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(heightDownSun) && Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentHeight != shutterSettings[s].heightDown && shutterSettings[s].currentAction == '') {
                                                            shutterSettings[s].currentAction = 'sunProtect';

                                                            await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true }).catch((e) => adapter.log.warn(e));

                                                            adapter.log.debug(shutterSettings[s].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + Math.round(_shutterState.val / vRound) * vRound + ' HeightDownSun:' + heightDownSun);
                                                        }
                                                    }
                                                } else {
                                                    shutterSettings[s].alarmTriggerLevel = parseFloat(heightDownSun);
                                                    shutterSettings[s].alarmTriggerAction = 'sunProtect';

                                                    adapter.log.info('SunProtect not moving down now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%');
                                                }
                                            }
                                        }
                                        if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                            if ((resultDirectionRangeMinus) < azimuth && (resultDirectionRangePlus) > azimuth && shutterSettings[s].triggerAction != 'sunProtect' && shutterSettings[s].triggerAction != 'OpenInSunProtect' && shutterSettings[s].triggerAction != 'Manu_Mode') {
                                                if (pendingAlarm == false) {
                                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                        adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + Math.round(_shutterState.val / vRound) * vRound + ' > HeightDownSun: ' + heightDownSun + ' AND Height:' + Math.round(_shutterState.val / vRound) * vRound + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp);
                                                        if (((Math.round(parseFloat(_shutterState.val) / vRound) * vRound > parseFloat(heightDownSun) && convertShutter == false) || (Math.round(parseFloat(_shutterState.val) / vRound) * vRound < parseFloat(heightDownSun) && convertShutter == true)) && Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp && shutterSettings[s].triggerAction != 'down' && shutterSettings[s].currentAction != 'middle' && shutterSettings[s].currentAction != 'Xmas') {
                                                            shutterSettings[s].triggerHeight = parseFloat(heightDownSun);
                                                            shutterSettings[s].triggerAction = 'sunProtect';

                                                            adapter.log.info(' Will sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%' + ' after the window has been closed ');

                                                            adapter.log.debug('save new trigger height: ' + heightDownSun + '%');
                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                        }
                                                    }
                                                } else {
                                                    shutterSettings[s].alarmTriggerLevel = parseFloat(heightDownSun);
                                                    shutterSettings[s].alarmTriggerAction = 'sunProtect';

                                                    adapter.log.info('SunProtect not moving down now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%');
                                                }

                                            }
                                        }
                                        if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyDown') || (shutterSettings[s].triggerID == '')) {
                                            if ((resultDirectionRangePlus) < azimuth) {
                                                if (pendingAlarm == false) {
                                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                        if (shutterSettings[s].currentAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(heightDownSun) || Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight))) {
                                                            shutterSettings[s].currentAction = 'up';
                                                            shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                                            shutterSettings[s].lastAutoAction = 'up_Sunprotect_end';

                                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].heightUp), nameDevice, 'Sunprotect #417');

                                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active');
                                                            adapter.log.debug('Range: ' + resultDirectionRangePlus + ' < ' + azimuth);
                                                            adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightUp + '%')
                                                        }
                                                        else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                            shutterSettings[s].currentAction = 'none';

                                                            await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true }).catch((e) => adapter.log.warn(e));

                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
                                                        }
                                                    }
                                                } else if (shutterSettings[s].alarmTriggerAction == 'sunProtect') {
                                                    shutterSettings[s].sunProtectEndtimerid = '';
                                                    shutterSettings[s].alarmTriggerLevel = parseFloat(shutterSettings[s].heightUp);
                                                    shutterSettings[s].alarmTriggerAction = 'up';

                                                    adapter.log.info('SunProtect not moving up now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%');
                                                }
                                            }
                                        }
                                        if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                            if ((resultDirectionRangePlus) < azimuth) {
                                                if (pendingAlarm == false) {
                                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                        if (shutterSettings[s].triggerAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (parseFloat(shutterSettings[s].triggerHeight) == parseFloat(heightDownSun) || Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight))) {
                                                            shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].heightUp);
                                                            shutterSettings[s].triggerAction = 'up';

                                                            adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%' + ' after the window has been closed ');

                                                            adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active anymore');
                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                        }
                                                        else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                            shutterSettings[s].triggerAction = 'none';

                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
                                                        }
                                                    }
                                                } else if (shutterSettings[s].alarmTriggerAction == 'sunProtect') {
                                                    shutterSettings[s].sunProtectEndtimerid = '';
                                                    shutterSettings[s].alarmTriggerLevel = parseFloat(shutterSettings[s].heightUp);
                                                    shutterSettings[s].alarmTriggerAction = 'up';

                                                    adapter.log.info('SunProtect not moving up now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%');
                                                }
                                            }
                                        }
                                    }
                                    await sleep(driveDelayUpSleep);
                                    break;

                                //////////////////////////////////////////////////////////////////////////////////////////////////////

                                // ++++++++++++++++++++++++ sunprotect with outside temperature and Lightsensor +++++++++++++++++++++++

                                case 'only outside temperature': //only outside temperature
                                    _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;
                                    mustValue = ('' + shutterSettings[s].triggerState);
                                    mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                    if (typeof _triggerState != undefined && _triggerState != null && _triggerState.val != undefined) {
                                        currentValue = ('' + _triggerState.val);
                                    }

                                    if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'off') || (shutterSettings[s].triggerID == '')) {
                                        let outsideTemp = 0;
                                        let sunLight = 0;

                                        const _outsideTempState = shutterSettings[s].outsideTempSensor != '' ? await adapter.getForeignStateAsync(shutterSettings[s].outsideTempSensor).catch((e) => adapter.log.warn(e)) : null;
                                        if (typeof _outsideTempState != undefined && _outsideTempState != null && _outsideTempState.val != undefined) {
                                            outsideTemp = parseFloat(_outsideTempState.val);
                                        }

                                        // heatProtection
                                        if (shutterSettings[s].heatProtection == true && shutterSettings[s].tempHeatProtection < outsideTemp && shutterSettings[s].currentHeight != shutterSettings[s].heightDown) {
                                            shutterSettings[s].currentAction = shutterSettings[s].currentAction == 'sunProtect' ? '' : shutterSettings[s].currentAction;
                                            heightDownSun = shutterSettings[s].heightDown;
                                            adapter.log.debug(`Heat Protection for ${shutterSettings[s].shutterName} is active`);
                                        } else {
                                            heightDownSun = shutterSettings[s].heightDownSun;
                                        }

                                        const _sunLight = shutterSettings[s].lightSensor != '' ? await adapter.getForeignStateAsync(shutterSettings[s].lightSensor).catch((e) => adapter.log.warn(e)) : null;
                                        if (typeof _sunLight != undefined && _sunLight != null && _sunLight.val != undefined) {
                                            sunLight = parseFloat(_sunLight.val);
                                        }

                                        if (shutterSettings[s].sunProtectEndtimerid != '' && shutterSettings[s].sunProtectEndtimerid != '0' && shutterSettings[s].lightSensor != '' && shutterSettings[s].valueLight < sunLight) {
                                            adapter.log.debug('Stopping sunprotect delay for ' + shutterSettings[s].shutterName);
                                            clearTimeout(shutterSettings[s].sunProtectEndtimerid);
                                            shutterSettings[s].sunProtectEndtimerid = '';
                                        }
                                        if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyUp') || (shutterSettings[s].triggerID == '')) {
                                            if (shutterSettings[s].tempOutside < outsideTemp && (shutterSettings[s].lightSensor != '' && shutterSettings[s].valueLight < sunLight || shutterSettings[s].lightSensor == '') && shutterSettings[s].currentAction != 'sunProtect' && shutterSettings[s].currentAction != 'OpenInSunProtect' && shutterSettings[s].currentAction != 'Manu_Mode') {
                                                if (pendingAlarm == false) {
                                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                        adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + Math.round(_shutterState.val / vRound) * vRound + ' > HeightDownSun: ' + heightDownSun + ' AND Height:' + Math.round(_shutterState.val / vRound) * vRound + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp);

                                                        if (((Math.round(parseFloat(_shutterState.val) / vRound) * vRound > parseFloat(heightDownSun) && convertShutter == false) ||
                                                            (Math.round(parseFloat(_shutterState.val) / vRound) * vRound < parseFloat(heightDownSun) && convertShutter == true)) && Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) &&
                                                            (shutterSettings[s].currentHeight == shutterSettings[s].heightUp || (shutterSettings[s].heatProtection == true && shutterSettings[s].tempHeatProtection < outsideTemp))) {

                                                            shutterSettings[s].currentAction = 'sunProtect';
                                                            shutterSettings[s].currentHeight = heightDownSun;
                                                            shutterSettings[s].lastAutoAction = 'down_Sunprotect';

                                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(heightDownSun), nameDevice, 'Sunprotect #418');

                                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is active');
                                                            adapter.log.debug('Temperature outside: ' + outsideTemp + ' > ' + shutterSettings[s].tempOutside + ' AND Light: ' + sunLight + ' > ' + shutterSettings[s].valueLight);
                                                            adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + heightDownSun + '%');
                                                        }
                                                        // Shutter closed. Set currentAction = sunProtect when sunProtect starts =>
                                                        // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                        else if (Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].heightDown) && Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentAction != 'down' && shutterSettings[s].currentAction != 'middle' && shutterSettings[s].currentAction != 'Xmas' && shutterSettings[s].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                            shutterSettings[s].currentAction = 'OpenInSunProtect';

                                                            await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true }).catch((e) => adapter.log.warn(e));

                                                            adapter.log.debug('Set sunprotect mode for ' + shutterSettings[s].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                        }
                                                        // Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set ->
                                                        // set sunProtect again
                                                        else if (Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(heightDownSun) && Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentHeight != shutterSettings[s].heightDown && shutterSettings[s].currentAction == '') {
                                                            shutterSettings[s].currentAction = 'sunProtect';

                                                            await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true }).catch((e) => adapter.log.warn(e));

                                                            adapter.log.debug(shutterSettings[s].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + Math.round(_shutterState.val / vRound) * vRound + ' HeightDownSun:' + heightDownSun);
                                                        }
                                                    }
                                                } else {
                                                    shutterSettings[s].alarmTriggerLevel = parseFloat(heightDownSun);
                                                    shutterSettings[s].alarmTriggerAction = 'sunProtect';

                                                    adapter.log.info('SunProtect not moving down now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%');
                                                }
                                            }
                                        }
                                        if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                            if (shutterSettings[s].tempOutside < outsideTemp && (shutterSettings[s].lightSensor != '' && shutterSettings[s].valueLight < sunLight || shutterSettings[s].lightSensor == '') && shutterSettings[s].triggerAction != 'sunProtect' && shutterSettings[s].triggerAction != 'OpenInSunProtect' && shutterSettings[s].triggerAction != 'Manu_Mode') {
                                                if (pendingAlarm == false) {
                                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                        adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + Math.round(_shutterState.val / vRound) * vRound + ' > HeightDownSun: ' + heightDownSun + ' AND Height:' + Math.round(_shutterState.val / vRound) * vRound + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp);

                                                        if (((Math.round(parseFloat(_shutterState.val) / vRound) * vRound > parseFloat(heightDownSun) && convertShutter == false) || (Math.round(parseFloat(_shutterState.val) / vRound) * vRound < parseFloat(heightDownSun) && convertShutter == true)) && Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp && shutterSettings[s].triggerAction != 'down' && shutterSettings[s].currentAction != 'middle' && shutterSettings[s].currentAction != 'Xmas') {
                                                            shutterSettings[s].triggerHeight = parseFloat(heightDownSun);
                                                            shutterSettings[s].triggerAction = 'sunProtect';

                                                            adapter.log.info(' Will sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%' + ' after the window has been closed ');

                                                            adapter.log.debug('save new trigger height: ' + heightDownSun + '%');
                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                        }
                                                    }
                                                } else {
                                                    shutterSettings[s].alarmTriggerLevel = parseFloat(heightDownSun);
                                                    shutterSettings[s].alarmTriggerAction = 'sunProtect';

                                                    adapter.log.info('SunProtect not moving down now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%');
                                                }

                                            }
                                        }
                                        if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyDown') || (shutterSettings[s].triggerID == '')) {

                                            const hysteresisOutside = (((100 - shutterSettings[s].hysteresisOutside) / 100) * shutterSettings[s].tempOutside).toFixed(2);
                                            const hysteresisLight = (((100 - shutterSettings[s].hysteresisLight) / 100) * shutterSettings[s].valueLight).toFixed(2);

                                            if (shutterSettings[s].sunProtectEndtimerid === '' &&
                                                shutterSettings[s].lightSensor != '' &&
                                                parseFloat(hysteresisLight) > sunLight &&
                                                (shutterSettings[s].currentAction == 'sunProtect' || (shutterSettings[s].currentAction == 'triggered' && shutterSettings[s].lastAutoAction == 'down_Sunprotect')) &&
                                                shutterSettings[s].KeepSunProtect === false) {
                                                adapter.log.debug(`#7 Started sunprotect end delay for ${shutterSettings[s].shutterName} with ${shutterSettings[s].sunProtectEndDely * 60000} minutes`);
                                                shutterSettings[s].sunProtectEndtimerid = setTimeout(async function () {
                                                    adapter.log.debug(`#7.1 End sunprotect delay for ${shutterSettings[s].shutterName}`);
                                                    shutterSettings[s].sunProtectEndtimerid = '0';
                                                }, shutterSettings[s].sunProtectEndDely * 60000, s);
                                            }
                                            if ((shutterSettings[s].lightSensor != '' && parseFloat(hysteresisLight) > sunLight && shutterSettings[s].sunProtectEndtimerid === '0') || (parseFloat(hysteresisOutside) > outsideTemp)) {
                                                if (pendingAlarm == false) {
                                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                        if (shutterSettings[s].currentAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(heightDownSun) || Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight))) {
                                                            shutterSettings[s].sunProtectEndtimerid = '';
                                                            shutterSettings[s].currentAction = 'up';
                                                            shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                                            shutterSettings[s].lastAutoAction = 'up_Sunprotect_end';

                                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].heightUp), nameDevice, 'Sunprotect #419');

                                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active');
                                                            adapter.log.debug('Temperature outside: ' + outsideTemp + ' < ' + hysteresisOutside + ' OR Light: ' + sunLight + ' < ' + hysteresisLight);
                                                            adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightUp + '%');
                                                        }
                                                        else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                            shutterSettings[s].sunProtectEndtimerid = ''
                                                            shutterSettings[s].currentAction = 'none';

                                                            await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true }).catch((e) => adapter.log.warn(e));

                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
                                                        }
                                                    }
                                                } else if (shutterSettings[s].alarmTriggerAction == 'sunProtect') {
                                                    shutterSettings[s].sunProtectEndtimerid = '';
                                                    shutterSettings[s].alarmTriggerLevel = parseFloat(shutterSettings[s].heightUp);
                                                    shutterSettings[s].alarmTriggerAction = 'up';

                                                    adapter.log.info('SunProtect not moving up now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%');
                                                }
                                            }
                                        }
                                        if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                            const hysteresisOutside = (((100 - shutterSettings[s].hysteresisOutside) / 100) * shutterSettings[s].tempOutside).toFixed(2);
                                            const hysteresisLight = (((100 - shutterSettings[s].hysteresisLight) / 100) * shutterSettings[s].valueLight).toFixed(2);

                                            if (shutterSettings[s].sunProtectEndtimerid === '' &&
                                                shutterSettings[s].lightSensor != '' &&
                                                parseFloat(hysteresisLight) > sunLight &&
                                                (shutterSettings[s].currentAction == 'sunProtect' || (shutterSettings[s].currentAction == 'triggered' && shutterSettings[s].lastAutoAction == 'down_Sunprotect')) &&
                                                shutterSettings[s].KeepSunProtect === false) {
                                                adapter.log.debug(`#8 Started sunprotect end delay for ${shutterSettings[s].shutterName} with ${shutterSettings[s].sunProtectEndDely * 60000} minutes`);
                                                shutterSettings[s].sunProtectEndtimerid = setTimeout(async function () {
                                                    adapter.log.debug(`#8.1 End sunprotect delay for ${shutterSettings[s].shutterName}`);
                                                    shutterSettings[s].sunProtectEndtimerid = '0';
                                                }, shutterSettings[s].sunProtectEndDely * 60000, s);
                                            }
                                            if ((shutterSettings[s].lightSensor != '' && parseFloat(hysteresisLight) > sunLight && shutterSettings[s].sunProtectEndtimerid === '0') || (parseFloat(hysteresisOutside) > outsideTemp)) {
                                                if (pendingAlarm == false) {
                                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                        if (shutterSettings[s].triggerAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (parseFloat(shutterSettings[s].triggerHeight) == parseFloat(heightDownSun) || Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight))) {
                                                            shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].heightUp);
                                                            shutterSettings[s].triggerAction = 'up';
                                                            shutterSettings[s].sunProtectEndtimerid = '';

                                                            adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%' + ' after the window has been closed ');

                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active anymore');
                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                            adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                        }
                                                        else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                            shutterSettings[s].sunProtectEndtimerid = ''
                                                            shutterSettings[s].triggerAction = 'none';
                                                            shutterSettings[s].sunProtectEndtimerid = '';

                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
                                                        }
                                                    }
                                                } else if (shutterSettings[s].alarmTriggerAction == 'sunProtect') {
                                                    shutterSettings[s].sunProtectEndtimerid = '';
                                                    shutterSettings[s].alarmTriggerLevel = parseFloat(shutterSettings[s].heightUp);
                                                    shutterSettings[s].alarmTriggerAction = 'up';

                                                    adapter.log.info('SunProtect not moving up now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%');
                                                }
                                            }
                                        }
                                    }
                                    await sleep(driveDelayUpSleep);
                                    break;

                                //////////////////////////////////////////////////////////////////////////////////////////////////////

                                // ++++++++++++++++++++++++++++ sunprotect with inside temperature ++++++++++++++++++++++++++++++++++

                                case 'only inside temperature': //only inside temperature
                                    _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;
                                    mustValue = ('' + shutterSettings[s].triggerState);
                                    mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                                    if (typeof _triggerState != undefined && _triggerState != null && _triggerState.val != undefined) {
                                        currentValue = ('' + _triggerState.val);
                                    }

                                    if ((currentValue === mustValue || currentValue === mustValueTilted) && shutterSettings[s].tempSensor != '' || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'off' && shutterSettings[s].tempSensor != '') || (shutterSettings[s].triggerID == '' && shutterSettings[s].tempSensor != '')) {
                                        let insideTemp = 0;

                                        const _insideTempState = shutterSettings[s].tempSensor != '' ? await adapter.getForeignStateAsync(shutterSettings[s].tempSensor).catch((e) => adapter.log.warn(e)) : null;
                                        if (typeof _insideTempState != undefined && _insideTempState != null && _insideTempState.val != undefined) {
                                            insideTemp = parseFloat(_insideTempState.val);
                                        }

                                        if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyUp') || (shutterSettings[s].triggerID == '')) {
                                            if (insideTemp > shutterSettings[s].tempInside && shutterSettings[s].currentAction != 'sunProtect' && shutterSettings[s].currentAction != 'OpenInSunProtect' && shutterSettings[s].currentAction != 'Manu_Mode') {
                                                if (pendingAlarm == false) {
                                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                        if (((Math.round(parseFloat(_shutterState.val) / vRound) * vRound > parseFloat(heightDownSun) && convertShutter == false) || (Math.round(parseFloat(_shutterState.val) / vRound) * vRound < parseFloat(heightDownSun) && convertShutter == true)) && Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp) {
                                                            shutterSettings[s].currentAction = 'sunProtect';
                                                            shutterSettings[s].currentHeight = heightDownSun;
                                                            shutterSettings[s].lastAutoAction = 'down_Sunprotect';

                                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(heightDownSun), nameDevice, 'Sunprotect #420');

                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is active');
                                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                            adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + heightDownSun + '%');
                                                        }
                                                        // Shutter closed. Set currentAction = sunProtect when sunProtect starts =>
                                                        // If shutter is opened automatically it can be opened in height heightDownSun directly
                                                        else if (Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].heightDown) && Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentAction != 'down' && shutterSettings[s].currentAction != 'middle' && shutterSettings[s].currentAction != 'Xmas' && shutterSettings[s].firstCompleteUp == true) { //check currentAction!=down here. If shutter is already closed sunProtect must not be set. Otherwise shutter will be opened again when sunProtect ends!
                                                            shutterSettings[s].currentAction = 'OpenInSunProtect';

                                                            await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true }).catch((e) => adapter.log.warn(e));

                                                            adapter.log.debug('Set sunprotect mode for ' + shutterSettings[s].shutterName + '. Currently closed. Set to sunprotect if shutter will be opened automatically');
                                                        }
                                                        // Shutter is in position = sunProtect. Maybe restart of adapter. sunProtect not set ->
                                                        // set sunProtect again
                                                        else if (Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(heightDownSun) && Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight != shutterSettings[s].heightUp && shutterSettings[s].currentHeight != shutterSettings[s].heightDown && shutterSettings[s].currentAction == '') {
                                                            shutterSettings[s].currentAction = 'sunProtect';

                                                            await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true }).catch((e) => adapter.log.warn(e));

                                                            adapter.log.debug(shutterSettings[s].shutterName + ': Shutter is in position sunProtect. Reset mode sunProtect to cancel sunProtect automatically. Height:' + Math.round(_shutterState.val / vRound) * vRound + ' HeightDownSun:' + heightDownSun);
                                                        }
                                                    }
                                                } else {
                                                    shutterSettings[s].alarmTriggerLevel = parseFloat(heightDownSun);
                                                    shutterSettings[s].alarmTriggerAction = 'sunProtect';

                                                    adapter.log.info('SunProtect not moving down now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%');
                                                }
                                            }
                                        }
                                        if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                            if (insideTemp > shutterSettings[s].tempInside && shutterSettings[s].triggerAction != 'sunProtect' && shutterSettings[s].triggerAction != 'OpenInSunProtect' && shutterSettings[s].triggerAction != 'Manu_Mode') {
                                                if (pendingAlarm == false) {
                                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                        adapter.log.debug(shutterSettings[s].shutterName + ': Check basis for sunprotect. Height:' + Math.round(_shutterState.val / vRound) * vRound + ' > HeightDownSun: ' + heightDownSun + ' AND Height:' + Math.round(_shutterState.val / vRound) * vRound + ' == currentHeight:' + shutterSettings[s].currentHeight + ' AND currentHeight:' + shutterSettings[s].currentHeight + ' == heightUp:' + shutterSettings[s].heightUp);
                                                        if (((Math.round(parseFloat(_shutterState.val) / vRound) * vRound > parseFloat(heightDownSun) && convertShutter == false) || (Math.round(parseFloat(_shutterState.val) / vRound) * vRound < parseFloat(heightDownSun) && convertShutter == true)) && Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight) && shutterSettings[s].currentHeight == shutterSettings[s].heightUp && shutterSettings[s].triggerAction != 'down' && shutterSettings[s].currentAction != 'middle' && shutterSettings[s].currentAction != 'Xmas') {
                                                            shutterSettings[s].triggerAction = 'sunProtect';
                                                            shutterSettings[s].triggerHeight = parseFloat(heightDownSun);

                                                            adapter.log.info(' Will sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%' + ' after the window has been closed ');

                                                            adapter.log.debug('save new trigger height: ' + heightDownSun + '%');
                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                        }
                                                    }
                                                } else {
                                                    shutterSettings[s].alarmTriggerLevel = parseFloat(heightDownSun);
                                                    shutterSettings[s].alarmTriggerAction = 'sunProtect';

                                                    adapter.log.info('SunProtect not moving down now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%');
                                                }
                                            }
                                        }
                                        if (currentValue === mustValue || currentValue === mustValueTilted || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyDown') || (shutterSettings[s].triggerID == '')) {
                                            const hysteresisInside = (((100 - shutterSettings[s].hysteresisInside) / 100) * shutterSettings[s].tempInside).toFixed(2);

                                            if (insideTemp < parseFloat(hysteresisInside)) {
                                                if (pendingAlarm == false) {
                                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                        if (shutterSettings[s].currentAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(heightDownSun) || Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight))) {
                                                            shutterSettings[s].currentAction = 'up';
                                                            shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                                            shutterSettings[s].lastAutoAction = 'up_Sunprotect_end';

                                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].heightUp), nameDevice, 'Sunprotect #421');

                                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active');
                                                            adapter.log.debug('Sunprotect ' + shutterSettings[s].shutterName + ' old height: ' + shutterSettings[s].oldHeight + '% new height: ' + shutterSettings[s].heightUp + '%');
                                                        }
                                                        else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                            shutterSettings[s].currentAction = 'none';

                                                            await adapter.setStateAsync('shutters.autoState.' + nameDevice, { val: shutterSettings[s].currentAction, ack: true }).catch((e) => adapter.log.warn(e));

                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
                                                        }
                                                    }
                                                } else if (shutterSettings[s].alarmTriggerAction == 'sunProtect') {
                                                    shutterSettings[s].sunProtectEndtimerid = '';
                                                    shutterSettings[s].alarmTriggerLevel = parseFloat(shutterSettings[s].heightUp);
                                                    shutterSettings[s].alarmTriggerAction = 'up';

                                                    adapter.log.info('SunProtect not moving up now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%');
                                                }
                                            }
                                        }
                                        if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                            const hysteresisInside = (((100 - shutterSettings[s].hysteresisInside) / 100) * shutterSettings[s].tempInside).toFixed(2);

                                            if (insideTemp < parseFloat(hysteresisInside)) {
                                                if (pendingAlarm == false) {
                                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                                        if (shutterSettings[s].triggerAction == 'sunProtect' && shutterSettings[s].KeepSunProtect === false && (parseFloat(shutterSettings[s].triggerHeight) == parseFloat(heightDownSun) || Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight))) {
                                                            shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].heightUp);
                                                            shutterSettings[s].triggerAction = 'up';

                                                            adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%' + ' after the window has been closed ');

                                                            adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');
                                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active anymore');
                                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                                        }
                                                        else if (shutterSettings[s].currentAction == 'OpenInSunProtect') {
                                                            shutterSettings[s].triggerAction = 'none';

                                                            adapter.log.debug('OpenInSunProtect for ' + shutterSettings[s].shutterName + ' is not longer active');
                                                        }
                                                    }
                                                } else if (shutterSettings[s].alarmTriggerAction == 'sunProtect') {
                                                    shutterSettings[s].sunProtectEndtimerid = '';
                                                    shutterSettings[s].alarmTriggerLevel = parseFloat(shutterSettings[s].heightUp);
                                                    shutterSettings[s].alarmTriggerAction = 'up';

                                                    adapter.log.info('SunProtect not moving up now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%');
                                                }
                                            }
                                        }
                                    }
                                    await sleep(driveDelayUpSleep);
                                    break;
                            }
                        }

                    }
                }
            }
            clearTimeout(timerSleep);
            return (shutterSettings);
        }
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // +++++++++++++++++ End of sunprotect with Elevationslimit +++++++++++++++

    if (shutterSettings) {
        const result = shutterSettings.filter((/** @type {{ enabled: boolean | string; }} */ d) => d.enabled === true || d.enabled === 'true');

        const sunProtEndStart = parseInt(adapter.config.sunProtEndElevation);
        const sunProtEndStop = (adapter.config.sunProtEndElevation - 1);

        for (const i in result) {
            for (const s in shutterSettings) {
                if (shutterSettings[s].shutterName == result[i].shutterName) {
                    if (elevation <= sunProtEndStart && elevation >= sunProtEndStop && (shutterSettings[s].currentAction == 'sunProtect' || shutterSettings[s].currentAction == 'manu_sunProtect')) {
                        const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                        const heightDownSun = shutterSettings[s].heightDownSun;

                        let convertShutter = false;

                        if (parseFloat(shutterSettings[s].heightDown) < parseFloat(shutterSettings[s].heightUp)) {
                            convertShutter = false;
                            adapter.log.debug(shutterSettings[s].shutterName + ' level conversion is disabled ...');
                        } else if (parseFloat(shutterSettings[s].heightDown) > parseFloat(shutterSettings[s].heightUp)) {
                            convertShutter = true;
                            adapter.log.debug(shutterSettings[s].shutterName + ' level conversion is enabled');
                        }

                        const pendingAlarm = await checkPendingAlarm(adapter, shutterSettings[s]);

                        const _autoSunState = await adapter.getStateAsync(`shutters.autoSun.${nameDevice}`).catch((e) => adapter.log.warn(e));

                        if (_autoSunState && _autoSunState.val === true) {
                            let currentValue = '';

                            const _triggerState = shutterSettings[s].triggerID != '' ? await adapter.getForeignStateAsync(shutterSettings[s].triggerID).catch((e) => adapter.log.warn(e)) : null;

                            const mustValue = ('' + shutterSettings[s].triggerState);
                            const mustValueTilted = shutterSettings[s].triggerStateTilted == 'none' ? ('' + shutterSettings[s].triggerState) : ('' + shutterSettings[s].triggerStateTilted);

                            if (typeof _triggerState != undefined && _triggerState != null && _triggerState.val != undefined) {
                                currentValue = ('' + _triggerState.val);
                            }

                            if ((currentValue === mustValue || currentValue === mustValueTilted) || (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].autoDrive != 'onlyDown' && shutterSettings[s].autoDrive != 'off') || (shutterSettings[s].triggerID == '')) {
                                if (shutterSettings[s].sunProtectEndtimerid != '' && shutterSettings[s].sunProtectEndtimerid != '0') {
                                    adapter.log.debug('Stopping sunprotect delay for ' + shutterSettings[s].shutterName);
                                    clearTimeout(shutterSettings[s].sunProtectEndtimerid);
                                    shutterSettings[s].sunProtectEndtimerid = '';
                                }
                                if (pendingAlarm == false) {
                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                        if ((shutterSettings[s].currentAction == 'sunProtect' || shutterSettings[s].currentAction == 'manu_sunProtect') && shutterSettings[s].KeepSunProtect === false && (Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(heightDownSun) || Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight))) {
                                            shutterSettings[s].sunProtectEndtimerid = ''
                                            shutterSettings[s].currentAction = 'up';
                                            shutterSettings[s].currentHeight = shutterSettings[s].heightUp;
                                            shutterSettings[s].lastAutoAction = 'up_Sunprotect_end';

                                            await setShutterState(adapter, shutterSettings, shutterSettings[s], parseFloat(shutterSettings[s].heightUp), nameDevice, 'Sunprotect #422');

                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is completed');
                                            adapter.log.debug(`last automatic Action for ${shutterSettings[s].shutterName}: ${shutterSettings[s].lastAutoAction}`);
                                            adapter.log.debug('save current height: ' + shutterSettings[s].currentHeight + '%' + ' from ' + shutterSettings[s].shutterName);
                                        }
                                    }
                                } else if (shutterSettings[s].alarmTriggerAction == 'sunProtect') {
                                    shutterSettings[s].sunProtectEndtimerid = '';
                                    shutterSettings[s].alarmTriggerLevel = parseFloat(shutterSettings[s].heightUp);
                                    shutterSettings[s].alarmTriggerAction = 'none';

                                    adapter.log.info('SunProtect not moving up now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%');
                                }
                            }
                            if (currentValue != mustValue && currentValue != mustValueTilted && shutterSettings[s].driveAfterClose == true) {
                                if (shutterSettings[s].sunProtectEndtimerid != '' && shutterSettings[s].sunProtectEndtimerid != '0') {
                                    clearTimeout(shutterSettings[s].sunProtectEndtimerid);
                                    shutterSettings[s].sunProtectEndtimerid = '';

                                    adapter.log.debug('Stopping sunprotect delay for ' + shutterSettings[s].shutterName);

                                }
                                if (pendingAlarm == false) {
                                    const _shutterState = await adapter.getForeignStateAsync(shutterSettings[s].name).catch((e) => adapter.log.warn(e));

                                    if (typeof _shutterState != undefined && _shutterState != null && _shutterState.val != undefined) {
                                        if ((shutterSettings[s].triggerAction == 'sunProtect' || shutterSettings[s].triggerAction == 'manu_sunProtect') && shutterSettings[s].KeepSunProtect === false && (parseFloat(shutterSettings[s].triggerHeight) == parseFloat(heightDownSun) || Math.round(parseFloat(_shutterState.val) / vRound) * vRound == parseFloat(shutterSettings[s].currentHeight))) {
                                            shutterSettings[s].triggerHeight = parseFloat(shutterSettings[s].heightUp);
                                            shutterSettings[s].triggerAction = 'up';
                                            shutterSettings[s].sunProtectEndtimerid = '';
                                            adapter.log.debug('Sunprotect for ' + shutterSettings[s].shutterName + ' is not active anymore');
                                            adapter.log.info(' Will end sunprotect ID: ' + shutterSettings[s].shutterName + ' value: ' + heightDownSun + '%' + ' after the window has been closed ');

                                            adapter.log.debug('save new trigger height: ' + shutterSettings[s].triggerHeight + '%');

                                            adapter.log.debug('save new trigger action: ' + shutterSettings[s].triggerAction);
                                            shutterSettings[s].sunProtectEndtimerid = ''
                                        }
                                    }
                                } else if (shutterSettings[s].alarmTriggerAction == 'sunProtect') {
                                    shutterSettings[s].sunProtectEndtimerid = '';
                                    shutterSettings[s].alarmTriggerLevel = parseFloat(shutterSettings[s].heightUp);
                                    shutterSettings[s].alarmTriggerAction = 'none';

                                    adapter.log.info('SunProtect not moving up now due to active alarm: ' + shutterSettings[s].shutterName + ' value: ' + shutterSettings[s].heightUp + '%');
                                }
                            }
                            await sleep(driveDelayUpSleep);
                        }
                    }
                }
            }
        }
        clearTimeout(timerSleep);
        return (shutterSettings);
    }
}

module.exports = sunProtect;
