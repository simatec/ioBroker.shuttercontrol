/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */

import { Adapter, type AdapterOptions } from '@iobroker/adapter-core';
import * as schedule from 'node-schedule';
import type * as SunCalcModule from 'suncalc' with { 'resolution-mode': 'import' };

import { sunProtect } from './lib/sunProtect'; // SunProtect
import { triggerChange } from './lib/triggerChange'; // triggerChange
import { elevationDown } from './lib/elevationDown'; // elevationDown
import { shutterGoldenHour } from './lib/shutterGoldenHour'; // shutterGoldenHour
import { shutterUpLiving } from './lib/shutterUpLiving'; // shutterUpLiving
import { shutterSunriseSunset } from './lib/shutterSunriseSunset'; // shutterSunriseSunset
import { shutterDownLiving } from './lib/shutterDownLiving'; // shutterDownLiving
import { shutterUpSleep } from './lib/shutterUpSleep'; // shutterUpSleep
import { shutterDownLate } from './lib/shutterDownLate'; // shutterDownLate
import { shutterDownChildren } from './lib/shutterDownChildren'; // shutterDownChildren
import { shutterUpChildren } from './lib/shutterUpChildren'; // shutterUpChildren
import { shutterDownSleep } from './lib/shutterDownSleep'; // shutterDownSleep
import { buttonAction } from './lib/buttonAction'; // buttonAction
import { shutterState } from './lib/shutterState'; // shutterState
import { shutterDownComplete } from './lib/shutterDownComplete'; // shutterDownComplete
import { shutterBrightnessSensor, brightnessState } from './lib/shutterBrightnessSensor'; // shutterBrightnessSensor / brightnessState
import { clearWindowLevelTimers } from './lib/windowLevel'; // windowLevel timers
import { shutterAlarm, isAlarmStateChanged } from './lib/shutterAlarm'; // ShutterAlarm / real value change

import type { ShutterRuntimeState, ShutterSettings } from './lib/types';

// suncalc 2.x is an ES module with a CommonJS build (suncalc.cjs) for require. Its bundled typings are ESM-only,
// so a value import from this CommonJS module is rejected by tsc (TS1479) - load the CommonJS build with require.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SunCalc: typeof SunCalcModule = require('suncalc');

/** Row of the shutter list as it is sent to the tab (message 'tab') */
type ShutterTabRow = ShutterSettings & {
    autoDown?: string;
    autoUp?: string;
    autoSun?: string;
    autoState?: string;
};

// +++++++++++++++++ Get longitude an latidude from system config ++++++++++++++++++++

/**
 * Converts a latitude or longitude into a number. A decimal comma (e.g. "9,75") is accepted.
 *
 * @param value value from the configuration
 * @returns the number or null if the value is empty or not a number
 */
function parseCoordinate(value: string | number | null | undefined): number | null {
    if (value === undefined || value === null || String(value).trim() === '') {
        return null;
    }
    const num = Number(String(value).trim().replace(',', '.'));
    return Number.isFinite(num) ? num : null;
}

/**
 * Checks a latitude or longitude value.
 *
 * @param value value from the configuration
 * @param limit 90 for the latitude, 180 for the longitude
 * @returns true if the value is a valid coordinate
 */
function isValidCoordinate(value: string | number | null | undefined, limit: number): boolean {
    const num = parseCoordinate(value);
    return num !== null && Math.abs(num) <= limit;
}

// ++++++++++++++++++++ Add delay Time ++++++++++++++++++++++++

/**
 * Adds minutes to a time string (hh:mm).
 *
 * @param time time as hh:mm
 * @param minsToAdd minutes to add
 */
function addMinutes(time: string, minsToAdd: number | string): string {
    function D(J: number): string {
        return (J < 10 ? '0' : '') + J;
    }
    const piece = time.split(':');
    const mins = Number(piece[0]) * 60 + +piece[1] + +minsToAdd;
    return `${D(mins % (24 * 60) / 60 | 0)}:${D(mins % 60)}`;
}

class Shuttercontrol extends Adapter {
    private autoLivingStr: ioBroker.StateValue | undefined;
    private autoSleepStr: ioBroker.StateValue | undefined;
    private autoChildrenStr: ioBroker.StateValue | undefined;
    private delayUp = 0;
    private delayUpChildren = 0;
    private delayDown = 0;
    private delayDownChildren = 0;
    private resTriggerChange = '';
    private shutterSettings: ShutterSettings[] = [];
    private astroTimeLivingUp: string | undefined;
    private astroTimeLivingDown: string | undefined;
    private astroTimeSleepUp: string | undefined;
    private astroTimeSleepDown: string | undefined;
    private astroTimeChildrenUp: string | undefined;
    private astroTimeChildrenDown: string | undefined;
    private timer: ioBroker.Timeout | undefined;

    private resTrigger: string[] = [];
    private resSunInsideTemp: string[] = [];
    private resSunOutsideTemp: string[] = [];
    private resSunLight: string[] = [];

    private ObjautoUp: Record<string, ioBroker.Object> = {};
    private ObjautoDown: Record<string, ioBroker.Object> = {};
    private ObjautoSun: Record<string, ioBroker.Object> = {};
    private ObjautoState: Record<string, ioBroker.Object> = {};
    private ObjautoLevel: Record<string, ioBroker.Object> = {};
    private resShutterState: string[] = [];
    private readonly lastLigthSensorValue: Record<string, { ts: number }> = {};

    private waitTime4StateCheck = 10;
    private brightnessDown = false;

    private sunsetStr: string | undefined;
    private sunriseStr: string | undefined;
    private goldenHour: string | undefined;
    private goldenHourEnd: string | undefined;
    private upTimeSleep: string | undefined;
    private upTimeChildren: string | undefined;
    private upTimeLiving: string | undefined;
    private downTimeSleep: string | undefined;
    private downTimeChildren: string | undefined;
    private downTimeLiving: string | undefined;
    private dayStr = 0;
    private HolidayStr: ioBroker.StateValue | undefined;
    private SchoolfreeStr: ioBroker.StateValue | undefined;
    private publicHolidayStr: ioBroker.StateValue | undefined;
    private publicHolidayTomorowStr: ioBroker.StateValue | undefined;
    private schoolfreeTomorowStr: ioBroker.StateValue | undefined;
    private schoolfreeStr: ioBroker.StateValue | undefined;

    private azimuth: number | undefined;
    private elevation: number | undefined;

