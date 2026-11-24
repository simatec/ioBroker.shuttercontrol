/*
 * End-to-end test of shuttercontrol with VIRTUAL shutters in a REAL js-controller.
 *
 * Run with: npm run build:backend && npm run test:integration:shutters
 *
 * The test creates virtual devices as foreign states (0_userdata.0.vshutter.*), configures the instance with
 * shutters of all kinds and checks the levels the adapter writes to the virtual shutters and its own states.
 *
 * The sun position used by the adapter is calculated from the real time. To be able to test the sun protection
 * and the elevation drive at any time of the day, the coordinates are chosen at test start so that the sun is
 * currently in the early afternoon (azimuth ~ 190°, elevation ~ 25°) at that place.
 *
 * Takes about 15 minutes: the adapter computes the first sun position only at the next full 5 minutes.
 */
const path = require('node:path');
const assert = require('node:assert');
const { tests } = require('@iobroker/testing');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SunCalc = require('suncalc');

const NS = 'shuttercontrol.0';
const V = '0_userdata.0.vshutter';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const pad = n => `0${n}`.slice(-2);
const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const ddmm = d => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
const round1 = n => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------------------------------------------
// virtual devices
// ---------------------------------------------------------------------------------------------------------------

/** shutter definitions: key -> [shutterName, initial level] */
const SH = {
    living: { name: 'Living 1', dev: 'Living_1' },
    sleep: { name: 'Sleep 1', dev: 'Sleep_1' },
    children: { name: 'Children 1', dev: 'Children_1' }, // level conversion (up = 0, down = 100)
    livingAuto: { name: 'Living Auto', dev: 'Living_Auto' },
    sleepAuto: { name: 'Sleep Auto', dev: 'Sleep_Auto' },
    childrenAuto: { name: 'Children Auto', dev: 'Children_Auto' },
    elevation: { name: 'Elevation', dev: 'Elevation' },
    light: { name: 'Light.Sensor', dev: 'Light_Sensor' }, // name with dot -> object name with _
    golden: { name: 'Golden', dev: 'Golden' },
    sunset: { name: 'Sunset', dev: 'Sunset' },
    manual: { name: 'Manual', dev: 'Manual' },
    disabled: { name: 'Disabled', dev: 'Disabled' },
};
for (const k of Object.keys(SH)) {
    SH[k].id = `${V}.${k}.level`;
}

const DEV = {
    win1: `${V}.window1`,
    win2: `${V}.window2`,
    win3: `${V}.window3`,
    tIn: `${V}.tempInside`,
    tIn2: `${V}.tempInside2`,
    tOut: `${V}.tempOutside`,
    lux: `${V}.lux`,
    bright: `${V}.brightness`,
    wind1: `${V}.alarm.wind1`,
    wind2: `${V}.alarm.wind2`,
    rain: `${V}.alarm.rain`,
    frost: `${V}.alarm.frost`,
    fire: `${V}.alarm.fire`,
    holiday: `${V}.holiday`,
    schoolfree: `${V}.schoolfree`,
    autoLiving: `${V}.triggerAutoLiving`,
    autoSleep: `${V}.triggerAutoSleep`,
    autoChildren: `${V}.triggerAutoChildren`,
};

/**
 * Finds a place where the sun is at azimuth ~190° and elevation ~25° at the given time
 *
 * @param {Date} date the time
 */
function findCoordinates(date) {
    let best = null;
    for (let lat = 0; lat <= 66; lat += 0.5) {
        for (let lon = -180; lon < 180; lon += 0.25) {
            const p = SunCalc.getPosition(date, lat, lon);
            const score = Math.abs(p.azimuth - 190) + Math.abs(p.altitude - 25);
            if (!best || score < best.score) {
                best = { lat, lon, score, az: p.azimuth, el: p.altitude };
            }
        }
    }
    return best;
}

/**
 * Builds one shutter row of native.events
 *
 * @param {string} key key of SH
 * @param {object} props properties of this shutter
 */
function shutter(key, props) {
    return {
        enabled: true,
        shutterName: SH[key].name,
        name: SH[key].id,
        triggerID: '',
        triggerState: 'closed',
        triggerStateTilted: 'none',
        triggerDrive: '100',
        triggerDriveTildet: '100',
        triggerChange: 'off',
        typeUp: 'living',
        typeDown: 'living',
        heightUp: '100',
        heightDown: '0',
        elevation: '4',
        type: 'only inside temperature',
        heightDownSun: '30',
        direction: '190',
        directionRange: '60',
        tempInside: '40',
        tempSensor: '',
        outsideTempSensor: '',
        tempOutside: '40',
        lightSensor: '',
        valueLight: '30',
        autoDrive: 'off',
        hysteresisOutside: '5',
        hysteresisInside: '5',
        hysteresisLight: '5',
        XmasLevel: '0',
        useXmasLevel: false,
        betweenPosition: false,
        betweenPositionLevel: '50',
        trigDelyUp: '0',
        trigDelyDown: '0',
        sunProtectEndDely: '0',
        tempHeatProtection: '40',
        LateDown: false,
        inSummerNotDown: false,
        KeepSunProtect: false,
        heatProtection: false,
        driveAfterClose: false,
        useOpenWindowLevel: false,
        enableAlarmWind1: false,
        enableAlarmWind2: false,
        enableAlarmRain: false,
        enableAlarmFrost: false,
        enableAlarmFire: false,
        ...props,
    };
}

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, '..'), {
    controllerVersion: 'latest',
    defineAdditionalTests({ suite }) {
        suite('Shuttercontrol with virtual shutters', getHarness => {
            let harness;
            let coords;
            let elevationThreshold;
            let config1;
            const findings = [];

            // ------------------------------------------------------------------------------------------------
            // helpers
            // ------------------------------------------------------------------------------------------------
            async function getState(id) {
                if (typeof harness.states.getStateAsync === 'function') {
                    return harness.states.getStateAsync(id);
                }
                return new Promise((resolve, reject) =>
                    harness.states.getState(id, (err, state) => (err ? reject(err) : resolve(state))),
                );
            }
            async function setState(id, val, ack) {
                // the states DB computes lc itself - but to be safe set it the same way the adapter-core does
                const old = await getState(id);
                const ts = Date.now();
                const lc = old && old.val === val ? old.lc : ts;
                const state = { val, ack: !!ack, ts, lc, from: 'system.adapter.test.0' };
                if (typeof harness.states.setStateAsync === 'function') {
                    return harness.states.setStateAsync(id, state);
                }
                return new Promise((resolve, reject) =>
                    harness.states.setState(id, state, err => (err ? reject(err) : resolve())),
                );
            }
            async function setObject(id, obj) {
                if (typeof harness.objects.setObjectAsync === 'function') {
                    return harness.objects.setObjectAsync(id, obj);
                }
                return new Promise((resolve, reject) =>
                    harness.objects.setObject(id, obj, err => (err ? reject(err) : resolve())),
                );
            }
            async function getObject(id) {
                if (typeof harness.objects.getObjectAsync === 'function') {
                    return harness.objects.getObjectAsync(id);
                }
                return new Promise((resolve, reject) =>
                    harness.objects.getObject(id, (err, obj) => (err ? reject(err) : resolve(obj))),
                );
            }
            async function val(id) {
                const s = await getState(id);
                return s ? s.val : undefined;
            }
            const level = key => val(SH[key].id);
            const autoState = key => val(`${NS}.shutters.autoState.${SH[key].dev}`);
            const autoLevel = key => val(`${NS}.shutters.autoLevel.${SH[key].dev}`);

            async function waitFor(fn, timeout = 15000, interval = 250) {
                const end = Date.now() + timeout;
                let last;
                while (Date.now() < end) {
                    last = await fn();
                    if (last) {
                        return last;
                    }
                    await wait(interval);
                }
                return fn();
            }
            /** waits until all shutters have the expected level; returns the current levels */
            async function expectLevels(expected, timeout = 15000) {
                let current = {};
                await waitFor(async () => {
                    current = {};
                    for (const k of Object.keys(expected)) {
                        current[k] = await level(k);
                    }
                    return Object.keys(expected).every(k => current[k] === expected[k]);
                }, timeout);
                assert.deepStrictEqual(current, expected);
                return current;
            }
            async function expectAutoStates(expected, timeout = 10000) {
                let current = {};
                await waitFor(async () => {
                    current = {};
                    for (const k of Object.keys(expected)) {
                        current[k] = await autoState(k);
                    }
                    return Object.keys(expected).every(k => current[k] === expected[k]);
                }, timeout);
                assert.deepStrictEqual(current, expected);
            }
            /** the harness refuses a second start of the same harness - allow it, the test needs a restart */
            async function restartAdapter() {
                harness._adapterExit = undefined;
                // the alive state of the stopped process is still true (no js-controller host process that resets
                // it) - the new process would exit with ADAPTER_ALREADY_RUNNING
                await setState('system.adapter.shuttercontrol.0.alive', false, true);
                await wait(1000);
                await harness.startAdapterAndWait();
            }
            async function press(button) {
                await setState(`${NS}.control.${button}`, true, false);
            }
            /** waits until the adapter has finished all pending checks of the shutter state (manual mode detection) */
            const settle = (ms = 8000) => wait(ms);

            async function allUp() {
                await press('openAll');
                await expectLevels({
                    living: 100,
                    sleep: 100,
                    children: 0,
                    livingAuto: 100,
                    sleepAuto: 100,
                    childrenAuto: 100,
                    light: 100,
                    golden: 100,
                    sunset: 100,
                });
                await settle();
            }

            function errorLogs() {
                return harness
                    .getLogs()
                    .filter(
                        l =>
                            l.level === 'error' ||
                            /unhandled|uncaught|TypeError|ReferenceError|is not a function|Cannot read prop/i.test(
                                l.message,
                            ),
                    )
                    .map(l => `${l.level}: ${l.message}`);
            }
            function warnLogs() {
                return harness
                    .getLogs('warn')
                    .map(l => l.message)
                    .filter(m => !/cannot calculate astrodata/.test(m));
            }

            async function createDevices() {
                const st = (id, common) =>
                    setObject(id, {
                        _id: id,
                        type: 'state',
                        common: { name: id, read: true, write: true, ...common },
                        native: {},
                    });
                for (const k of Object.keys(SH)) {
                    await st(SH[k].id, { type: 'number', role: 'level', min: 0, max: 100, unit: '%' });
                }
                for (const w of [DEV.win1, DEV.win2, DEV.win3]) {
                    await st(w, { type: 'string', role: 'value.window', states: 'closed;open;tilted' });
                }
                for (const t of [DEV.tIn, DEV.tIn2, DEV.tOut]) {
                    await st(t, { type: 'number', role: 'value.temperature', unit: '°C' });
                }
                for (const l of [DEV.lux, DEV.bright]) {
                    await st(l, { type: 'number', role: 'value.brightness', unit: 'lux' });
                }
                for (const a of [
                    DEV.wind1,
                    DEV.wind2,
                    DEV.rain,
                    DEV.frost,
                    DEV.fire,
                    DEV.holiday,
                    DEV.schoolfree,
                    DEV.autoLiving,
                    DEV.autoSleep,
                    DEV.autoChildren,
                ]) {
                    await st(a, { type: 'boolean', role: 'indicator' });
                }

                // initial values
                for (const k of Object.keys(SH)) {
                    await setState(SH[k].id, 50, true);
                }
                for (const w of [DEV.win1, DEV.win2, DEV.win3]) {
                    await setState(w, 'closed', true);
                }
                await setState(DEV.tIn, 18, true);
                await setState(DEV.tIn2, 18, true);
                await setState(DEV.tOut, 10, true);
                await setState(DEV.lux, 5, true);
                await setState(DEV.bright, 1000, true);
                for (const a of [DEV.wind1, DEV.wind2, DEV.rain, DEV.frost, DEV.fire]) {
                    await setState(a, false, true);
                }
                await setState(DEV.holiday, false, true);
                await setState(DEV.schoolfree, false, true);
                await setState(DEV.autoLiving, false, true);
                await setState(DEV.autoSleep, false, true);
                await setState(DEV.autoChildren, false, true);
            }

            function buildConfig(brightnessPhase) {
                const now = new Date();
                const yesterday = new Date(now.getTime() - 86400000);
                const tomorrow = new Date(now.getTime() + 86400000);
                // fixed times of the time based jobs: far away from now, so no job fires while the test runs
                const far = new Date(now.getTime() + 8 * 3600000);
                const far2 = new Date(now.getTime() + 9 * 3600000);
                const farA = hhmm(far);
                const farB = hhmm(far2);

                return {
                    UseAstro: true,
                    publicHolidays: false,
                    publicHolInstance: '',
                    HolidayDP: DEV.holiday,
                    schoolfreeDP: DEV.schoolfree,
                    UseSunMode: true,
                    currentShutterState: true,
                    currentShutterStateTime: 2,
                    blockManuMode: false,
                    shutterStateRound: 1,
                    satIsWeek: false,
                    livingAutomatic: 'livingTime',
                    W_shutterDownLiving: farA,
                    W_shutterUpLivingMin: farA,
                    W_shutterUpLivingMax: farA,
                    WE_shutterDownLiving: farB,
                    WE_shutterUpLivingMin: farB,
                    WE_shutterUpLivingMax: farB,
                    sleepAutomatic: 'sleepTime',
                    W_shutterUpSleepMax: farA,
                    W_shutterUpSleepMin: farA,
                    W_shutterDownSleep: farA,
                    WE_shutterUpSleepMax: farB,
                    WE_shutterUpSleepMin: farB,
                    WE_shutterDownSleep: farB,
                    childrenAutomatic: 'childrenSunriseSunset',
                    W_shutterUpChildrenMax: farA,
                    W_shutterUpChildrenMin: farA,
                    W_shutterDownChildren: farA,
                    WE_shutterUpChildrenMax: farB,
                    WE_shutterUpChildrenMin: farB,
                    WE_shutterDownChildren: farB,
                    driveDelayUpLiving: 0,
                    driveDelayUpSleep: 0,
                    driveDelayUpChildren: 0,
                    driveDelayUpAstro: 0,
                    triggerAutoLiving: DEV.autoLiving,
                    triggerAutoSleep: DEV.autoSleep,
                    triggerAutoChildren: DEV.autoChildren,
                    astroDelayUp: 0,
                    astroDelayDown: 0,
                    latitude: String(coords.lat),
                    longitude: String(coords.lon),
                    sunProtEndElevation: 10,
                    LateAllDown: false,
                    LateAllDownTime: farA,
                    XMasStart: ddmm(yesterday),
                    XMasEnd: ddmm(tomorrow),
                    betweenPositionTime: '23:59',
                    schoolfree: false,
                    schoolfreeInstance: '',
                    schoolfreeLivingArea: true,
                    schoolfreeSleepArea: true,
                    schoolfreeChildrenArea: true,
                    lightsensorUpDown: DEV.bright,
                    lightsensorDown: 400,
                    lightsensorUp: 500,
                    lightsensorUpTime: '00:00',
                    // phase 1: brightness up is possible (now < down time), phase 2: brightness down is possible
                    lightsensorDownTime: brightnessPhase === 1 ? '23:59' : '00:00',
                    alarmWind1: DEV.wind1,
                    alarmWind2: DEV.wind2,
                    alarmRain: DEV.rain,
                    alarmFrost: DEV.frost,
                    alarmFire: DEV.fire,
                    alarmWind1Level: 95,
                    alarmWind2Level: 85,
                    alarmRainLevel: 75,
                    alarmFrostLevel: 80,
                    alarmFireLevel: 65,
                    events: [
                        shutter('living', {
                            typeUp: 'living',
                            typeDown: 'living',
                            triggerID: DEV.win1,
                            triggerState: 'closed',
                            triggerStateTilted: 'tilted',
                            triggerDrive: '100',
                            triggerDriveTildet: '50',
                            triggerChange: 'upDown',
                            type: 'in- & outside temperature',
                            heightDownSun: '30',
                            tempSensor: DEV.tIn,
                            outsideTempSensor: DEV.tOut,
                            lightSensor: DEV.lux,
                            tempInside: '22',
                            tempOutside: '20',
                            valueLight: '30',
                            enableAlarmWind1: true,
                            enableAlarmRain: true,
                        }),
                        shutter('sleep', {
                            typeUp: 'sleep',
                            typeDown: 'sleep',
                            triggerID: DEV.win2,
                            triggerChange: 'onlyUp',
                            triggerDrive: '100',
                            type: 'only direction',
                            heightDownSun: '40',
                            direction: '190',
                            directionRange: '60',
                            enableAlarmWind2: true,
                            enableAlarmFire: true,
                        }),
                        shutter('children', {
                            typeUp: 'children',
                            typeDown: 'children',
                            heightUp: '0',
                            heightDown: '100',
                            triggerID: DEV.win3,
                            triggerChange: 'upDown',
                            triggerDrive: '0',
                            triggerDriveTildet: '0',
                            type: 'only inside temperature',
                            tempSensor: DEV.tIn2,
                            tempInside: '24',
                            heightDownSun: '70',
                            enableAlarmFrost: true,
                            enableAlarmWind1: true,
                        }),
                        shutter('livingAuto', {
                            typeUp: 'living-auto',
                            typeDown: 'living-auto',
                            type: 'in- & outside temperature and direction',
                            tempSensor: DEV.tIn,
                            outsideTempSensor: DEV.tOut,
                            tempInside: '22',
                            tempOutside: '20',
                            heightDownSun: '25',
                            direction: '190',
                            directionRange: '60',
                            enableAlarmFire: true,
                        }),
                        shutter('sleepAuto', { typeUp: 'sleep-auto', typeDown: 'sleep-auto', heightDownSun: '35' }),
                        shutter('childrenAuto', {
                            typeUp: 'children-auto',
                            typeDown: 'children-auto',
                            heightDownSun: '45',
                        }),
                        shutter('elevation', {
                            typeUp: 'sunrise',
                            typeDown: 'elevation',
                            elevation: String(elevationThreshold),
                            betweenPosition: true,
                            betweenPositionLevel: '40',
                        }),
                        shutter('light', {
                            typeUp: 'lightsensor',
                            typeDown: 'lightsensor',
                            useXmasLevel: true,
                            XmasLevel: '20',
                        }),
                        shutter('golden', { typeUp: 'goldenhour End', typeDown: 'goldenhour' }),
                        shutter('sunset', { typeUp: 'sunrise', typeDown: 'sunset' }),
                        shutter('manual', { typeUp: 'manual-only', typeDown: 'manual-only' }),
                        shutter('disabled', { enabled: false, typeUp: 'living', typeDown: 'living' }),
                    ],
                };
            }

            // ------------------------------------------------------------------------------------------------
            // tests
            // ------------------------------------------------------------------------------------------------

            it('start-up: creates virtual devices, starts the adapter without errors', async function () {
                this.timeout(180000);
                harness = getHarness();

                // the first sun position is calculated at the next full 5 minutes after the start
                const startup = new Date(Date.now() + 40000);
                const firstTick = new Date(Math.ceil(startup.getTime() / 300000) * 300000);
                coords = findCoordinates(firstTick);
                const pos = SunCalc.getPosition(firstTick, coords.lat, coords.lon);
                // elevationDown needs: threshold - 1 <= elevation <= threshold
                elevationThreshold = round1(pos.altitude + 0.5);
                console.log(
                    `    coordinates lat=${coords.lat} lon=${coords.lon} -> at ${firstTick.toISOString()} azimuth=${round1(pos.azimuth)} elevation=${round1(pos.altitude)} (elevation threshold ${elevationThreshold})`,
                );

                await createDevices();
                config1 = buildConfig(1);
                await harness.changeAdapterConfig('shuttercontrol', { native: config1 });
                await harness.startAdapterAndWait();

                // all objects of the shutters are created (createShutter)
                await waitFor(() => getObject(`${NS}.shutters.autoLevel.${SH.disabled.dev}`), 60000, 500);
                for (const k of Object.keys(SH)) {
                    for (const f of ['autoUp', 'autoDown', 'autoSun', 'autoState', 'autoLevel']) {
                        const obj = await getObject(`${NS}.shutters.${f}.${SH[k].dev}`);
                        assert.ok(obj, `object shutters.${f}.${SH[k].dev} missing`);
                    }
                }
                await waitFor(async () => (await val(`${NS}.shutters.autoLevel.${SH.disabled.dev}`)) !== undefined);
                // autoSun is only switched on for the shutters of the sun protection test (see below)
                for (const k of Object.keys(SH)) {
                    assert.strictEqual(await val(`${NS}.shutters.autoUp.${SH[k].dev}`), true);
                    assert.strictEqual(await val(`${NS}.shutters.autoDown.${SH[k].dev}`), true);
                    assert.strictEqual(await val(`${NS}.shutters.autoSun.${SH[k].dev}`), true);
                    assert.strictEqual(await val(`${NS}.shutters.autoState.${SH[k].dev}`), 'none');
                }
                // keep the sun protection off until the sun protection test
                for (const k of Object.keys(SH)) {
                    await setState(`${NS}.shutters.autoSun.${SH[k].dev}`, false, true);
                }
                // the elevation shutter must only be driven by elevationDown
                assert.deepStrictEqual(errorLogs(), []);
            });

            it('start-up: control states initialised, info times computed', async function () {
                this.timeout(60000);
                for (const c of ['Holiday', 'schoolfree', 'autoLiving', 'autoSleep', 'autoChildren']) {
                    const s = await waitFor(async () => {
                        const st = await getState(`${NS}.control.${c}`);
                        return st && st.val !== null ? st : null;
                    }, 20000);
                    assert.ok(s, `control.${c} is null`);
                    assert.strictEqual(s.val, false, `control.${c}`);
                }
                const times = await SunCalc.getTimes(new Date(), coords.lat, coords.lon);
                const expected = {
                    Sunrise: hhmm(times.sunrise),
                    Sunset: hhmm(times.sunset),
                    GoldenHour: hhmm(times.goldenHour),
                    GoldenHourEnd: hhmm(times.goldenHourEnd),
                };
                for (const k of Object.keys(expected)) {
                    const v = await waitFor(() => val(`${NS}.info.${k}`), 20000);
                    assert.strictEqual(v, expected[k], `info.${k}`);
                }
                for (const k of [
                    'upTimeLiving',
                    'upTimeSleep',
                    'upTimeChildren',
                    'downTimeLiving',
                    'downTimeSleep',
                    'downTimeChildren',
                ]) {
                    const v = await val(`${NS}.info.${k}`);
                    assert.match(String(v), /^\d\d:\d\d$/, `info.${k} = ${v}`);
                }
                // shutters.currentStates is written ~2s per shutter after the start
                const cs = await waitFor(async () => {
                    const v = await val(`${NS}.shutters.currentStates`);
                    try {
                        const o = JSON.parse(v);
                        return Object.keys(o).length === Object.keys(SH).length ? o : null;
                    } catch {
                        return null;
                    }
                }, 45000, 1000);
                assert.ok(cs, 'shutters.currentStates not written');
                assert.deepStrictEqual(Object.keys(cs).sort(), Object.values(SH).map(s => s.dev).sort());
                assert.deepStrictEqual(errorLogs(), []);
            });

            it('sun position: info.Elevation / info.Azimut filled and elevation shutter driven (elevationDown)', async function () {
                this.timeout(400000);
                const el = await waitFor(async () => {
                    const v = await val(`${NS}.info.Elevation`);
                    return typeof v === 'number' ? v : null;
                }, 380000, 1000);
                const az = await val(`${NS}.info.Azimut`);
                const pos = SunCalc.getPosition(new Date(), coords.lat, coords.lon);
                console.log(`    info.Elevation=${el} info.Azimut=${az} (expected ~${round1(pos.altitude)}/${round1(pos.azimuth)})`);
                assert.ok(Math.abs(el - pos.altitude) < 1, 'elevation differs');
                assert.ok(Math.abs(az - pos.azimuth) < 2, 'azimuth differs');
                // elevationDown: elevation within [threshold - 1, threshold] and azimuth > 180 -> between position 40 (time < 23:59)
                await expectLevels({ elevation: 40 }, 20000);
                await expectAutoStates({ elevation: 'middle' });
                // all other shutters were not moved (autoSun is off, no time job)
                await expectLevels({ living: 50, sleep: 50, children: 50, golden: 50, manual: 50, disabled: 50 }, 1000);
                // from now on keep the elevation shutter out of the other tests
                await setState(`${NS}.shutters.autoDown.${SH.elevation.dev}`, false, true);
                assert.deepStrictEqual(errorLogs(), []);
            });

            it('control buttons: openAll / closeAll', async function () {
                this.timeout(120000);
                await allUp();
                await expectLevels({ elevation: 100, manual: 50, disabled: 50 }, 1000);
                await expectAutoStates({ living: 'up', children: 'up', light: 'up', manual: 'none', disabled: 'none' });
                assert.strictEqual(await autoLevel('living'), 100);
                assert.strictEqual(await autoLevel('children'), 0);

                await press('closeAll');
                await expectLevels({
                    living: 0,
                    sleep: 0,
                    children: 100,
                    livingAuto: 0,
                    sleepAuto: 0,
                    childrenAuto: 0,
                    elevation: 0,
                    light: 0,
                    golden: 0,
                    sunset: 0,
                    manual: 50,
                    disabled: 50,
                });
                await expectAutoStates({ living: 'down', children: 'down', golden: 'down' });
                assert.strictEqual(await autoLevel('children'), 100);
                await settle();
                assert.deepStrictEqual(errorLogs(), []);
            });

            it('control buttons: open/close living, sleep, children', async function () {
                this.timeout(180000);
                await allUp();
                await press('closeLiving');
                await expectLevels({ living: 0, livingAuto: 0, sleep: 100, sleepAuto: 100, children: 0, childrenAuto: 100 });
                await settle();
                await press('openLiving');
                await expectLevels({ living: 100, livingAuto: 100 });
                await settle();

                await press('closeSleep');
                await expectLevels({ sleep: 0, sleepAuto: 0, living: 100, children: 0 });
                await settle();
                await press('openSleep');
                await expectLevels({ sleep: 100, sleepAuto: 100 });
                await settle();

                await press('closeChildren');
                await expectLevels({ children: 100, childrenAuto: 0, living: 100, sleep: 100 });
                await settle();
                await press('openChildren');
                await expectLevels({ children: 0, childrenAuto: 100 });
                await settle();
                await expectLevels({ manual: 50, disabled: 50 }, 1000);
                assert.deepStrictEqual(errorLogs(), []);
            });

            it('control buttons: sunProtect / sunProtectLiving / sunProtectSleep / sunProtectChildren / autoAll', async function () {
                this.timeout(180000);
                await allUp();
                await press('sunProtectLiving');
                await expectLevels({ living: 30, livingAuto: 25, sleep: 100, children: 0 });
                await expectAutoStates({ living: 'manu_sunProtect', livingAuto: 'manu_sunProtect' });
                await settle();
                // autoAll: shutters at sun protect height -> sunProtect, at up height -> up (no drive)
                await press('autoAll');
                await expectAutoStates({ living: 'sunProtect', sleep: 'up' });
                await expectLevels({ living: 30, livingAuto: 25, sleep: 100 }, 2000);
                await settle();

                await press('sunProtectSleep');
                await expectLevels({ sleep: 40, sleepAuto: 35 });
                await settle();
                await press('sunProtectChildren');
                await expectLevels({ children: 70, childrenAuto: 45 });
                await settle();

                await allUp();
                await press('sunProtect');
                await expectLevels({
                    living: 30,
                    sleep: 40,
                    children: 70,
                    livingAuto: 25,
                    sleepAuto: 35,
                    childrenAuto: 45,
                    light: 30,
                    golden: 30,
                    manual: 50,
                    disabled: 50,
                });
                await settle();
                await allUp();
                assert.deepStrictEqual(errorLogs(), []);
            });

            it('control.autoLiving/autoSleep/autoChildren, Holiday, schoolfree: accepted, acked, times recalculated', async function () {
                this.timeout(120000);
                // via the configured trigger data points -> written with ack=true by the adapter
                await setState(DEV.autoLiving, true, true);
                await setState(DEV.autoSleep, true, true);
                await setState(DEV.autoChildren, true, true);
                for (const c of ['autoLiving', 'autoSleep', 'autoChildren']) {
                    const s = await waitFor(async () => {
                        const st = await getState(`${NS}.control.${c}`);
                        return st && st.val === true && st.ack ? st : null;
                    });
                    assert.ok(s, `control.${c} not set to true/ack by the trigger data point`);
                }
                // Holiday via HolidayDP -> control.Holiday and weekend times
                const W = await val(`${NS}.info.upTimeLiving`);
                await setState(DEV.holiday, true, true);
                const h = await waitFor(async () => {
                    const st = await getState(`${NS}.control.Holiday`);
                    return st && st.val === true && st.ack ? st : null;
                });
                assert.ok(h, 'control.Holiday not set by HolidayDP');
                const cfg = config1;
                await waitFor(async () => (await val(`${NS}.info.upTimeLiving`)) === cfg.WE_shutterUpLivingMax);
                assert.strictEqual(await val(`${NS}.info.upTimeLiving`), cfg.WE_shutterUpLivingMax);
                assert.strictEqual(await val(`${NS}.info.upTimeSleep`), cfg.WE_shutterUpSleepMax);
                await setState(DEV.holiday, false, true);
                await waitFor(async () => (await val(`${NS}.control.Holiday`)) === false);
                console.log(`    upTimeLiving before holiday: ${W}, weekend value ${cfg.WE_shutterUpLivingMax}`);

                await setState(DEV.schoolfree, true, true);
                const sf = await waitFor(async () => {
                    const st = await getState(`${NS}.control.schoolfree`);
                    return st && st.val === true && st.ack ? st : null;
                });
                assert.ok(sf, 'control.schoolfree not set by schoolfreeDP');
                await waitFor(async () => (await val(`${NS}.info.upTimeSleep`)) === cfg.WE_shutterUpSleepMax);
                assert.strictEqual(await val(`${NS}.info.upTimeSleep`), cfg.WE_shutterUpSleepMax);
                await setState(DEV.schoolfree, false, true);
                await waitFor(async () => (await val(`${NS}.control.schoolfree`)) === false);

                // direct writes of the control states (ack=false, like a user in admin / VIS)
                for (const c of ['autoLiving', 'autoSleep', 'autoChildren', 'Holiday', 'schoolfree']) {
                    const before = await val(`${NS}.control.${c}`);
                    await setState(`${NS}.control.${c}`, !before, false);
                }
                await wait(3000);
                const notAcked = [];
                for (const c of ['autoLiving', 'autoSleep', 'autoChildren', 'Holiday', 'schoolfree']) {
                    const st = await getState(`${NS}.control.${c}`);
                    if (!st.ack) {
                        notAcked.push(c);
                    }
                }
                if (notAcked.length) {
                    findings.push(`control.* written with ack=false are not acknowledged by the adapter: ${notAcked.join(', ')}`);
                    console.log(`    NOTE: not acknowledged: ${notAcked.join(', ')}`);
                }
                // Holiday=true written directly -> weekend times
                if ((await val(`${NS}.control.Holiday`)) === true) {
                    await waitFor(async () => (await val(`${NS}.info.upTimeLiving`)) === cfg.WE_shutterUpLivingMax);
                    assert.strictEqual(await val(`${NS}.info.upTimeLiving`), cfg.WE_shutterUpLivingMax);
                }
                // reset
                for (const c of ['autoLiving', 'autoSleep', 'autoChildren', 'Holiday', 'schoolfree']) {
                    await setState(`${NS}.control.${c}`, false, true);
                }
                await setState(DEV.autoLiving, false, true);
                await setState(DEV.autoSleep, false, true);
                await setState(DEV.autoChildren, false, true);
                await wait(2000);
                assert.deepStrictEqual(errorLogs(), []);
            });

            it('window trigger (upDown): open -> triggerDrive, tilted -> triggerDriveTildet, closed -> back', async function () {
                this.timeout(120000);
                await allUp();
                await press('closeLiving');
                await expectLevels({ living: 0 });
                await settle();
                await setState(DEV.win1, 'open', true);
                await expectLevels({ living: 100 });
                await expectAutoStates({ living: 'triggered' });
                await settle();
                await setState(DEV.win1, 'tilted', true);
                await expectLevels({ living: 50 });
                await settle();
                await setState(DEV.win1, 'closed', true);
                await expectLevels({ living: 0 });
                await expectAutoStates({ living: 'down' });
                await settle();
                // a closed button while the window is open: shutter stays open, drives down after the window is closed
                assert.deepStrictEqual(errorLogs(), []);
            });

            it('window trigger (onlyUp): open -> up, closed -> stays', async function () {
                this.timeout(120000);
                await press('closeSleep');
                await expectLevels({ sleep: 0 });
                await settle();
                await setState(DEV.win2, 'open', true);
                await expectLevels({ sleep: 100 });
                await settle();
                await setState(DEV.win2, 'closed', true);
                await wait(5000);
                await expectLevels({ sleep: 100 }, 1000);
                await settle();
                assert.deepStrictEqual(errorLogs(), []);
            });

            it('window trigger with level conversion (children: up=0, down=100)', async function () {
                this.timeout(120000);
                await press('closeChildren');
                await expectLevels({ children: 100 });
                await settle();
                await setState(DEV.win3, 'open', true);
                await expectLevels({ children: 0 });
                await settle();
                await setState(DEV.win3, 'closed', true);
                await expectLevels({ children: 100 });
                await settle();
                assert.deepStrictEqual(errorLogs(), []);
            });

            it('manual move of a shutter -> Manu_Mode, window closes back to the manual level', async function () {
                this.timeout(120000);
                await allUp();
                await press('closeLiving');
                await expectLevels({ living: 0 });
                await settle();
                // physical move by the user
                await setState(SH.living.id, 60, true);
                await expectAutoStates({ living: 'Manu_Mode' }, 15000);
                await waitFor(async () => (await autoLevel('living')) === 60, 15000);
                assert.strictEqual(await autoLevel('living'), 60);
                await settle(12000);
                await setState(DEV.win1, 'open', true);
                await expectLevels({ living: 100 });
                await settle();
                await setState(DEV.win1, 'closed', true);
                await expectLevels({ living: 60 });
                await expectAutoStates({ living: 'Manu_Mode' });
                await settle();
                assert.deepStrictEqual(errorLogs(), []);
            });

            it('alarms: wind1 / wind2 / rain / frost / fire', async function () {
                this.timeout(300000);
                await allUp();
                await press('closeAll');
                await expectLevels({ living: 0, sleep: 0, children: 100, livingAuto: 0 });
                await settle();

                // wind 1: living + children -> 95, back after the alarm
                await setState(DEV.wind1, true, true);
                await expectLevels({ living: 95, children: 95, sleep: 0, livingAuto: 0 });
                await expectAutoStates({ living: 'wind1', children: 'wind1' });
                await settle();
                await setState(DEV.wind1, false, true);
                await expectLevels({ living: 0, children: 100 });
                await expectAutoStates({ living: 'down', children: 'down' });
                await settle();
                // refresh of the alarm state with the same value -> no action
                await setState(DEV.wind1, false, true);
                await wait(3000);
                await expectLevels({ living: 0, children: 100 }, 1000);

                // wind 2: sleep -> 85
                await setState(DEV.wind2, true, true);
                await expectLevels({ sleep: 85, living: 0 });
                await settle();
                await setState(DEV.wind2, false, true);
                await expectLevels({ sleep: 0 });
                await settle();

                // rain: living -> 75
                await setState(DEV.rain, true, true);
                await expectLevels({ living: 75, sleep: 0 });
                await settle();
                // window trigger is ignored while the alarm is pending? (just make sure nothing breaks)
                await setState(DEV.rain, false, true);
                await expectLevels({ living: 0 });
                await settle();

                // frost: children (closed at 100, converted) -> 80
                await setState(DEV.frost, true, true);
                await expectLevels({ children: 80, living: 0 });
                await settle();
                // closing while frost -> frost level
                await press('closeChildren');
                await wait(3000);
                await expectLevels({ children: 80 }, 3000);
                await settle();
                await setState(DEV.frost, false, true);
                await expectLevels({ children: 100 });
                await settle();

                // fire: sleep + livingAuto -> 65, no drive back after the alarm
                await setState(DEV.fire, true, true);
                await expectLevels({ sleep: 65, livingAuto: 65, living: 0 });
                await expectAutoStates({ sleep: 'fire', livingAuto: 'fire' });
                await settle();
                // buttons have no effect on a shutter with a pending fire alarm? (close)
                await setState(DEV.fire, false, true);
                await wait(5000);
                await expectLevels({ sleep: 65, livingAuto: 65 }, 1000);

                // combined: wind1 + rain on living, back only after both ended
                await press('closeLiving');
                await expectLevels({ living: 0 });
                await settle();
                await setState(DEV.wind1, true, true);
                await expectLevels({ living: 95 });
                await settle();
                await setState(DEV.rain, true, true);
                await wait(5000);
                const lvRainWind = await level('living');
                console.log(`    living with wind1 + rain: ${lvRainWind}`);
                await setState(DEV.wind1, false, true);
                await wait(5000);
                const lvRainOnly = await level('living');
                console.log(`    living after wind1 ended, rain still pending: ${lvRainOnly}`);
                assert.notStrictEqual(lvRainOnly, 0, 'living drove back although the rain alarm is still pending');
                await setState(DEV.rain, false, true);
                await expectLevels({ living: 0 });
                await settle();
                assert.deepStrictEqual(errorLogs(), []);
            });

            it('sun protection: info.Azimut write (ack=false) triggers sunProtect (only direction)', async function () {
                this.timeout(180000);
                await allUp();
                await setState(`${NS}.shutters.autoSun.${SH.sleep.dev}`, true, true);
                await setState(`${NS}.info.Azimut`, 999, false);
                await expectLevels({ sleep: 40 }, 20000);
                await expectAutoStates({ sleep: 'sunProtect' });
                await settle();
                await setState(`${NS}.shutters.autoSun.${SH.sleep.dev}`, false, true);
                // info.Elevation write: elevationDown runs with the internally calculated elevation, the written
                // value is not used -> nothing happens to the other shutters
                await setState(`${NS}.info.Elevation`, -5, false);
                await wait(5000);
                await expectLevels({ living: 100, children: 0, golden: 100 }, 1000);
                assert.deepStrictEqual(errorLogs(), []);
            });

            it('sun protection by temperature / light sensors incl. hysteresis', async function () {
                this.timeout(240000);
                await allUp();
                for (const k of ['living', 'livingAuto', 'children']) {
                    await setState(`${NS}.shutters.autoSun.${SH[k].dev}`, true, true);
                }
                await setState(DEV.tOut, 30, true);
                await setState(DEV.lux, 50, true);
                await wait(3000);
                await expectLevels({ living: 100, livingAuto: 100 }, 1000); // inside temperature still low
                await setState(DEV.tIn, 25, true);
                await expectLevels({ living: 30, livingAuto: 25 }, 30000);
                await expectAutoStates({ living: 'sunProtect', livingAuto: 'sunProtect' });
                await settle();

                await setState(DEV.tIn2, 26, true);
                await expectLevels({ children: 70 }, 30000);
                await settle();

                // hysteresis: 21.5 < 22 but > 22 * 0.95 -> sun protection stays
                await setState(DEV.tIn, 21.5, true);
                await wait(8000);
                await expectLevels({ living: 30, livingAuto: 25 }, 1000);
                // 20 < 20.9 -> sun protection ends
                await setState(DEV.tIn, 20, true);
                await expectLevels({ living: 100, livingAuto: 100 }, 30000);
                await settle();
                await setState(DEV.tIn2, 20, true);
                await expectLevels({ children: 0 }, 30000);
                await settle();

                for (const k of ['living', 'livingAuto', 'children']) {
                    await setState(`${NS}.shutters.autoSun.${SH[k].dev}`, false, true);
                }
                await setState(DEV.tOut, 10, true);
                assert.deepStrictEqual(errorLogs(), []);
            });

            it('brightness sensor (lightsensorUpDown): up above lightsensorUp', async function () {
                this.timeout(120000);
                await press('closeAll');
                await expectLevels({ light: 0 });
                await settle();
                await setState(DEV.bright, 450, true); // between down and up -> nothing
                await wait(4000);
                await expectLevels({ light: 0 }, 1000);
                await setState(DEV.bright, 1200, true);
                await expectLevels({ light: 100 }, 20000);
                await expectAutoStates({ light: 'up' });
                await settle(12000);
                assert.deepStrictEqual(errorLogs(), []);
            });

            let savedStates;
            it('restart: shutters.currentStates persisted and restored', async function () {
                this.timeout(240000);
                // a defined state: living in manual mode at 60, children down
                await press('closeChildren');
                await expectLevels({ children: 100 });
                await settle(12000);
                savedStates = JSON.parse(await val(`${NS}.shutters.currentStates`));
                console.log(`    currentStates before restart: living=${JSON.stringify(savedStates[SH.living.dev])}`);
                assert.strictEqual(savedStates[SH.children.dev].currentAction, 'down');
                assert.strictEqual(Number(savedStates[SH.children.dev].currentHeight), 100);

                const t0 = Date.now();
                await harness.stopAdapter();
                const stopTime = Date.now() - t0;
                console.log(`    adapter stopped in ${stopTime} ms, exit: ${harness.adapterExit}`);
                assert.ok(stopTime < 15000, `stop took ${stopTime} ms`);
                assert.strictEqual(harness.getLogs().filter(l => /cleaned everything up/.test(l.message)).length, 1, 'onUnload not called');
                assert.deepStrictEqual(errorLogs(), []);

                await restartAdapter();
                await wait(30000); // saveCurrentStates(true) writes the states after ~2s per shutter
                const restored = JSON.parse(await val(`${NS}.shutters.currentStates`));
                for (const k of Object.keys(SH)) {
                    const a = savedStates[SH[k].dev];
                    const b = restored[SH[k].dev];
                    assert.deepStrictEqual(b, a, `currentStates of ${k} changed by the restart`);
                }
                // restored runtime values are used: window open on children -> 0, closed -> back to 100 (triggerHeight)
                await setState(DEV.win3, 'open', true);
                await expectLevels({ children: 0 });
                await settle();
                await setState(DEV.win3, 'closed', true);
                await expectLevels({ children: 100 });
                await expectAutoStates({ children: 'down' });
                await settle();
                assert.deepStrictEqual(errorLogs(), []);
            });

            it('brightness sensor (lightsensorUpDown): down below lightsensorDown with xmas level (config phase 2)', async function () {
                this.timeout(240000);
                await harness.stopAdapter();
                await harness.changeAdapterConfig('shuttercontrol', { native: buildConfig(2) });
                await restartAdapter();
                await wait(15000);
                await allUp();
                await setState(DEV.bright, 100, true);
                // xmas period is active and useXmasLevel -> XmasLevel 20 instead of heightDown
                await expectLevels({ light: 20 }, 20000);
                await expectAutoStates({ light: 'Xmas' });
                await expectLevels({ living: 100, golden: 100 }, 1000);
                await settle(12000);
                assert.deepStrictEqual(errorLogs(), []);
            });

            it('unload: adapter stops cleanly, no errors / unhandled rejections in the whole log', async function () {
                this.timeout(60000);
                const t0 = Date.now();
                await harness.stopAdapter();
                const stopTime = Date.now() - t0;
                console.log(`    adapter stopped in ${stopTime} ms, exit: ${harness.adapterExit}`);
                assert.ok(stopTime < 15000, `stop took ${stopTime} ms`);
                assert.strictEqual(harness.getLogs().filter(l => /cleaned everything up/.test(l.message)).length, 3, 'onUnload not called');
                const errs = errorLogs();
                const warns = warnLogs();
                if (warns.length) {
                    console.log(`    warnings:\n      ${warns.join('\n      ')}`);
                }
                if (findings.length) {
                    console.log(`    findings:\n      ${findings.join('\n      ')}`);
                }
                assert.deepStrictEqual(errs, []);
                assert.ok(!harness.getLogs().some(l => /timer|timeout/i.test(l.message) && l.level !== 'debug' && l.level !== 'info'),
                    'timer related warnings/errors in the log');
            });
        });
    },
});