    public constructor(options: Partial<AdapterOptions> = {}) {
        super({ ...options, name: 'shuttercontrol' });

        // start here!
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    // +++++++++++++++++++ main on start of Adapter ++++++++++++++++++++

    private async onReady(): Promise<void> {
        // ++++++++++++++++++ reset current Action in the night at 02:30 +++++++++++++++++++++++
        // (created at module load in the former main.js)
        schedule.scheduleJob('calcTimer', '30 2 * * *', async () => {
            await this.calcTimer();
        });

        // the former callback had the signature (obj) and therefore checked the error argument
        void this.getForeignObject('system.config', (err, obj) => {
            if (obj) {
                void this.checkStates();
            }
        });

        // read shutter settings from config
        this.shutterSettings = this.config.events;
        void this.saveCurrentStates(true);
        this.timer = this.setTimeout(() => {
            void this.checkActualStates();
            schedule.scheduleJob('calcPosTimer', '*/5 * * * *', () => {
                this.sunPos();
            });
        }, 2000);

        void this.GetSystemData();

        this.subscribeStates('control.*');
        this.subscribeStates('info.Elevation');
        this.subscribeStates('info.Azimut');

        if (this.config.publicHolidays === true && (`${this.config.publicHolInstance}.heute.*`)) {
            this.subscribeForeignStates(`${this.config.publicHolInstance}.heute.*`);
        }
        if (this.config.publicHolidays === true && (`${this.config.publicHolInstance}.morgen.*`)) {
            this.subscribeForeignStates(`${this.config.publicHolInstance}.morgen.*`);
        }

        if (this.config.schoolfree === true && (`${this.config.schoolfreeInstance}.info.*`)) {
            this.subscribeForeignStates(`${this.config.schoolfreeInstance}.info.*`);
        }

        if (this.config.HolidayDP !== '') {
            this.subscribeForeignStates(this.config.HolidayDP);
            this.log.info(`subscribe: ${this.config.HolidayDP}`);
        }

        if (this.config.schoolfreeDP !== '') {
            this.subscribeForeignStates(this.config.schoolfreeDP);
            this.log.info(`subscribe: ${this.config.schoolfreeDP}`);
        }

        if (this.config.triggerAutoLiving != '') {
            this.subscribeForeignStates(this.config.triggerAutoLiving);
        }
        if (this.config.triggerAutoSleep != '') {
            this.subscribeForeignStates(this.config.triggerAutoSleep);
        }
        if (this.config.triggerAutoChildren != '') {
            this.subscribeForeignStates(this.config.triggerAutoChildren);
        }
        if (this.config.lightsensorUpDown != '') {
            this.subscribeForeignStates(this.config.lightsensorUpDown);
            // the former callback had the signature (state) and therefore checked the error argument
            void this.getForeignState(this.config.lightsensorUpDown, (err, state) => {
                if (state && state.val && state.val !== null) {
                    this.brightnessDown = brightnessState(this, state.val as number, this.brightnessDown);
                    this.log.debug(`Brightness State Down is: ${this.brightnessDown}`);
                }
            });
        }

        if (this.config.alarmWind1 != '') {
            this.subscribeForeignStates(this.config.alarmWind1);
        }
        if (this.config.alarmWind2 != '') {
            this.subscribeForeignStates(this.config.alarmWind2);
        }
        if (this.config.alarmRain != '') {
            this.subscribeForeignStates(this.config.alarmRain);
        }
        if (this.config.alarmFrost != '') {
            this.subscribeForeignStates(this.config.alarmFrost);
        }
        if (this.config.alarmFire != '') {
            this.subscribeForeignStates(this.config.alarmFire);
        }

        if (this.shutterSettings) {
            const res = this.shutterSettings.map(({ triggerID }) => ({ triggerID }));
            const resTriggerActive = res.filter((d) => d.triggerID != '');

            for (let i = 0; i < resTriggerActive.length; i++) {
                if (this.resTrigger.indexOf(resTriggerActive[i].triggerID) === -1) {
                    this.resTrigger.push(resTriggerActive[i].triggerID);
                }
            }
            this.resTrigger.forEach((element) => {
                this.subscribeForeignStates(element);
                this.log.debug(`trigger for shuttercontrol: ${element}`);
            });

            const resInsideTemp = this.shutterSettings.map(({ tempSensor }) => ({ tempSensor }));
            const rescurrentInsideTemp = resInsideTemp.filter((d) => d.tempSensor != '');

            for (let i = 0; i < rescurrentInsideTemp.length; i++) {
                if (this.resSunInsideTemp.indexOf(rescurrentInsideTemp[i].tempSensor) === -1) {
                    this.resSunInsideTemp.push(rescurrentInsideTemp[i].tempSensor);
                }
            }
            this.resSunInsideTemp.forEach((element) => {
                this.subscribeForeignStates(element);
                this.log.debug(`trigger for inside temperature: ${element}`);
            });

            const resOutsideTemp = this.shutterSettings.map(({ outsideTempSensor }) => ({ outsideTempSensor }));
            const rescurrentOutsideTemp = resOutsideTemp.filter((d) => d.outsideTempSensor != '');

            for (let i = 0; i < rescurrentOutsideTemp.length; i++) {
                if (this.resSunOutsideTemp.indexOf(rescurrentOutsideTemp[i].outsideTempSensor) === -1) {
                    this.resSunOutsideTemp.push(rescurrentOutsideTemp[i].outsideTempSensor);
                }
            }
            this.resSunOutsideTemp.forEach((element) => {
                this.subscribeForeignStates(element);
                this.log.debug(`trigger for outside temperature: ${element}`);
            });

            const resLight = this.shutterSettings.map(({ lightSensor }) => ({ lightSensor }));
            const rescurrentLight = resLight.filter((d) => d.lightSensor != '');

            for (let i = 0; i < rescurrentLight.length; i++) {
                if (this.resSunLight.indexOf(rescurrentLight[i].lightSensor) === -1) {
                    this.resSunLight.push(rescurrentLight[i].lightSensor);
                    this.lastLigthSensorValue[`${rescurrentLight[i].lightSensor}`] = { ts: 0 };
                }
            }
            this.resSunLight.forEach((element) => {
                this.subscribeForeignStates(element);
                this.log.debug(`trigger for Light Sensor: ${element}`);
            });

            const resShutter = this.shutterSettings.map(({ name }) => ({ name }));
            const rescurrentShutter = resShutter.filter((d) => d.name != '');

            for (let i = 0; i < rescurrentShutter.length; i++) {
                if (this.resShutterState.indexOf(rescurrentShutter[i].name) === -1) {
                    this.resShutterState.push(rescurrentShutter[i].name);
                }
            }
            this.resShutterState.forEach((element) => {
                this.subscribeForeignStates(element);
                this.log.debug(`Shutter State: ${element}`);
            });

            // main.js read the level of every shutter here with getForeignState(id, (state) => ...). That callback
            // received the error argument as `state`, so it never copied a level. The levels are restored from
            // shutters.currentStates by saveCurrentStates(true) - reading them here as well would overwrite the
            // saved triggerHeight after a restart (e.g. while a window is open). So it is intentionally not ported.
        }
    }

    // ++++++++++++++++++ is called if a subscribed state changes ++++++++++++++++++

    private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
        if (state) {
            if (this.config.HolidayDP !== '') {
                if (id.includes(this.config.HolidayDP)) {
                    this.log.debug(`HolidayDP changed to: ${state.val}`);
                    await this.setStateAsync('control.Holiday', { val: state.val, ack: true })
                        .catch((e) => this.log.warn(e));
                }
            }
            if (this.config.schoolfreeDP !== '') {
                if (id.includes(this.config.schoolfreeDP)) {
                    this.log.debug(`schoolfreeDP changed to: ${state.val}`);
                    await this.setStateAsync('control.schoolfree', { val: state.val, ack: true })
                        .catch((e) => this.log.warn(e));
                }
            }
            if (id === `${this.namespace}.control.Holiday`) {
                this.HolidayStr = state.val;
                this.shutterDriveCalc();
            }
            if (id === `${this.namespace}.control.schoolfree`) {
                this.SchoolfreeStr = state.val;
                this.shutterDriveCalc();
            }
            if (id === `${this.namespace}.control.autoLiving`) {
                this.autoLivingStr = state.val;
                this.shutterDriveCalc();
            }
            if (id === `${this.namespace}.control.autoSleep`) {
                this.autoSleepStr = state.val;
                this.shutterDriveCalc();
            }
            if (id === `${this.namespace}.control.autoChildren`) {
                this.autoChildrenStr = state.val;
                this.shutterDriveCalc();
            }
            if (this.config.publicHolidays === true) {
                if (id === `${this.config.publicHolInstance}.heute.boolean`) {
                    this.publicHolidayStr = state.val;
                    this.shutterDriveCalc();
                }
                if (id === `${this.config.publicHolInstance}.morgen.boolean`) {
                    this.publicHolidayTomorowStr = state.val;
                    this.shutterDriveCalc();
                }
            }
            if (this.config.schoolfree === true) {
                if (id === `${this.config.schoolfreeInstance}.info.today`) {
                    this.schoolfreeStr = state.val;
                    this.shutterDriveCalc();
                }
                if (id === `${this.config.schoolfreeInstance}.info.tomorrow`) {
                    this.schoolfreeTomorowStr = state.val;
                    this.shutterDriveCalc();
                }
            }
            if (id === this.config.triggerAutoLiving) {
                await this.setStateAsync('control.autoLiving', { val: state.val, ack: true })
                    .catch((e) => this.log.warn(e));
                this.log.debug(`Auto Living is: ${state.val}`);
            }
            if (id === this.config.triggerAutoSleep) {
                await this.setStateAsync('control.autoSleep', { val: state.val, ack: true })
                    .catch((e) => this.log.warn(e));
                this.log.debug(`Auto Sleep is: ${state.val}`);
            }
            if (id === this.config.triggerAutoChildren) {
                await this.setStateAsync('control.autoChildren', { val: state.val, ack: true })
                    .catch((e) => this.log.warn(e));
                this.log.debug(`Auto Children is: ${state.val}`);
            }
            if (id === this.config.lightsensorUpDown) {
                void shutterBrightnessSensor(this, state.val as number, this.shutterSettings, this.brightnessDown);
                this.log.debug(`Brightness sensor value: ${state.val}`);

                if (state.val === 0 && this.brightnessDown === false) {
                    const shutterDownBrightnessTime = this.config.lightsensorDownTime;
                    const downTime = shutterDownBrightnessTime.split(':');

                    schedule.cancelJob('shutterDownBrightness');

                    schedule.scheduleJob('shutterDownBrightness', `${downTime[1]} ${downTime[0]} * * *`, async () => {
                        this.log.debug(`Brightness State Down is: ${this.brightnessDown}`);
                        this.log.debug(`Brightness sensor value: ${state.val}`);
                        void shutterBrightnessSensor(this, state.val as number, this.shutterSettings, this.brightnessDown);

                        await this.delay(10000);
                        this.brightnessDown = brightnessState(this, state.val as number, this.brightnessDown);
                        this.log.debug(`Brightness State Down is: ${this.brightnessDown}`);
                    });
                } else if ((state.val as number) > 0) {
                    schedule.cancelJob('shutterDownBrightness');
                }

                await this.delay(10000);
                this.brightnessDown = brightnessState(this, state.val as number, this.brightnessDown);
                this.log.debug(`Brightness State Down is: ${this.brightnessDown}`);
            }
            // a refresh of an alarm state with the same value is no new alarm and no end of an alarm
            const alarmChanged = isAlarmStateChanged(state);
            if (!alarmChanged &&
                [this.config.alarmWind1, this.config.alarmWind2, this.config.alarmRain, this.config.alarmFrost, this.config.alarmFire].includes(id)) {
                this.log.debug(`Alarm state ${id} refreshed without change (${state.val}) - nothing to do`);
            }
            if (id === this.config.alarmWind1 && alarmChanged) {
                this.log.debug(`Alarm Wind 1 changed: ${state.val}`);
                void shutterAlarm(this, 'alarmWind1', this.shutterSettings);
            }
            if (id === this.config.alarmWind2 && alarmChanged) {
                this.log.debug(`Alarm Wind 2 changed: ${state.val}`);
                void shutterAlarm(this, 'alarmWind2', this.shutterSettings);
            }
            if (id === this.config.alarmRain && alarmChanged) {
                this.log.debug(`Alarm Rain changed: ${state.val}`);
                void shutterAlarm(this, 'alarmRain', this.shutterSettings);
            }
            if (id === this.config.alarmFrost && alarmChanged) {
                this.log.debug(`Alarm Frost changed: ${state.val}`);
                void shutterAlarm(this, 'alarmFrost', this.shutterSettings);
            }
            if (id === this.config.alarmFire && alarmChanged) {
                this.log.debug(`Alarm Fire changed: ${state.val}`);
                void shutterAlarm(this, 'alarmFire', this.shutterSettings);
            }

            this.resTrigger.forEach(async (resultTriggerID) => {
                if (id === resultTriggerID && state.ts === state.lc) {
                    this.resTriggerChange = resultTriggerID;
                    this.log.debug(`TriggerID changed: ${resultTriggerID} | Value: ${state.val}`);
                    void triggerChange(this.resTriggerChange, this, this.shutterSettings);
                }
            });
            this.resSunInsideTemp.forEach(async (resSunInsideTempID) => {
                if (id === resSunInsideTempID && state.ts === state.lc) {
                    this.log.debug(`insidetemperature changed: ${resSunInsideTempID} | Value: ${state.val}°C`);
                    void sunProtect(this, this.elevation as number, this.azimuth as number, this.shutterSettings);
                }
            });
            this.resSunOutsideTemp.forEach(async (resSunOutsideTempID) => {
                if (id === resSunOutsideTempID && state.ts === state.lc && state.val !== null) {
                    this.log.debug(`outsidetemperature changed: ${resSunOutsideTempID} | Value: ${state.val}°C`);
                    void sunProtect(this, this.elevation as number, this.azimuth as number, this.shutterSettings);
                }
            });
            this.resSunLight.forEach(async (resSunLightID) => {
                if (id === resSunLightID && state.ts === state.lc) {
                    if (Math.round((new Date(state.lc).getTime() - new Date(this.lastLigthSensorValue[`${resSunLightID}`].ts).getTime()) / 1000 / 60) > 2) {
                        this.log.debug(`Lightsensor changed: ${resSunLightID} | Value: ${state.val}lux`);
                        void sunProtect(this, this.elevation as number, this.azimuth as number, this.shutterSettings);
                        this.lastLigthSensorValue[`${resSunLightID}`].ts = state.lc;
                    }
                }
            });
            this.resShutterState.forEach(async (resShutterID) => {
                if (id === resShutterID && state.ts === state.lc) {
                    const result = this.shutterSettings.filter((d) => d.name === resShutterID);

                    // the old admin stored the time as string ("0" = no waiting), the jsonConfig stores a number
                    const currentShutterStateTime = parseFloat(`${this.config.currentShutterStateTime}`);
                    if (this.config.currentShutterState === true && !isNaN(currentShutterStateTime)) {
                        this.waitTime4StateCheck = currentShutterStateTime * 1000;
                    }
                    this.log.debug('#0 wait for shutter check started');
                    await this.delay(this.waitTime4StateCheck);
                    this.log.debug('#0 wait for shutter check end');

                    for (let i = 0; i < result.length; i++) {
                        for (let s = 0; s < this.shutterSettings.length; s++) {
                            if (this.shutterSettings[s].shutterName === result[i].shutterName) {
                                const nameDevice = this.shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
                                const _shutterState = await this.getForeignStateAsync(this.shutterSettings[s].name).catch((e) => this.log.warn(e));

                                if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    this.shutterSettings[s].oldHeight != Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound) {

                                    this.log.debug(`Shutter state changed: ${this.shutterSettings[s].shutterName} old value = ${this.shutterSettings[s].oldHeight}% | new value = ${Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound}%`);
                                }
                                if (_shutterState?.val !== null && _shutterState?.val !== undefined &&
                                    Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound != this.shutterSettings[s].currentHeight &&
                                    Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound != this.shutterSettings[s].oldHeight) {

                                    if (this.config.blockManuMode === true) {
                                        switch (Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound) {
                                            case parseFloat(String(this.shutterSettings[s].heightUp)):
                                                this.shutterSettings[s].currentAction = 'up';
                                                this.shutterSettings[s].triggerAction = 'up';
                                                this.shutterSettings[s].currentHeight = Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound;
                                                this.shutterSettings[s].triggerHeight = this.shutterSettings[s].currentHeight;

                                                this.log.debug(`${this.shutterSettings[s].shutterName} Old value = ${this.shutterSettings[s].oldHeight}% | New value = ${Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound}% | automatic is active`);
                                                break;
                                            case parseFloat(String(this.shutterSettings[s].heightDown)):
                                                this.shutterSettings[s].currentAction = 'down';
                                                this.shutterSettings[s].triggerAction = 'down';
                                                this.shutterSettings[s].currentHeight = Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound;
                                                this.shutterSettings[s].triggerHeight = this.shutterSettings[s].currentHeight;

                                                this.log.debug(`${this.shutterSettings[s].shutterName} Old value = ${this.shutterSettings[s].oldHeight}% | New value = ${Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound}% | automatic is active`);
                                                break;
                                            case parseFloat(String(this.shutterSettings[s].heightDownSun)):
                                                this.shutterSettings[s].currentAction = 'sunProtect';
                                                this.shutterSettings[s].triggerAction = 'sunProtect';
                                                this.shutterSettings[s].currentHeight = Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound;
                                                this.shutterSettings[s].triggerHeight = this.shutterSettings[s].currentHeight;

                                                this.log.debug(`${this.shutterSettings[s].shutterName} Old value = ${this.shutterSettings[s].oldHeight}% | New value = ${Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound}% | automatic is active`);
                                                break;
                                            default:
                                                this.shutterSettings[s].currentAction = 'Manu_Mode';
                                                this.shutterSettings[s].triggerAction = 'Manu_Mode';

                                                this.log.debug(`${this.shutterSettings[s].shutterName} drived manually to ${Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound}% | Old value = ${this.shutterSettings[s].oldHeight}% | New value = ${Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound}%`);
                                                this.log.debug(`${this.shutterSettings[s].shutterName} Updated trigger action to ${this.shutterSettings[s].triggerAction} to prevent moving after window close`);
                                        }
                                    } else {
                                        if (this.shutterSettings[s].firstCompleteUp != true &&
                                            this.shutterSettings[s].currentAction != 'none' &&
                                            this.shutterSettings[s].currentAction != 'OpenInSunProtect') {

                                            this.shutterSettings[s].currentAction = 'Manu_Mode';
                                            this.shutterSettings[s].triggerAction = 'Manu_Mode';
                                            this.log.debug(`set Manu_Mode #1 ${this.shutterSettings[s].shutterName}`);
                                        } else {
                                            /*  Shutter is closed -> open manually to heightUp (should be 100% or 0%) before it has been opened automatically -> 
                                                enable possibility to activate sunprotect height if required --> 
                                                if sunprotect is required: shutter is set to sunProtect height
                                            */
                                            if (this.shutterSettings[s].firstCompleteUp == true &&
                                                Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound == this.shutterSettings[s].heightUp &&
                                                this.shutterSettings[s].currentAction != 'up' &&
                                                this.shutterSettings[s].currentAction != 'triggered' &&
                                                this.shutterSettings[s].currentAction != 'triggered_Tilted') {

                                                this.shutterSettings[s].currentHeight = Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound;
                                                this.shutterSettings[s].triggerHeight = Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound;
                                                this.shutterSettings[s].currentAction = 'none'; //reset mode. e.g. mode can be set to sunProtect later if window is closed
                                                this.shutterSettings[s].triggerAction = 'Manu_Mode';
                                                this.shutterSettings[s].firstCompleteUp = false;
                                                this.log.debug(`Reset firstCompleteUp #1 for ${this.shutterSettings[s].shutterName}`);
                                                this.log.debug(`${this.shutterSettings[s].shutterName} opened manually to ${this.shutterSettings[s].heightUp}% | Old value = ${this.shutterSettings[s].oldHeight}% | New value = ${Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound}% | Possibility to activate sunprotect enabled`);

                                                await this.setStateAsync(`shutters.autoState.${nameDevice}`, { val: this.shutterSettings[s].currentAction, ack: true })
                                                    .catch((e) => this.log.warn(e));
                                                await this.setStateAsync(`shutters.autoLevel.${nameDevice}`, { val: parseFloat(String(this.shutterSettings[s].currentHeight)), ack: true })
                                                    .catch((e) => this.log.warn(e));

                                            } else {
                                                this.shutterSettings[s].currentAction = 'Manu_Mode';
                                                this.shutterSettings[s].triggerAction = 'Manu_Mode';
                                                this.log.debug(`set Manu_Mode #2 ${this.shutterSettings[s].shutterName}`);
                                            }
                                        }

                                        this.log.debug(`${this.shutterSettings[s].shutterName} drived manually to ${Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound}% | Old value = ${this.shutterSettings[s].oldHeight}% | New value = ${Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound}%`);
                                        this.log.debug(`${this.shutterSettings[s].shutterName} Updated trigger action to ${this.shutterSettings[s].triggerAction} to prevent moving after window close`);
                                    }

                                    this.log.debug(`#1 shutterName: ${this.shutterSettings[s].shutterName}`);
                                    this.log.debug(`#1 shutterState: ${Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound}%`);
                                    this.log.debug(`#1 currentAction: ${this.shutterSettings[s].currentAction}`);
                                    this.log.debug(`#1 triggerAction: ${this.shutterSettings[s].triggerAction}`);
                                    this.log.debug(`#1 currentHeight: ${this.shutterSettings[s].currentHeight}%`);
                                    this.log.debug(`#1 oldHeight: ${this.shutterSettings[s].oldHeight}%`);
                                    this.log.debug(`#1 currentShutterState: ${this.config.currentShutterState === true ? 'activated' : 'disabled'}`);
                                    this.log.debug(`#1 currentShutterStateTime: ${this.config.currentShutterStateTime} seconds`);

                                    await this.setStateAsync(`shutters.autoState.${nameDevice}`, { val: this.shutterSettings[s].currentAction, ack: true })
                                        .catch((e) => this.log.warn(e));

                                    await this.delay(2000);
                                    this.shutterSettings = await shutterState(this.shutterSettings[s].name, this, this.shutterSettings, false);
                                } else if (_shutterState?.val !== null && _shutterState?.val !== undefined && Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound === this.shutterSettings[s].currentHeight) {
                                    this.log.debug(`${this.shutterSettings[s].shutterName} Old value = ${this.shutterSettings[s].oldHeight}% | New value = ${Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound}% | automatic is active`);
                                    await this.delay(2000);
                                    this.shutterSettings = await shutterState(this.shutterSettings[s].name, this, this.shutterSettings, false);
                                }

                                //save old height
                                await this.delay(2000); //already waited this.waitTime4StateCheck seconds.
                                void this.saveCurrentStates(false);

                                /*
                                    await sleep because e.g.
                                    Shelly submits several position by MQTT and not only the last one (0% 1% ... 97% - 98% - 100%).
                                    By this the value is set only after the final height state has been processed
                                */
                                await this.delay(5000 + this.waitTime4StateCheck);

                                this.shutterSettings[s].oldHeight = this.shutterSettings[s].currentHeight;

                                if (this.shutterSettings[s].firstCompleteUp === true) {
                                    this.shutterSettings[s].firstCompleteUp = false;
                                    this.log.debug(`Reset firstCompleteUp #2 for ${this.shutterSettings[s].shutterName}`);
                                }
                                void this.saveCurrentStates(false);
                            }
                        }
                    }
                }
            });

            if (id === `${this.namespace}.info.Azimut`) {
                void sunProtect(this, this.elevation as number, this.azimuth as number, this.shutterSettings);
            }
            if (id === `${this.namespace}.info.Elevation`) {
                void elevationDown(this, this.elevation as number, this.azimuth as number, this.shutterSettings);
            }
            if (id === `${this.namespace}.control.closeAll`) {
                void buttonAction(this, 'closeAll', this.shutterSettings);
            }
            if (id === `${this.namespace}.control.openAll`) {
                void buttonAction(this, 'openAll', this.shutterSettings);
            }
            if (id === `${this.namespace}.control.closeLiving`) {
                void buttonAction(this, 'closeLiving', this.shutterSettings);
            }
            if (id === `${this.namespace}.control.openLiving`) {
                void buttonAction(this, 'openLiving', this.shutterSettings);
            }
            if (id === `${this.namespace}.control.closeSleep`) {
                void buttonAction(this, 'closeSleep', this.shutterSettings);
            }
            if (id === `${this.namespace}.control.openSleep`) {
                void buttonAction(this, 'openSleep', this.shutterSettings);
            }
            if (id === `${this.namespace}.control.closeChildren`) {
                void buttonAction(this, 'closeChildren', this.shutterSettings);
            }
            if (id === `${this.namespace}.control.openChildren`) {
                void buttonAction(this, 'openChildren', this.shutterSettings);
            }
            if (id === `${this.namespace}.control.sunProtect`) {
                void buttonAction(this, 'sunProtect', this.shutterSettings);
            }
            if (id === `${this.namespace}.control.sunProtectSleep`) {
                void buttonAction(this, 'sunProtectSleep', this.shutterSettings);
            }
            if (id === `${this.namespace}.control.sunProtectChildren`) {
                void buttonAction(this, 'sunProtectChildren', this.shutterSettings);
            }
            if (id === `${this.namespace}.control.sunProtectLiving`) {
                void buttonAction(this, 'sunProtectLiving', this.shutterSettings);
            }
            if (id === `${this.namespace}.control.autoAll`) {
                void buttonAction(this, 'autoAll', this.shutterSettings);
            }
        }
    }

    private onMessage(obj: ioBroker.Message): void {
        if (obj?.command === 'tab' && obj.callback) {
            const shutterSettings: ShutterTabRow[] = this.config.events;

            for (let s = 0; s < shutterSettings.length; s++) {
                const nameDevice = shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');

                shutterSettings[s].autoDown = `shutters.autoDown.${nameDevice}`;
                shutterSettings[s].autoUp = `shutters.autoUp.${nameDevice}`;
                shutterSettings[s].autoSun = `shutters.autoSun.${nameDevice}`;
                shutterSettings[s].autoState = `shutters.autoState.${nameDevice}`;
            }
            try {
                this.sendTo(obj.from, obj.command, { data: { events: shutterSettings } }, obj.callback);
            } catch (e) {
                this.log.error('Tab-Menu is not loaded');
            }
        }
    }

    // +++++++++++++++++++++++++ is called when adapter shuts down +++++++++++++++++++++++++

    private onUnload(callback: () => void): void {
        try {
            this.log.info('cleaned everything up...');
            this.clearTimeout(this.timer);
            clearWindowLevelTimers(this);
            schedule.cancelJob('shutterUpGoldenHourEnd');
            schedule.cancelJob('calcTimer');
            schedule.cancelJob('shutterDownGoldenHour');
            schedule.cancelJob('shutterUpSunrise');
            schedule.cancelJob('shutterDownSunset');
            schedule.cancelJob('shutterUpLiving');
            schedule.cancelJob('shutterDownLiving');
            schedule.cancelJob('shutterUpSleep');
            schedule.cancelJob('shutterDownLate');
            schedule.cancelJob('shutterDownComplete');
            schedule.cancelJob('shutterDownSleep');
            schedule.cancelJob('calcPosTimer');
            schedule.cancelJob('shutterUpChildren');
            schedule.cancelJob('shutterDownChildren');
            schedule.cancelJob('shutterDownBrightness');
            callback();
        } catch {
            callback();
        }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    /* ************************ Check all shutter values​and set default values ​​if values ​are not available ********************************* */

    private async shutterConfigCheck(): Promise<void> {
        let num = 0;

        if (this.shutterSettings) {
            this.log.debug('shutter Config Check started');

            try {
                for (let s = 0; s < this.shutterSettings.length; s++) {
                    this.shutterSettings[s].triggerState = this.shutterSettings[s].triggerState ? this.shutterSettings[s].triggerState : 'none';
                    this.shutterSettings[s].triggerStateTilted = this.shutterSettings[s].triggerStateTilted ? this.shutterSettings[s].triggerStateTilted : 'none';
                    this.shutterSettings[s].typeUp = this.shutterSettings[s].typeUp ? this.shutterSettings[s].typeUp : 'sunrise';
                    this.shutterSettings[s].typeDown = this.shutterSettings[s].typeDown ? this.shutterSettings[s].typeDown : 'sunset';
                    this.shutterSettings[s].heightUp = this.shutterSettings[s].heightUp ? this.shutterSettings[s].heightUp : '100';
                    this.shutterSettings[s].heightDown = this.shutterSettings[s].heightDown ? this.shutterSettings[s].heightDown : '0';
                    this.shutterSettings[s].triggerDrive = this.shutterSettings[s].triggerDrive ? this.shutterSettings[s].triggerDrive : '100';
                    this.shutterSettings[s].triggerDriveTildet = this.shutterSettings[s].triggerDriveTildet ? this.shutterSettings[s].triggerDriveTildet : this.shutterSettings[s].triggerDrive;
                    this.shutterSettings[s].triggerChange = this.shutterSettings[s].triggerChange ? this.shutterSettings[s].triggerChange : 'off';
                    this.shutterSettings[s].elevation = this.shutterSettings[s].elevation ? this.shutterSettings[s].elevation : '8';
                    this.shutterSettings[s].type = this.shutterSettings[s].type ? this.shutterSettings[s].type : 'in- & outside temperature and direction';
                    this.shutterSettings[s].heightDownSun = this.shutterSettings[s].heightDownSun ? this.shutterSettings[s].heightDownSun : '30';
                    this.shutterSettings[s].direction = this.shutterSettings[s].direction ? this.shutterSettings[s].direction : '120';
                    this.shutterSettings[s].directionRange = this.shutterSettings[s].directionRange ? this.shutterSettings[s].directionRange : '50';
                    this.shutterSettings[s].tempInside = this.shutterSettings[s].tempInside ? this.shutterSettings[s].tempInside : '23';
                    this.shutterSettings[s].tempOutside = this.shutterSettings[s].tempOutside ? this.shutterSettings[s].tempOutside : '23';
                    this.shutterSettings[s].valueLight = this.shutterSettings[s].valueLight ? this.shutterSettings[s].valueLight : '15';
                    this.shutterSettings[s].autoDrive = this.shutterSettings[s].autoDrive ? this.shutterSettings[s].autoDrive : 'off';
                    this.shutterSettings[s].hysteresisOutside = this.shutterSettings[s].hysteresisOutside ? this.shutterSettings[s].hysteresisOutside : '5';
                    this.shutterSettings[s].hysteresisInside = this.shutterSettings[s].hysteresisInside ? this.shutterSettings[s].hysteresisInside : '5';
                    this.shutterSettings[s].hysteresisLight = this.shutterSettings[s].hysteresisLight ? this.shutterSettings[s].hysteresisLight : '5';
                    this.shutterSettings[s].XmasLevel = this.shutterSettings[s].XmasLevel ? this.shutterSettings[s].XmasLevel : '0';
                    this.shutterSettings[s].betweenPositionLevel = this.shutterSettings[s].betweenPositionLevel ? this.shutterSettings[s].betweenPositionLevel : '50';
                    this.shutterSettings[s].trigDelyUp = this.shutterSettings[s].trigDelyUp ? this.shutterSettings[s].trigDelyUp : '0';
                    this.shutterSettings[s].trigDelyDown = this.shutterSettings[s].trigDelyDown ? this.shutterSettings[s].trigDelyDown : '0';
                    this.shutterSettings[s].sunProtectEndDely = this.shutterSettings[s].sunProtectEndDely ? this.shutterSettings[s].sunProtectEndDely : '0';

                    this.shutterSettings[s].LateDown = this.shutterSettings[s].LateDown != null ? this.shutterSettings[s].LateDown : false;
                    this.shutterSettings[s].inSummerNotDown = this.shutterSettings[s].inSummerNotDown != null ? this.shutterSettings[s].inSummerNotDown : false;
                    this.shutterSettings[s].KeepSunProtect = this.shutterSettings[s].KeepSunProtect != null ? this.shutterSettings[s].KeepSunProtect : false;
                    this.shutterSettings[s].driveAfterClose = this.shutterSettings[s].driveAfterClose != null ? this.shutterSettings[s].driveAfterClose : false;
                    this.shutterSettings[s].useXmasLevel = this.shutterSettings[s].useXmasLevel != null ? this.shutterSettings[s].useXmasLevel : false;
                    this.shutterSettings[s].betweenPosition = this.shutterSettings[s].betweenPosition != null ? this.shutterSettings[s].betweenPosition : false;
                    this.shutterSettings[s].useOpenWindowLevel = this.shutterSettings[s].useOpenWindowLevel != null ? this.shutterSettings[s].useOpenWindowLevel : false;
                    this.shutterSettings[s].enableAlarmWind1 = this.shutterSettings[s].enableAlarmWind1 != null ? this.shutterSettings[s].enableAlarmWind1 : false;
                    this.shutterSettings[s].enableAlarmWind2 = this.shutterSettings[s].enableAlarmWind2 != null ? this.shutterSettings[s].enableAlarmWind2 : false;
                    this.shutterSettings[s].enableAlarmRain = this.shutterSettings[s].enableAlarmRain != null ? this.shutterSettings[s].enableAlarmRain : false;
                    this.shutterSettings[s].enableAlarmFrost = this.shutterSettings[s].enableAlarmFrost != null ? this.shutterSettings[s].enableAlarmFrost : false;
                    this.shutterSettings[s].enableAlarmFire = this.shutterSettings[s].enableAlarmFire != null ? this.shutterSettings[s].enableAlarmFire : false;

                    if (num === s) {
                        // the former Promise wrapper resolved here; the loop went on (synchronously) all the same
                        this.log.debug('shutter Config Check successfully completed');
                    } else {
                        num++;
                    }
                }
            } catch (e) {
                this.log.warn(`It is not possible to check the shutter configuration: ${e}`);
            }
        }
    }

    // +++++++++++++++++ save states on start and shutter change ++++++++++++++++++++++++++++

    private async saveCurrentStates(onStart: boolean): Promise<void> {
        if (onStart) {
            await this.shutterConfigCheck();
        }

        let currentStates: Record<string, ShutterRuntimeState | null> = {};
        const shutterName: string[] = [];
        let num = 0;

        const _currentStates = await this.getStateAsync('shutters.currentStates').catch((e) => this.log.warn(e));
        if (_currentStates && _currentStates.val && _currentStates.val !== null) {
            try {
                currentStates = JSON.parse(String(_currentStates.val));
            } catch (err) {
                this.log.debug('settings cannot be read from the state');
                currentStates = {};
            }
        }

        // config.events may be missing in a broken configuration - for...in did nothing then as well
        for (let s = 0; s < (this.shutterSettings ?? []).length; s++) {
            const nameDevice = this.shutterSettings[s].shutterName.replace(/[.;, ]/g, '_');
            shutterName.push(this.shutterSettings[s].shutterName);
            num++;

            if (currentStates && currentStates[`${nameDevice}`] && !onStart) {
                (currentStates[`${nameDevice}`] as ShutterRuntimeState).currentAction = this.shutterSettings[s].currentAction;
                (currentStates[`${nameDevice}`] as ShutterRuntimeState).currentHeight = this.shutterSettings[s].currentHeight;
                (currentStates[`${nameDevice}`] as ShutterRuntimeState).triggerAction = this.shutterSettings[s].triggerAction;
                (currentStates[`${nameDevice}`] as ShutterRuntimeState).triggerHeight = this.shutterSettings[s].triggerHeight;
                (currentStates[`${nameDevice}`] as ShutterRuntimeState).oldHeight = this.shutterSettings[s].oldHeight;
                (currentStates[`${nameDevice}`] as ShutterRuntimeState).firstCompleteUp = this.shutterSettings[s].firstCompleteUp;
                (currentStates[`${nameDevice}`] as ShutterRuntimeState).alarmTriggerAction = this.shutterSettings[s].alarmTriggerAction;
                (currentStates[`${nameDevice}`] as ShutterRuntimeState).alarmTriggerLevel = this.shutterSettings[s].alarmTriggerLevel;
                (currentStates[`${nameDevice}`] as ShutterRuntimeState).lastAutoAction = this.shutterSettings[s].lastAutoAction;
            } else if (currentStates && currentStates[`${nameDevice}`] && onStart) {
                this.log.debug(`${nameDevice}: save settings`);
                this.shutterSettings[s].currentAction = (currentStates[`${nameDevice}`] as ShutterRuntimeState).currentAction;
                this.shutterSettings[s].currentHeight = (currentStates[`${nameDevice}`] as ShutterRuntimeState).currentHeight;
                this.shutterSettings[s].triggerAction = (currentStates[`${nameDevice}`] as ShutterRuntimeState).triggerAction;
                this.shutterSettings[s].triggerHeight = (currentStates[`${nameDevice}`] as ShutterRuntimeState).triggerHeight;
                this.shutterSettings[s].oldHeight = (currentStates[`${nameDevice}`] as ShutterRuntimeState).oldHeight;
                this.shutterSettings[s].firstCompleteUp = (currentStates[`${nameDevice}`] as ShutterRuntimeState).firstCompleteUp;
                this.shutterSettings[s].alarmTriggerAction = (currentStates[`${nameDevice}`] as ShutterRuntimeState).alarmTriggerAction;
                this.shutterSettings[s].alarmTriggerLevel = (currentStates[`${nameDevice}`] as ShutterRuntimeState).alarmTriggerLevel;
                this.shutterSettings[s].lastAutoAction = (currentStates[`${nameDevice}`] as ShutterRuntimeState).lastAutoAction;
            } else if (currentStates && !currentStates[`${nameDevice}`] && onStart) {
                this.log.debug(`${nameDevice}: settings added`);
                currentStates[`${nameDevice}`] = null;

                const states = ({
                    shutterName: this.shutterSettings[s].shutterName,
                    currentAction: this.shutterSettings[s].currentAction,
                    currentHeight: this.shutterSettings[s].currentHeight,
                    triggerAction: this.shutterSettings[s].triggerAction,
                    triggerHeight: this.shutterSettings[s].triggerHeight,
                    oldHeight: this.shutterSettings[s].oldHeight,
                    firstCompleteUp: this.shutterSettings[s].firstCompleteUp,
                    alarmTriggerLevel: this.shutterSettings[s].alarmTriggerLevel,
                    alarmTriggerAction: this.shutterSettings[s].alarmTriggerAction,
                    lastAutoAction: this.shutterSettings[s].lastAutoAction
                });

                currentStates[`${nameDevice}`] = states;
            }
            if (num === this.shutterSettings.length && onStart) {

                for (const i in currentStates) {
                    if (shutterName.indexOf((currentStates[i] as ShutterRuntimeState).shutterName) === -1) {
                        const name = (currentStates[i] as ShutterRuntimeState).shutterName.replace(/[.;, ]/g, '_');
                        this.log.debug(`${name}: settings deleted`);
                        delete currentStates[`${name}`];
                    }

                    await this.delay(2000);
                    await this.setStateAsync('shutters.currentStates', { val: JSON.stringify(currentStates), ack: true })
                        .catch((e) => this.log.warn(e));
                }
            } else if (num === this.shutterSettings.length && !onStart) {
                await this.setStateAsync('shutters.currentStates', { val: JSON.stringify(currentStates), ack: true })
                    .catch((e) => this.log.warn(e));
            }
            await this.delay(100);
        }
    }

    // +++++++++++++++++ Check States of Trigger after start ++++++++++++++++++++++++++++

    private async checkStates(): Promise<void> {
        const _holidayStates = await this.getStateAsync('control.Holiday').catch((e) => this.log.warn(e));
        // the former first condition `(_holidayStates && _holidayStates === null)` was always false and is dropped
        if (_holidayStates && _holidayStates.val === null) {
            await this.setStateAsync('control.Holiday', { val: false, ack: true })
                .catch((e) => this.log.warn(e));
        }

        const _schoolfreeStates = await this.getStateAsync('control.schoolfree').catch((e) => this.log.warn(e));
        if (_schoolfreeStates && _schoolfreeStates.val === null) {
            await this.setStateAsync('control.schoolfree', { val: false, ack: true })
                .catch((e) => this.log.warn(e));
        }

        const _autoLivingStates = await this.getStateAsync('control.autoLiving').catch((e) => this.log.warn(e));
        if (_autoLivingStates && _autoLivingStates.val === null) {
            await this.setStateAsync('control.autoLiving', { val: false, ack: true })
                .catch((e) => this.log.warn(e));
        }

        const _autoSleepStates = await this.getStateAsync('control.autoSleep').catch((e) => this.log.warn(e));
        if (_autoSleepStates && _autoSleepStates.val === null) {
            await this.setStateAsync('control.autoSleep', { val: false, ack: true })
                .catch((e) => this.log.warn(e));
        }

        const _autoChildrenStates = await this.getStateAsync('control.autoChildren').catch((e) => this.log.warn(e));
        if (_autoChildrenStates && _autoChildrenStates.val === null) {
            await this.setStateAsync('control.autoChildren', { val: false, ack: true })
                .catch((e) => this.log.warn(e));
        }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // +++++++++++++++++++ check all current States an changes +++++++++++++++++++++++++

    private async checkActualStates(): Promise<void> {
        const _holidayStates = await this.getStateAsync('control.Holiday').catch((e) => this.log.warn(e));
        if (_holidayStates?.val !== null && _holidayStates?.val !== undefined) {
            this.HolidayStr = _holidayStates.val;
        }

        const _schoolfreeStates = await this.getStateAsync('control.schoolfree').catch((e) => this.log.warn(e));
        if (_schoolfreeStates?.val !== null && _schoolfreeStates?.val !== undefined) {
            this.SchoolfreeStr = _schoolfreeStates.val;
        }

        const _autoLivingStates = await this.getStateAsync('control.autoLiving').catch((e) => this.log.warn(e));
        if (_autoLivingStates?.val !== null && _autoLivingStates?.val !== undefined) {
            this.autoLivingStr = _autoLivingStates.val;
        }

        const _autoSleepStates = await this.getStateAsync('control.autoSleep').catch((e) => this.log.warn(e));
        if (_autoSleepStates?.val !== null && _autoSleepStates?.val !== undefined) {
            this.autoSleepStr = _autoSleepStates.val;
        }

        const _autoChildrenStates = await this.getStateAsync('control.autoChildren').catch((e) => this.log.warn(e));
        if (_autoChildrenStates?.val !== null && _autoChildrenStates?.val !== undefined) {
            this.autoChildrenStr = _autoChildrenStates.val;
        }

        if (this.config.publicHolidays === true &&
            this.config.publicHolInstance &&
            this.config.publicHolInstance != 'none') {

            const _publicHolidayStr = await this.getForeignStateAsync(`${this.config.publicHolInstance}.heute.boolean`).catch((e) => this.log.warn(e));
            if (_publicHolidayStr?.val !== null && _publicHolidayStr?.val !== undefined) {
                this.publicHolidayStr = _publicHolidayStr.val;
            }

            const _publicHolidayTomorowStr = await this.getForeignStateAsync(`${this.config.publicHolInstance}.morgen.boolean`).catch((e) => this.log.warn(e));
            if (_publicHolidayTomorowStr?.val !== null && _publicHolidayTomorowStr?.val !== undefined) {
                this.publicHolidayTomorowStr = _publicHolidayTomorowStr.val;
            }
        }

        if (this.config.schoolfree === true &&
            (this.config.schoolfreeInstance != 'none' ||
                (this.config.schoolfreeInstance as string) != '')) {

            const _schoolfreeStr = await this.getForeignStateAsync(`${this.config.schoolfreeInstance}.info.today`).catch((e) => this.log.warn(e));
            if (_schoolfreeStr?.val !== null && _schoolfreeStr?.val !== undefined) {
                this.schoolfreeStr = _schoolfreeStr.val;
            }
            const _schoolfreeTomorowStr = await this.getForeignStateAsync(`${this.config.schoolfreeInstance}.info.tomorrow`).catch((e) => this.log.warn(e));
            if (_schoolfreeTomorowStr?.val !== null && _schoolfreeTomorowStr?.val !== undefined) {
                this.schoolfreeTomorowStr = _schoolfreeTomorowStr.val;
            }
        }

        if (this.config.HolidayDP !== '') {
            this.log.debug('checking HolidayDP');
            const _HolidayDP = await this.getForeignStateAsync(this.config.HolidayDP).catch((e) => this.log.warn(e));
            if (_HolidayDP?.val !== null && _HolidayDP?.val !== undefined) {
                this.log.debug(`got HolidayDP: ${_HolidayDP.val}`);
                await this.setStateAsync('control.Holiday', { val: _HolidayDP.val, ack: true })
                    .catch((e) => this.log.warn(e));
            }
        }

        if (this.config.schoolfreeDP !== '') {
            this.log.debug('checking schoolfreeDP');
            const _schoolfreeDP = await this.getForeignStateAsync(this.config.schoolfreeDP).catch((e) => this.log.warn(e));
            if (_schoolfreeDP?.val !== null && _schoolfreeDP?.val !== undefined) {
                this.log.debug(`got schoolfreeDP: ${_schoolfreeDP.val}`);
                await this.setStateAsync('control.schoolfree', { val: _schoolfreeDP.val, ack: true })
                    .catch((e) => this.log.warn(e));
            }
        }
        const _ObjautoUp = await this.getForeignObjectsAsync(`${this.namespace}.shutters.autoUp.*`, 'state').catch((e) => this.log.warn(e));
        if (_ObjautoUp) {
            this.ObjautoUp = _ObjautoUp;
        }

        const _ObjautoDown = await this.getForeignObjectsAsync(`${this.namespace}.shutters.autoDown.*`, 'state').catch((e) => this.log.warn(e));
        if (_ObjautoDown) {
            this.ObjautoDown = _ObjautoDown;
        }

        const _ObjautoSun = await this.getForeignObjectsAsync(`${this.namespace}.shutters.autoSun.*`, 'state').catch((e) => this.log.warn(e));
        if (_ObjautoSun) {
            this.ObjautoSun = _ObjautoSun;
        }

        const _ObjautoState = await this.getForeignObjectsAsync(`${this.namespace}.shutters.autoState.*`, 'state').catch((e) => this.log.warn(e));
        if (_ObjautoState) {
            this.ObjautoState = _ObjautoState;
        }

        const _ObjautoLevel = await this.getForeignObjectsAsync(`${this.namespace}.shutters.autoLevel.*`, 'state').catch((e) => this.log.warn(e));
        if (_ObjautoLevel) {
            this.ObjautoLevel = _ObjautoLevel;
        }

        await this.delay(1000);
        this.shutterDriveCalc();
        void this.createShutter();
    }
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // ++++++++++++++++++ reset current Action in the night at 02:30 +++++++++++++++++++++++
    private async calcTimer(): Promise<void> {
        this.shutterDriveCalc();

        const resultStates = this.shutterSettings;
        if (resultStates) {
            for (let i = 0; i < resultStates.length; i++) {
                const nameDevice = resultStates[i].shutterName.replace(/[.;, ]/g, '_');
                const _shutterState = await this.getForeignStateAsync(resultStates[i].name).catch((e) => this.log.warn(e));

                if (_shutterState?.val !== null && _shutterState?.val !== undefined) {
                    // Reset Actions every night
                    resultStates[i].currentAction = 'none';
                    resultStates[i].triggerAction = 'none';
                    resultStates[i].firstCompleteUp = true;
                    resultStates[i].lastAutoAction = 'none';
                    resultStates[i].alarmTriggerAction = 'none';

                    await this.setStateAsync(`shutters.autoState.${nameDevice}`, { val: resultStates[i].currentAction, ack: true })
                        .catch((e) => this.log.warn(e));
                    this.log.debug(`${resultStates[i].shutterName} set currentHeight to ${Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound}%`);

                    if (_shutterState?.val !== null && _shutterState?.val !== undefined) {
                        resultStates[i].currentHeight = Math.round((_shutterState.val as number) / this.config.shutterStateRound) * this.config.shutterStateRound;
                        resultStates[i].oldHeight = resultStates[i].currentHeight;

                        await this.setStateAsync(`shutters.autoLevel.${nameDevice}`, { val: parseFloat(String(resultStates[i].currentHeight)), ack: true })
                            .catch((e) => this.log.warn(e));

                        if (parseFloat(String(resultStates[i].heightDown)) < parseFloat(String(resultStates[i].heightUp))) {
                            this.log.debug(`${resultStates[i].shutterName} level conversion is disabled!`);
                        } else if (parseFloat(String(resultStates[i].heightDown)) > parseFloat(String(resultStates[i].heightUp))) {
                            this.log.debug(`${resultStates[i].shutterName} level conversion is enabled!`);
                        }
                    }
                    void this.saveCurrentStates(false);
                }
            }
        }
    }
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * @returns true if latitude and longitude are configured
     */
    private hasValidCoordinates(): boolean {
        return isValidCoordinate(this.config.latitude, 90) && isValidCoordinate(this.config.longitude, 180);
    }

    private async GetSystemData(): Promise<void> {
        if (this.hasValidCoordinates()) {
            // use numbers for SunCalc, also if the coordinates were entered with a decimal comma
            // (the config type declares strings; at runtime the adapter stores numbers here)
            this.config.latitude = parseCoordinate(this.config.latitude) as unknown as string;
            this.config.longitude = parseCoordinate(this.config.longitude) as unknown as string;
        } else {
            try {
                const obj = await this.getForeignObjectAsync('system.config');

                if (obj && obj.common && isValidCoordinate(obj.common.latitude, 90) && isValidCoordinate(obj.common.longitude, 180)) {
                    this.config.longitude = obj.common.longitude as unknown as string;
                    this.config.latitude = obj.common.latitude as unknown as string;

                    this.log.debug(`longitude: ${this.config.longitude} | latitude: ${this.config.latitude}`);
                } else {
                    this.log.error('system settings cannot be called up. Please check configuration!');
                }
            } catch (err) {
                this.log.warn('system settings cannot be called up. Please check configuration!');
            }
        }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // +++++++++++++++ calc the shutter time for all function ++++++++++++++++++

    private shutterDriveCalc(): void {
        this.log.debug('Travel times of the shutters are calculated');

        let times: SunCalcModule.SunTimes; // get today's sunlight times 

        if (!this.hasValidCoordinates()) {
            this.log.warn('cannot calculate astrodata ... please check your config for latitude und longitude!!');
            return;
        }

        try {
            times = SunCalc.getTimes(new Date(), this.config.latitude as unknown as number, this.config.longitude as unknown as number);
            this.log.debug('calculate astrodata ...');

            // suncalc returns null for times that do not occur (polar day/night) - the access then throws and
            // ends in the catch below, as before
            // format sunset/sunrise time from the Date object
            this.sunsetStr = `${(`0${(times.sunset as Date).getHours()}`).slice(-2)}:${(`0${(times.sunset as Date).getMinutes()}`).slice(-2)}`;
            this.sunriseStr = `${(`0${(times.sunrise as Date).getHours()}`).slice(-2)}:${(`0${(times.sunrise as Date).getMinutes()}`).slice(-2)}`;
            this.dayStr = (times.sunrise as Date).getDay();

            // format goldenhour/goldenhourend time from the Date object
            this.goldenHour = `${(`0${(times.goldenHour as Date).getHours()}`).slice(-2)}:${(`0${(times.goldenHour as Date).getMinutes()}`).slice(-2)}`;
            this.goldenHourEnd = `${(`0${(times.goldenHourEnd as Date).getHours()}`).slice(-2)}:${(`0${(times.goldenHourEnd as Date).getMinutes()}`).slice(-2)}`;
        } catch (e) {
            this.log.warn('cannot calculate astrodata ... please check your config for latitude und longitude!!');
            // without astro times the travel times can not be calculated
            return;
        }

        this.log.debug(`this.goldenHourEnd today: ${this.goldenHourEnd}`);
        void this.setState('info.GoldenHourEnd', { val: this.goldenHourEnd, ack: true });
        this.log.debug(`this.goldenHour today: ${this.goldenHour}`);
        void this.setState('info.GoldenHour', { val: this.goldenHour, ack: true });

        this.log.debug(`current day: ${this.dayStr}`);
        this.log.debug(`Sunrise today: ${this.sunriseStr}`);
        void this.setState('info.Sunrise', { val: this.sunriseStr, ack: true });
        this.log.debug(`Sunset today: ${this.sunsetStr}`);
        void this.setState('info.Sunset', { val: this.sunsetStr, ack: true });

        this.sunriseStr = addMinutes(this.sunriseStr, this.config.astroDelayUp);       // Add Delay for Sunrise
        this.sunsetStr = addMinutes(this.sunsetStr, this.config.astroDelayDown);       // Add Delay for Sunset
        this.goldenHour = addMinutes(this.goldenHour, this.config.astroDelayDown);     // Add Delay for GoldenHour
        this.goldenHourEnd = addMinutes(this.goldenHourEnd, this.config.astroDelayUp); // Add Delay for GoldenHourEnd

        this.log.debug(`Starting up shutters GoldenHour area: ${this.goldenHourEnd}`);
        this.log.debug(`Shutdown shutters GoldenHour area: ${this.goldenHour}`);
        this.log.debug(`Starting up shutters Sunrise area: ${this.sunriseStr}`);
        this.log.debug(`Shutdown shutters Sunset area: ${this.sunsetStr}`);

        void shutterGoldenHour(this, this.goldenHourEnd, this.goldenHour, this.shutterSettings);
        void shutterSunriseSunset(this, this.sunriseStr, this.sunsetStr, this.shutterSettings);

        switch (this.config.livingAutomatic) {
            case 'livingSunriseSunset':
                this.astroTimeLivingUp = this.sunriseStr;
                this.astroTimeLivingDown = this.sunsetStr;
                break;
            case 'livingGoldenHour':
                this.astroTimeLivingUp = this.goldenHourEnd;
                this.astroTimeLivingDown = this.goldenHour;
                break;
        }
        switch (this.config.sleepAutomatic) {
            case 'sleepSunriseSunset':
                this.astroTimeSleepUp = this.sunriseStr;
                this.astroTimeSleepDown = this.sunsetStr;
                break;
            case 'sleepGoldenHour':
                this.astroTimeSleepUp = this.goldenHourEnd;
                this.astroTimeSleepDown = this.goldenHour;
                break;
        }
        switch (this.config.childrenAutomatic) {
            case 'childrenSunriseSunset':
                this.astroTimeChildrenUp = this.sunriseStr;
                this.astroTimeChildrenDown = this.sunsetStr;
                break;
            case 'childrenGoldenHour':
                this.astroTimeChildrenUp = this.goldenHourEnd;
                this.astroTimeChildrenDown = this.goldenHour;
                break;
        }
        let debugCnt = 0;

        // ******** Set Up-Time Living Area ********
        switch (this.config.livingAutomatic) {
            case 'livingTime':
                if ((this.dayStr === 6 && this.config.satIsWeek === false) ||
                    this.dayStr === 0 ||
                    this.HolidayStr === true ||
                    (this.SchoolfreeStr === true && this.config.schoolfreeLivingArea === true) ||
                    this.publicHolidayStr === true ||
                    (this.schoolfreeStr === true && this.config.schoolfreeLivingArea === true)) {

                    this.upTimeLiving = this.config.WE_shutterUpLivingMax;
                    debugCnt = 1;
                } else {
                    this.upTimeLiving = this.config.W_shutterUpLivingMax;
                    debugCnt = 2;
                }
                break;
            default:
                if ((this.dayStr === 6 && this.config.satIsWeek === false) ||
                    this.dayStr === 0 ||
                    this.HolidayStr === true ||
                    (this.SchoolfreeStr === true && this.config.schoolfreeLivingArea === true) ||
                    this.publicHolidayStr === true ||
                    (this.schoolfreeStr === true && this.config.schoolfreeLivingArea === true)) {

                    if (this.IsLater(this.astroTimeLivingUp, this.config.WE_shutterUpLivingMax)) {
                        this.upTimeLiving = this.config.WE_shutterUpLivingMax;
                        debugCnt = 10;
                    } else if (this.IsLater(this.astroTimeLivingUp, this.config.WE_shutterUpLivingMin) && this.IsEarlier(this.astroTimeLivingUp, this.config.WE_shutterUpLivingMax)) {
                        this.upTimeLiving = this.astroTimeLivingUp;
                        debugCnt = 11;
                    } else if (this.IsEqual(this.config.WE_shutterUpLivingMin, this.config.WE_shutterUpLivingMax)) {
                        this.upTimeLiving = this.config.WE_shutterUpLivingMax;
                        debugCnt = 12;
                    } else if (this.IsEqual(this.astroTimeLivingUp, this.config.WE_shutterUpLivingMax)) {
                        this.upTimeLiving = this.astroTimeLivingUp;
                        debugCnt = 13;
                    } else if (this.IsEarlier(this.astroTimeLivingUp, this.config.WE_shutterUpLivingMin)) {
                        this.upTimeLiving = this.config.WE_shutterUpLivingMin;
                        debugCnt = 14;
                    }
                } else {
                    if ((this.dayStr < 6 && this.dayStr > 0 && this.config.satIsWeek === false) ||
                        (this.dayStr > 0 && this.config.satIsWeek === true)) {

                        if (this.IsLater(this.astroTimeLivingUp, this.config.W_shutterUpLivingMax)) {
                            this.upTimeLiving = this.config.W_shutterUpLivingMax;
                            debugCnt = 4;
                        } else if (this.IsLater(this.astroTimeLivingUp, this.config.W_shutterUpLivingMin) && this.IsEarlier(this.astroTimeLivingUp, this.config.W_shutterUpLivingMax)) {
                            this.upTimeLiving = this.astroTimeLivingUp;
                            debugCnt = 5;
                        } else if (this.IsEqual(this.config.W_shutterUpLivingMin, this.config.W_shutterUpLivingMax)) {
                            this.upTimeLiving = this.config.W_shutterUpLivingMax;
                            debugCnt = 6;
                        } else if (this.IsEqual(this.astroTimeLivingUp, this.config.W_shutterUpLivingMax)) {
                            this.upTimeLiving = this.astroTimeLivingUp;
                            debugCnt = 7;
                        } else if (this.IsEarlier(this.astroTimeLivingUp, this.config.W_shutterUpLivingMin)) {
                            this.upTimeLiving = this.config.W_shutterUpLivingMin;
                            debugCnt = 8;
                        } else if (this.IsEqual(this.astroTimeLivingUp, this.config.W_shutterUpLivingMin)) {
                            this.upTimeLiving = this.astroTimeLivingUp;
                            debugCnt = 9;
                        }
                    }
                }
                break;
        }
        void this.setState('info.upTimeLiving', { val: this.upTimeLiving, ack: true });
        this.log.debug(`Starting up shutters living area: ${this.upTimeLiving} | debug: ${debugCnt}`);
        void shutterUpLiving(this, this.upTimeLiving, this.autoLivingStr as string | boolean, this.shutterSettings);

        // ******** Set Up-Time Sleep Area ********
        switch (this.config.sleepAutomatic) {
            case 'sleepTime':
                if ((this.dayStr === 6 && this.config.satIsWeek === false) ||
                    this.dayStr === 0 ||
                    this.HolidayStr === true ||
                    (this.SchoolfreeStr === true && this.config.schoolfreeSleepArea === true) ||
                    this.publicHolidayStr === true ||
                    (this.schoolfreeStr === true && this.config.schoolfreeSleepArea === true)) {

                    this.upTimeSleep = this.config.WE_shutterUpSleepMax;
                    debugCnt = 1;
                } else {
                    this.upTimeSleep = this.config.W_shutterUpSleepMax;
                    debugCnt = 2;
                }
                break;
            default:
                if ((this.dayStr === 6 && this.config.satIsWeek === false) ||
                    this.dayStr === 0 ||
                    this.HolidayStr === true ||
                    (this.SchoolfreeStr === true && this.config.schoolfreeSleepArea === true) ||
                    this.publicHolidayStr === true ||
                    (this.schoolfreeStr === true && this.config.schoolfreeSleepArea === true)) {

                    if (this.IsLater(this.astroTimeSleepUp, this.config.WE_shutterUpSleepMax)) {
                        this.upTimeSleep = this.config.WE_shutterUpSleepMax;
                        debugCnt = 10;
                    } else if (this.IsLater(this.astroTimeSleepUp, this.config.WE_shutterUpSleepMin) && this.IsEarlier(this.astroTimeSleepUp, this.config.WE_shutterUpSleepMax)) {
                        this.upTimeSleep = this.astroTimeSleepUp;
                        debugCnt = 11;
                    } else if (this.IsEqual(this.config.WE_shutterUpSleepMin, this.config.WE_shutterUpSleepMax)) {
                        this.upTimeSleep = this.config.WE_shutterUpSleepMax;
                        debugCnt = 12;
                    } else if (this.IsEqual(this.astroTimeSleepUp, this.config.WE_shutterUpSleepMax)) {
                        this.upTimeSleep = this.astroTimeSleepUp;
                        debugCnt = 13;
                    } else if (this.IsEarlier(this.astroTimeSleepUp, this.config.WE_shutterUpSleepMin)) {
                        this.upTimeSleep = this.config.WE_shutterUpSleepMin;
                        debugCnt = 14;
                    }

                } else {
                    if ((this.dayStr < 6 && this.dayStr > 0 && this.config.satIsWeek === false) ||
                        (this.dayStr > 0 && this.config.satIsWeek === true)) {

                        if (this.IsLater(this.astroTimeSleepUp, this.config.W_shutterUpSleepMax)) {
                            this.upTimeSleep = this.config.W_shutterUpSleepMax;
                            debugCnt = 4;
                        } else if (this.IsLater(this.astroTimeSleepUp, this.config.W_shutterUpSleepMin) && this.IsEarlier(this.astroTimeSleepUp, this.config.W_shutterUpSleepMax)) {
                            this.upTimeSleep = this.astroTimeSleepUp;
                            debugCnt = 5;
                        } else if (this.IsEqual(this.config.W_shutterUpSleepMin, this.config.W_shutterUpSleepMax)) {
                            this.upTimeSleep = this.config.W_shutterUpSleepMax;
                            debugCnt = 6;
                        } else if (this.IsEqual(this.astroTimeSleepUp, this.config.W_shutterUpSleepMax)) {
                            this.upTimeSleep = this.astroTimeSleepUp;
                            debugCnt = 7;
                        } else if (this.IsEarlier(this.astroTimeSleepUp, this.config.W_shutterUpSleepMin)) {
                            this.upTimeSleep = this.config.W_shutterUpSleepMin;
                            debugCnt = 8;
                        }
                    }
                }

                break;
        }
        void this.setState('info.upTimeSleep', { val: this.upTimeSleep, ack: true });
        this.log.debug(`Starting up shutters sleep area: ${this.upTimeSleep} | debug ${debugCnt}`);
        void shutterUpSleep(this, this.upTimeSleep, this.delayUp, this.autoSleepStr as string | boolean, this.shutterSettings);

        // ******** Set Up-Time Children Area ********

        switch (this.config.childrenAutomatic) {
            case 'childrenTime':
                if ((this.dayStr === 6 && this.config.satIsWeek === false) ||
                    this.dayStr === 0 ||
                    this.HolidayStr === true ||
                    (this.SchoolfreeStr === true && this.config.schoolfreeChildrenArea === true) ||
                    this.publicHolidayStr === true ||
                    (this.schoolfreeStr === true && this.config.schoolfreeChildrenArea === true)) {

                    this.upTimeChildren = this.config.WE_shutterUpChildrenMax;
                    debugCnt = 1;
                } else {
                    this.upTimeChildren = this.config.W_shutterUpChildrenMax;
                    debugCnt = 2;
                }
                break;
            default:
                if ((this.dayStr === 6 && this.config.satIsWeek === false) ||
                    this.dayStr === 0 ||
                    this.HolidayStr === true ||
                    (this.SchoolfreeStr === true && this.config.schoolfreeChildrenArea === true) ||
                    this.publicHolidayStr === true ||
                    (this.schoolfreeStr === true && this.config.schoolfreeChildrenArea === true)) {

                    if (this.IsLater(this.astroTimeChildrenUp, this.config.WE_shutterUpChildrenMax)) {
                        this.upTimeChildren = this.config.WE_shutterUpChildrenMax;
                        debugCnt = 10;
                    } else if (this.IsLater(this.astroTimeChildrenUp, this.config.WE_shutterUpChildrenMin) && this.IsEarlier(this.astroTimeChildrenUp, this.config.WE_shutterUpChildrenMax)) {
                        this.upTimeChildren = this.astroTimeChildrenUp;
                        debugCnt = 11;
                    } else if (this.IsEqual(this.config.WE_shutterUpChildrenMin, this.config.WE_shutterUpChildrenMax)) {
                        this.upTimeChildren = this.config.WE_shutterUpChildrenMax;
                        debugCnt = 12;
                    } else if (this.IsEqual(this.astroTimeChildrenUp, this.config.WE_shutterUpChildrenMax)) {
                        this.upTimeChildren = this.astroTimeChildrenUp;
                        debugCnt = 13;
                    } else if (this.IsEarlier(this.astroTimeChildrenUp, this.config.WE_shutterUpChildrenMin)) {
                        this.upTimeChildren = this.config.WE_shutterUpChildrenMin;
                        debugCnt = 14;
                    }


                } else {
                    if ((this.dayStr < 6 && this.dayStr > 0 && this.config.satIsWeek === false) ||
                        (this.dayStr > 0 && this.config.satIsWeek === true)) {

                        if (this.IsLater(this.astroTimeChildrenUp, this.config.W_shutterUpChildrenMax)) {
                            this.upTimeChildren = this.config.W_shutterUpChildrenMax;
                            debugCnt = 4;
                        } else if (this.IsLater(this.astroTimeChildrenUp, this.config.W_shutterUpChildrenMin) && this.IsEarlier(this.astroTimeChildrenUp, this.config.W_shutterUpChildrenMax)) {
                            this.upTimeChildren = this.astroTimeChildrenUp;
                            debugCnt = 5;
                        } else if (this.IsEqual(this.config.W_shutterUpChildrenMin, this.config.W_shutterUpChildrenMax)) {
                            this.upTimeChildren = this.config.W_shutterUpChildrenMax;
                            debugCnt = 6;
                        } else if (this.IsEqual(this.astroTimeChildrenUp, this.config.W_shutterUpChildrenMax)) {
                            this.upTimeChildren = this.astroTimeChildrenUp;
                            debugCnt = 7;
                        } else if (this.IsEarlier(this.astroTimeChildrenUp, this.config.W_shutterUpChildrenMin)) {
                            this.upTimeChildren = this.config.W_shutterUpChildrenMin;
                            debugCnt = 8;
                        }
                    }
                }

                break;
        }
        void this.setState('info.upTimeChildren', { val: this.upTimeChildren, ack: true });
        this.log.debug(`Starting up shutters children area: ${this.upTimeChildren} | debug ${debugCnt}`);
        void shutterUpChildren(this, this.upTimeChildren, this.delayUpChildren, this.autoChildrenStr as string | boolean, this.shutterSettings);

        // ******** Set Down-Time Living Area ********
        switch (this.config.livingAutomatic) {
            case 'livingTime':
                if ((this.dayStr === 5 && this.config.satIsWeek === false) ||
                    this.dayStr === 6 ||
                    this.HolidayStr === true ||
                    (this.SchoolfreeStr === true && this.config.schoolfreeLivingArea === true) ||
                    this.publicHolidayTomorowStr === true ||
                    (this.schoolfreeTomorowStr === true && this.config.schoolfreeLivingArea === true)) {

                    this.downTimeLiving = this.config.WE_shutterDownLiving;
                    debugCnt = 1;
                } else {
                    this.downTimeLiving = this.config.W_shutterDownLiving;
                    debugCnt = 2;
                }
                break;
            default:
                if (((this.dayStr === 5 && this.config.satIsWeek === false) ||
                    this.dayStr === 6 ||
                    this.HolidayStr === true ||
                    (this.SchoolfreeStr === true && this.config.schoolfreeLivingArea === true) ||
                    this.publicHolidayTomorowStr === true ||
                    (this.schoolfreeTomorowStr === true && this.config.schoolfreeLivingArea === true)) &&
                    this.IsEarlier(this.config.WE_shutterDownLiving, this.astroTimeLivingDown)) {

                    this.downTimeLiving = this.config.WE_shutterDownLiving;
                    debugCnt = 3;
                } else if (((this.dayStr === 5 && this.config.satIsWeek === false) ||
                    this.dayStr === 6 ||
                    this.HolidayStr === true ||
                    (this.SchoolfreeStr === true && this.config.schoolfreeLivingArea === true) ||
                    this.publicHolidayTomorowStr === true ||
                    (this.schoolfreeTomorowStr === true && this.config.schoolfreeLivingArea === true)) &&
                    this.IsLater(this.config.WE_shutterDownLiving, this.astroTimeLivingDown)) {

                    this.downTimeLiving = this.astroTimeLivingDown;
                    debugCnt = 4;
                } else if (((this.dayStr === 5 && this.config.satIsWeek === false) ||
                    this.dayStr === 6 ||
                    this.HolidayStr === true ||
                    (this.SchoolfreeStr === true && this.config.schoolfreeLivingArea === true) ||
                    this.publicHolidayTomorowStr === true ||
                    (this.schoolfreeTomorowStr === true && this.config.schoolfreeLivingArea === true)) &&
                    this.IsEqual(this.config.WE_shutterDownLiving, this.astroTimeLivingDown)) {

                    this.downTimeLiving = this.astroTimeLivingDown;
                    debugCnt = 5;
                } else if (((this.dayStr < 5 && this.config.satIsWeek === false) ||
                    (this.dayStr < 6 && this.config.satIsWeek === true) ||
                    this.dayStr === 0) &&
                    this.IsLater(this.astroTimeLivingDown, this.config.W_shutterDownLiving)) {

                    this.downTimeLiving = this.config.W_shutterDownLiving;
                    debugCnt = 6;
                } else if (((this.dayStr < 5 && this.config.satIsWeek === false) ||
                    (this.dayStr < 6 && this.config.satIsWeek === true) ||
                    this.dayStr === 0) &&
                    this.IsEarlier(this.astroTimeLivingDown, this.config.W_shutterDownLiving)) {

                    this.downTimeLiving = this.astroTimeLivingDown;
                    debugCnt = 7;
                } else if (((this.dayStr < 5 && this.config.satIsWeek === false) ||
                    (this.dayStr < 6 && this.config.satIsWeek === true) ||
                    this.dayStr === 0) &&
                    this.IsEqual(this.astroTimeLivingDown, this.config.W_shutterDownLiving)) {

                    this.downTimeLiving = this.astroTimeLivingDown;
                    debugCnt = 8;
                }
                break;
        }

        void this.setState('info.downTimeLiving', { val: this.downTimeLiving, ack: true });
        this.log.debug(`Shutdown shutters living area: ${this.downTimeLiving} | debug ${debugCnt}`);
        void shutterDownLiving(this, this.downTimeLiving as string, this.autoLivingStr as string | boolean, this.shutterSettings);

        // ******** Set Down-Time Children Area ******** 
        switch (this.config.childrenAutomatic) {
            case 'childrenTime':
                if ((this.dayStr === 5 && this.config.satIsWeek === false) ||
                    this.dayStr === 6 ||
                    this.HolidayStr === true ||
                    (this.SchoolfreeStr === true && this.config.schoolfreeChildrenArea === true) ||
                    this.publicHolidayTomorowStr === true ||
                    (this.schoolfreeTomorowStr === true && this.config.schoolfreeChildrenArea === true)) {

                    this.downTimeChildren = this.config.WE_shutterDownChildren;
                    debugCnt = 1;
                } else {
                    this.downTimeChildren = this.config.W_shutterDownChildren;
                    debugCnt = 2;
                }
                break;
            default:
                if (((this.dayStr === 5 && this.config.satIsWeek === false) ||
                    this.dayStr === 6 ||
                    this.HolidayStr === true ||
                    (this.SchoolfreeStr === true && this.config.schoolfreeChildrenArea === true) ||
                    this.publicHolidayTomorowStr === true ||
                    (this.schoolfreeTomorowStr === true && this.config.schoolfreeChildrenArea === true)) &&
                    this.config.WE_shutterDownChildren < (this.astroTimeChildrenDown as string)) {

                    this.downTimeChildren = this.config.WE_shutterDownChildren;
                    debugCnt = 3;
                } else if (((this.dayStr === 5 && this.config.satIsWeek === false) ||
                    this.dayStr === 6 ||
                    this.HolidayStr === true ||
                    (this.SchoolfreeStr === true && this.config.schoolfreeChildrenArea === true) ||
                    (this.publicHolidayTomorowStr === true || (this.schoolfreeTomorowStr === true && this.config.schoolfreeChildrenArea === true))) &&
                    this.config.WE_shutterDownChildren > (this.astroTimeChildrenDown as string)) {

                    this.downTimeChildren = this.astroTimeChildrenDown;
                    debugCnt = 4;
                } else if (((this.dayStr === 5 && this.config.satIsWeek === false) ||
                    this.dayStr === 6 ||
                    this.HolidayStr === true ||
                    (this.SchoolfreeStr === true && this.config.schoolfreeChildrenArea === true) ||
                    (this.publicHolidayTomorowStr === true || (this.schoolfreeTomorowStr === true && this.config.schoolfreeChildrenArea === true))) &&
                    this.config.WE_shutterDownChildren === this.astroTimeChildrenDown) {

                    this.downTimeChildren = this.astroTimeChildrenDown;
                    debugCnt = 5;
                } else if (((this.dayStr < 5 && this.config.satIsWeek === false) ||
                    (this.dayStr < 6 && this.config.satIsWeek === true) ||
                    this.dayStr === 0) &&
                    (this.astroTimeChildrenDown as string) > this.config.W_shutterDownChildren) {

                    this.downTimeChildren = this.config.W_shutterDownChildren;
                    debugCnt = 6;
                } else if (((this.dayStr < 5 && this.config.satIsWeek === false) ||
                    (this.dayStr < 6 && this.config.satIsWeek === true) ||
                    this.dayStr === 0) &&
                    (this.astroTimeChildrenDown as string) < this.config.W_shutterDownChildren) {

                    this.downTimeChildren = this.astroTimeChildrenDown;
                    debugCnt = 7;
                } else if (((this.dayStr < 5 && this.config.satIsWeek === false) ||
                    (this.dayStr < 6 && this.config.satIsWeek === true) ||
                    this.dayStr === 0) && this.astroTimeChildrenDown === this.config.W_shutterDownChildren) {

                    this.downTimeChildren = this.astroTimeChildrenDown;
                    debugCnt = 8;
                }
                break;
        }
        void this.setState('info.downTimeChildren', { val: this.downTimeChildren, ack: true });
        this.log.debug(`Shutdown shutters children area: ${this.downTimeChildren} | debug ${debugCnt}`);
        void shutterDownChildren(this, this.downTimeChildren as string, this.delayDownChildren, this.autoChildrenStr as string | boolean, this.shutterSettings);

        // ******** Set Down-Time Sleep Area ******** 
        switch (this.config.sleepAutomatic) {
            case 'sleepTime':
                if ((this.dayStr === 5 && this.config.satIsWeek === false) ||
                    this.dayStr === 6 ||
                    this.HolidayStr === true ||
                    (this.SchoolfreeStr === true && this.config.schoolfreeSleepArea === true) ||
                    this.publicHolidayTomorowStr === true ||
                    (this.schoolfreeTomorowStr === true && this.config.schoolfreeSleepArea === true)) {

                    this.downTimeSleep = this.config.WE_shutterDownSleep;
                    debugCnt = 1;
                } else {
                    this.downTimeSleep = this.config.W_shutterDownSleep;
                    debugCnt = 2;
                }
                break;
            default:
                if (((this.dayStr === 5 && this.config.satIsWeek === false) ||
                    this.dayStr === 6 ||
                    this.HolidayStr === true ||
                    (this.SchoolfreeStr === true && this.config.schoolfreeSleepArea === true) ||
                    this.publicHolidayTomorowStr === true ||
                    (this.schoolfreeTomorowStr === true && this.config.schoolfreeSleepArea === true)) &&
                    this.config.WE_shutterDownSleep < (this.astroTimeSleepDown as string)) {

                    this.downTimeSleep = this.config.WE_shutterDownSleep;
                    debugCnt = 3;
                } else if (((this.dayStr === 5 && this.config.satIsWeek === false) ||
                    this.dayStr === 6 ||
                    this.HolidayStr === true ||
                    (this.SchoolfreeStr === true && this.config.schoolfreeSleepArea === true) ||
                    this.publicHolidayTomorowStr === true ||
                    (this.schoolfreeTomorowStr === true && this.config.schoolfreeSleepArea === true)) &&
                    this.config.WE_shutterDownSleep > (this.astroTimeSleepDown as string)) {

                    this.downTimeSleep = this.astroTimeSleepDown;
                    debugCnt = 4;
                } else if (((this.dayStr === 5 && this.config.satIsWeek === false) ||
                    this.dayStr === 6 ||
                    this.HolidayStr === true ||
                    (this.SchoolfreeStr === true && this.config.schoolfreeSleepArea === true) ||
                    this.publicHolidayTomorowStr === true ||
                    (this.schoolfreeTomorowStr === true && this.config.schoolfreeSleepArea === true)) &&
                    this.config.WE_shutterDownSleep === this.astroTimeSleepDown) {

                    this.downTimeSleep = this.astroTimeSleepDown;
                    debugCnt = 5;
                } else if (((this.dayStr < 5 && this.config.satIsWeek === false) ||
                    (this.dayStr < 6 && this.config.satIsWeek === true) ||
                    this.dayStr === 0) &&
                    (this.astroTimeSleepDown as string) > this.config.W_shutterDownSleep) {

                    this.downTimeSleep = this.config.W_shutterDownSleep;
                    debugCnt = 6;
                } else if (((this.dayStr < 5 && this.config.satIsWeek === false) ||
                    (this.dayStr < 6 && this.config.satIsWeek === true) ||
                    this.dayStr === 0) &&
                    (this.astroTimeSleepDown as string) < this.config.W_shutterDownSleep) {

                    this.downTimeSleep = this.astroTimeSleepDown;
                    debugCnt = 7;
                } else if (((this.dayStr < 5 && this.config.satIsWeek === false) ||
                    (this.dayStr < 6 && this.config.satIsWeek === true) ||
                    this.dayStr === 0) &&
                    this.astroTimeSleepDown === this.config.W_shutterDownSleep) {

                    this.downTimeSleep = this.astroTimeSleepDown;
                    debugCnt = 8;
                }
                break;
        }
        void this.setState('info.downTimeSleep', { val: this.downTimeSleep, ack: true });
        this.log.debug(`Shutdown shutters sleep area: ${this.downTimeSleep} | debug ${debugCnt}`);
        void shutterDownSleep(this, this.downTimeSleep as string, this.delayDown, this.autoSleepStr as string | boolean, this.shutterSettings);
        void shutterDownLate(this, this.shutterSettings);
        void shutterDownComplete(this, this.delayDown, this.shutterSettings);
        this.delayCalc();
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // ++++++++++++++++++ Calc current Sun position all 5 Min ++++++++++++++++++++++

    private sunPos(): void {
        let currentPos: SunCalcModule.Position;
        if (!this.hasValidCoordinates()) {
            this.log.error('cannot calculate astrodata ... please check your config for latitude und longitude!!');
            return;
        }
        try {
            currentPos = SunCalc.getPosition(new Date(), this.config.latitude as unknown as number, this.config.longitude as unknown as number);
            this.log.debug('calculate astrodata ...');
        } catch (e) {
            this.log.error('cannot calculate astrodata ... please check your config for latitude und longitude!!');
            return;
        }

        this.azimuth = Math.round(10 * currentPos.azimuth) / 10;
        this.elevation = Math.round(10 * currentPos.altitude) / 10;

        this.log.debug(`Sun Azimut: ${this.azimuth}°`);
        void this.setState('info.Azimut', { val: this.azimuth, ack: true });
        this.log.debug(`Sun Elevation: ${this.elevation}°`);
        void this.setState('info.Elevation', { val: this.elevation, ack: true });
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // +++++++++++++++++ calc the shutter delay +++++++++++++++++++

    private delayCalc(): void {
        this.delayUp = 0;
        this.delayDown = 0;
        this.delayUpChildren = 0;
        this.delayDownChildren = 0;

        const resultFull = this.shutterSettings; // Full Result

        if (resultFull) {
            if (this.upTimeLiving === this.upTimeSleep) {
                const resLiving = resultFull.filter((d) => d.typeUp === 'living'); // Filter Area Living
                const result = resLiving.filter((d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

                for (let i = 0; i < result.length; i++) {
                    this.delayUp++;
                }
                if (this.autoLivingStr === true) {
                    const resLivingAuto = resultFull.filter((d) => d.typeUp === 'living-auto'); // Filter Area Living
                    const result2 = resLivingAuto.filter((d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

                    for (let i = 0; i < result2.length; i++) {
                        this.delayUp++;
                    }
                }
            }

            if (this.upTimeSleep === this.upTimeChildren) {
                this.delayUpChildren = this.delayUp;

                const resLiving = resultFull.filter((d) => d.typeUp === 'sleep'); // Filter Area Sleep
                const result = resLiving.filter((d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

                for (let i = 0; i < result.length; i++) {
                    this.delayUpChildren++;
                }
                if (this.autoSleepStr === true) {
                    const resLivingAuto = resultFull.filter((d) => d.typeUp === 'sleep-auto'); // Filter Area Sleep
                    const result2 = resLivingAuto.filter((d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

                    for (let i = 0; i < result2.length; i++) {
                        this.delayUpChildren++;
                    }
                }
            }
            if (this.downTimeLiving === this.downTimeSleep) {
                const resLiving2 = resultFull.filter((d) => d.typeDown === 'living'); // Filter Area Living
                const result3 = resLiving2.filter((d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

                for (let i = 0; i < result3.length; i++) {
                    this.delayDown++;
                }
                if (this.autoLivingStr === true) {
                    const resLivingAuto2 = resultFull.filter((d) => d.typeDown === 'living-auto'); // Filter Area Living
                    const result4 = resLivingAuto2.filter((d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

                    for (let i = 0; i < result4.length; i++) {
                        this.delayDown++;
                    }
                }
            }

            if (this.downTimeSleep === this.downTimeChildren) {
                this.delayDownChildren = this.delayDown;

                const resLiving2 = resultFull.filter((d) => d.typeDown === 'sleep'); // Filter Area Sleep
                const result3 = resLiving2.filter((d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

                for (let i = 0; i < result3.length; i++) {
                    this.delayDownChildren++;
                }

                if (this.autoSleepStr === true) {
                    const resLivingAuto2 = resultFull.filter((d) => d.typeDown === 'sleep-auto'); // Filter Area Sleep
                    const result4 = resLivingAuto2.filter((d) => d.enabled === true || d.enabled === 'true'); // Filter enabled

                    for (let i = 0; i < result4.length; i++) {
                        this.delayDownChildren++;
                    }
                }
            }
        }

    }

    // +++++++++++++++++ create states for all new shutter in the config +++++++++++++++++++

    private async createShutter(): Promise<void> {
        const result = this.shutterSettings;
        if (result) {
            for (let i = 0; i < result.length; i++) {
                let objectName;

                if (result[i].shutterName !== '') {
                    objectName = result[i].shutterName.replace(/[.;, ]/g, '_');
                } else if (result[i].shutterName === '') {
                    objectName = result[i].name.replace(/[.;, ]/g, '_');
                }

                if (objectName && objectName !== '') {
                    try {
                        // Create Object for auto up
                        await this.setObjectNotExistsAsync(`shutters.autoUp.${objectName}`, {
                            type: "state",
                            common: {
                                role: "switch",
                                name: result[i].shutterName,
                                type: "boolean",
                                read: true,
                                write: true
                            },
                            native: {},
                        });

                        const _autoUpState = await this.getStateAsync(`shutters.autoUp.${objectName}`).catch((e) => this.log.warn(e));
                        if (!_autoUpState) {
                            await this.setStateAsync(`shutters.autoUp.${objectName}`, { val: true, ack: true })
                                .catch((e) => this.log.warn(e));
                            this.log.debug(`Create Object: shutters.autoUp.${objectName}`);
                        }

                        // Create Object for auto down
                        await this.setObjectNotExistsAsync(`shutters.autoDown.${objectName}`, {
                            type: "state",
                            common: {
                                role: "switch",
                                name: result[i].shutterName,
                                type: "boolean",
                                read: true,
                                write: true
                            },
                            native: {},
                        });

                        const _autoDownState = await this.getStateAsync(`shutters.autoDown.${objectName}`).catch((e) => this.log.warn(e));
                        if (!_autoDownState) {
                            await this.setStateAsync(`shutters.autoDown.${objectName}`, { val: true, ack: true })
                                .catch((e) => this.log.warn(e));
                            this.log.debug(`Create Object: shutters.autoDown.${objectName}`);
                        }

                        // Create Object for auto sun
                        await this.setObjectNotExistsAsync(`shutters.autoSun.${objectName}`, {
                            type: "state",
                            common: {
                                role: "switch",
                                name: result[i].shutterName,
                                type: "boolean",
                                read: true,
                                write: true
                            },
                            native: {},
                        });

                        const _autoSunState = await this.getStateAsync(`shutters.autoSun.${objectName}`).catch((e) => this.log.warn(e));
                        if (!_autoSunState) {
                            await this.setStateAsync(`shutters.autoSun.${objectName}`, { val: true, ack: true })
                                .catch((e) => this.log.warn(e));
                            this.log.debug(`Create Object: shutters.autoSun.${objectName}`);
                        }

                        // Create Object for auto state
                        await this.setObjectNotExistsAsync(`shutters.autoState.${objectName}`, {
                            type: "state",
                            common: {
                                role: "text",
                                name: result[i].shutterName,
                                type: "string",
                                read: true,
                                write: false
                            },
                            native: {},
                        });

                        const _autoState = await this.getStateAsync(`shutters.autoState.${objectName}`).catch((e) => this.log.warn(e));
                        if (!_autoState) {
                            await this.setStateAsync(`shutters.autoState.${objectName}`, { val: 'none', ack: true })
                                .catch((e) => this.log.warn(e));
                            this.log.debug(`Create Object: shutters.autoState.${objectName}`);
                        }

                        // Create Object for auto level
                        await this.setObjectNotExistsAsync(`shutters.autoLevel.${objectName}`, {
                            type: "state",
                            common: {
                                role: "value",
                                name: result[i].shutterName,
                                type: "number",
                                unit: "%",
                                read: true,
                                write: false
                            },
                            native: {},
                        });

                        const _autoLevel = await this.getStateAsync(`shutters.autoLevel.${objectName}`).catch((e) => this.log.warn(e));
                        if (!_autoLevel) {
                            this.log.debug(`Create Object: shutters.autoLevel.${objectName}`);
                            await this.setStateAsync(`shutters.autoLevel.${objectName}`, { val: result[i].currentHeight ? parseFloat(String(result[i].currentHeight)) : 0, ack: true })
                                .catch((e) => this.log.warn(e));
                        }
                    } catch (e) {
                        this.log.warn(`shutter cannot created! Please check your shutter config: ${e}`);
                    }
                } else {
                    this.log.warn('shutter cannot created ... Please check in your config the shutter Name');
                }
            }
            void this.detectedOldShutter(result);
        }
    }


    // +++++++++++++++++++++ delete all states of deleting shutter ++++++++++++++++++

    private deleteShutter(fullRes: string[], resultID: string, resID: string): void {
        if (fullRes.indexOf(resultID) === -1) {
            this.log.info(`DELETE: ${resID}`);
            try {
                this.delObject(resID, (err) => {
                    if (err) {
                        this.log.warn(String(err));
                    }
                });
            } catch (e) {
                this.log.warn(`shutter cannot deleted: ${e}`);
            }
        }
    }

    // +++++++++++++++++++++ detected all states of deleting shutter ++++++++++++++++++

    private async detectedOldShutter(result: ShutterSettings[]): Promise<void> {
        if (result) {

            // delete old shutter auto up
            for (const i in this.ObjautoUp) {
                const resID = this.ObjautoUp[i]._id;
                const objectID = resID.split('.');
                const resultID = objectID[4];
                const resultName = result.map(({ shutterName }) => ({ shutterName }));
                const fullRes: string[] = [];

                for (let i = 0; i < resultName.length; i++) {
                    const res = resultName[i].shutterName.replace(/[.;, ]/g, '_');
                    fullRes.push(res);
                }
                if (fullRes.indexOf(resultID) === -1) {
                    await this.delay(1000);
                    this.deleteShutter(fullRes, resultID, resID);
                }
            }

            // delete old shutter auto down
            for (const i in this.ObjautoDown) {
                const resID = this.ObjautoDown[i]._id;
                const objectID = resID.split('.');
                const resultID = objectID[4];

                const resultName = result.map(({ shutterName }) => ({ shutterName }));
                const fullRes: string[] = [];

                for (let i = 0; i < resultName.length; i++) {
                    const res = resultName[i].shutterName.replace(/[.;, ]/g, '_');
                    fullRes.push(res);
                }
                if (fullRes.indexOf(resultID) === -1) {
                    await this.delay(1000);
                    this.deleteShutter(fullRes, resultID, resID);
                }
            }

            // delete old shutter auto sun
            for (const i in this.ObjautoSun) {
                const resID = this.ObjautoSun[i]._id;
                const objectID = resID.split('.');
                const resultID = objectID[4];

                const resultName = result.map(({ shutterName }) => ({ shutterName }));
                const fullRes: string[] = [];

                for (let i = 0; i < resultName.length; i++) {
                    const res = resultName[i].shutterName.replace(/[.;, ]/g, '_');
                    fullRes.push(res);
                }
                if (fullRes.indexOf(resultID) === -1) {
                    await this.delay(1000);
                    this.deleteShutter(fullRes, resultID, resID);
                }
            }

            // delete old shutter auto state
            for (const i in this.ObjautoState) {
                const resID = this.ObjautoState[i]._id;
                const objectID = resID.split('.');
                const resultID = objectID[4];

                const resultName = result.map(({ shutterName }) => ({ shutterName }));
                const fullRes: string[] = [];

                for (let i = 0; i < resultName.length; i++) {
                    const res = resultName[i].shutterName.replace(/[.;, ]/g, '_');
                    fullRes.push(res);
                }
                if (fullRes.indexOf(resultID) === -1) {
                    await this.delay(1000);
                    this.deleteShutter(fullRes, resultID, resID);
                }
            }

            // delete old shutter auto level
            for (const i in this.ObjautoLevel) {
                const resID = this.ObjautoLevel[i]._id;
                const objectID = resID.split('.');
                const resultID = objectID[4];

                const resultName = result.map(({ shutterName }) => ({ shutterName }));
                const fullRes: string[] = [];

                for (let i = 0; i < resultName.length; i++) {
                    const res = resultName[i].shutterName.replace(/[.;, ]/g, '_');
                    fullRes.push(res);
                }
                if (fullRes.indexOf(resultID) === -1) {
                    await this.delay(1000);
                    this.deleteShutter(fullRes, resultID, resID);
                }
            }
        }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // +++++++++++++++++++ Is Later function ++++++++++++++++++++++

    /**
     * @param timeVal
     * @param timeLimit
     */
    private IsLater(timeVal: string | undefined, timeLimit: string | undefined): boolean {
        let ret = false;
        try {
            this.log.debug(`check this.IsLater: ${timeVal} " " ${timeLimit}`);

            if (typeof timeVal === "string" && typeof timeLimit === "string") {
                const valIn = timeVal.split(":");
                const valLimits = timeLimit.split(":");

                if (valIn.length > 1 && valLimits.length > 1) {

                    if (parseInt(valIn[0]) > parseInt(valLimits[0])
                        || (parseInt(valIn[0]) === parseInt(valLimits[0]) && parseInt(valIn[1]) > parseInt(valLimits[1]))) {
                        ret = true;
                        this.log.debug(`yes, this.IsLater: ${timeVal} " " ${timeLimit}`);
                    }
                } else {
                    this.log.error(`string does not contain: ${timeVal} " " ${timeLimit}`);
                }
            } else {
                this.log.error(`not a string '${typeof timeVal} " " ${typeof timeLimit}`);
            }
        } catch (e) {
            this.log.error(`exception in this.IsLater ["${e}"]`);
        }
        return ret;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // +++++++++++++++++ Is Earlier function +++++++++++++++++++++

    /**
     * @param timeVal
     * @param [timeLimit]
     */
    private IsEarlier(timeVal: string | undefined, timeLimit?: string): boolean {
        let ret = false;
        try {
            this.log.debug(`check this.IsEarlier: ${timeVal} " " ${timeLimit}`);

            if (typeof timeVal === "string" && typeof timeLimit === "string") {
                const valIn = timeVal.split(":");
                const valLimits = timeLimit.split(":");

                if (valIn.length > 1 && valLimits.length > 1) {

                    if (parseInt(valIn[0]) < parseInt(valLimits[0])
                        || (parseInt(valIn[0]) === parseInt(valLimits[0]) && parseInt(valIn[1]) < parseInt(valLimits[1]))) {
                        ret = true;
                        this.log.debug(`yes, this.IsEarlier: ${timeVal} " " ${timeLimit}`);
                    }
                } else {
                    this.log.error(`string does not contain: ${timeVal} " " ${timeLimit}`);
                }
            } else {
                this.log.error(`not a string ${typeof timeVal} " " ${typeof timeLimit}`);
            }
        } catch (e) {
            this.log.error(`exception in this.IsEarlier ["${e}"]`);
        }
        return ret;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // ++++++++++++++++++++++++++ is Equal function ++++++++++++++++++++++
    /**
     * @param timeVal
     * @param timeLimit
     */
    private IsEqual(timeVal: string | undefined, timeLimit: string | undefined): boolean {
        let ret = false;
        try {
            this.log.debug(`check this.IsEqual: ${timeVal} " " ${timeLimit}`);

            if (typeof timeVal === "string" && typeof timeLimit === "string") {
                const valIn = timeVal.split(":");
                const valLimits = timeLimit.split(":");

                if (valIn.length > 1 && valLimits.length > 1) {

                    if (parseInt(valIn[0]) === parseInt(valLimits[0]) && parseInt(valIn[1]) === parseInt(valLimits[1])) {
                        ret = true;
                        this.log.debug(`yes, this.IsEqual: ${timeVal} " " ${timeLimit}`);
                    }
                } else {
                    this.log.error(`string does not contain: ${timeVal} " " ${timeLimit}`);
                }
            } else {
                this.log.error(`not a string ${typeof timeVal} " " ${typeof timeLimit}`);
            }
        } catch (e) {
            this.log.error(`exception in this.IsEqual ["${e}"]`);
        }
        return ret;
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ++++++++++++++++++ start option of Adapter ++++++++++++++++++++++
if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<AdapterOptions> | undefined) => new Shuttercontrol(options);
} else {
    // otherwise start the instance directly
    (() => new Shuttercontrol())();
}
