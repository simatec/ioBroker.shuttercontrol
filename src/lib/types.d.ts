/**
 * Shared types of the shuttercontrol backend.
 *
 * `ShuttercontrolAdapterOptions` gives `adapter.config` its type (see lib/@types/adapter-config.d.ts).
 * It is kept in sync with the `native` section of io-package.json by test/types.js.
 */

/**
 * Values of a shutter row which the former materialize page stored as strings and newer configurations
 * may store as numbers. The backend works with both, so both are allowed here.
 */
export type ShutterValue = string | number;

/**
 * Switches of a shutter row. They are booleans, but older configurations stored some of them as
 * the strings 'true' / 'false', which the backend still accepts.
 */
export type ShutterFlag = boolean | string;

/** Runtime value of a foreign state, as it is copied into the shutter settings */
export type ShutterStateValue = ioBroker.StateValue | undefined;

/**
 * One row of `native.events` - the configuration of a single shutter, plus the runtime fields the
 * backend stores in it while the adapter is running.
 */
export interface ShutterSettings {
    enabled: ShutterFlag;
    shutterName: string;
    /** object ID of the level state of the shutter */
    name: string;
    triggerID: string;
    triggerState: ShutterValue;
    triggerStateTilted: ShutterValue;
    triggerDrive: ShutterValue;
    triggerDriveTildet: ShutterValue;
    triggerChange: string;
    typeUp: string;
    typeDown: string;
    heightUp: ShutterValue;
    heightDown: ShutterValue;
    elevation: ShutterValue;
    type: string;
    heightDownSun: ShutterValue;
    direction: ShutterValue;
    directionRange: ShutterValue;
    tempInside: ShutterValue;
    tempSensor: string;
    outsideTempSensor: string;
    tempOutside: ShutterValue;
    lightSensor: string;
    valueLight: ShutterValue;
    autoDrive: string;
    hysteresisOutside: ShutterValue;
    hysteresisInside: ShutterValue;
    hysteresisLight: ShutterValue;
    XmasLevel: ShutterValue;
    betweenPositionLevel: ShutterValue;
    trigDelyUp: ShutterValue;
    trigDelyDown: ShutterValue;
    sunProtectEndDely: ShutterValue;
    tempHeatProtection: ShutterValue;
    LateDown: ShutterFlag;
    inSummerNotDown: ShutterFlag;
    KeepSunProtect: ShutterFlag;
    heatProtection: ShutterFlag;
    driveAfterClose: ShutterFlag;
    useXmasLevel: ShutterFlag;
    betweenPosition: ShutterFlag;
    useOpenWindowLevel: ShutterFlag;
    enableAlarmWind1: ShutterFlag;
    enableAlarmWind2: ShutterFlag;
    enableAlarmRain: ShutterFlag;
    enableAlarmFrost: ShutterFlag;
    enableAlarmFire: ShutterFlag;
    ignoreTriggerAutoState?: ShutterFlag;

    // ---- runtime fields, written by the backend ----
    currentAction: string;
    currentHeight: ShutterStateValue;
    oldHeight: ShutterStateValue;
    triggerHeight: ShutterStateValue;
    triggerAction: string;
    firstCompleteUp: ShutterFlag;
    sunProtectEndtimerid: ShutterValue;
    alarmTriggerAction: string;
    alarmTriggerLevel: ShutterStateValue;
    lastAutoAction: string;
}

/** The persisted runtime fields of one shutter in `shutters.info.*` / saveCurrentStates */
export type ShutterRuntimeState = Pick<
    ShutterSettings,
    | 'shutterName'
    | 'currentAction'
    | 'currentHeight'
    | 'triggerAction'
    | 'triggerHeight'
    | 'oldHeight'
    | 'firstCompleteUp'
    | 'alarmTriggerAction'
    | 'alarmTriggerLevel'
    | 'lastAutoAction'
>;

/** Adapter settings, the `native` section of io-package.json */
export interface ShuttercontrolAdapterOptions {
    UseAstro: boolean;
    publicHolidays: boolean;
    publicHolInstance: string;
    HolidayDP: string;
    schoolfreeDP: string;
    UseSunMode: boolean;
    currentShutterState: boolean;
    currentShutterStateTime: number;
    blockManuMode: boolean;
    shutterStateRound: number;
    satIsWeek: boolean;
    W_shutterDownLiving: string;
    W_shutterUpLivingMin: string;
    W_shutterUpLivingMax: string;
    WE_shutterDownLiving: string;
    WE_shutterUpLivingMin: string;
    WE_shutterUpLivingMax: string;
    driveDelayUpLiving: number;
    driveHeightUpLiving: number;
    driveHeightDownLiving: number;
    triggerAutoLiving: string;
    livingAutomatic: string;
    W_shutterUpSleepMax: string;
    W_shutterUpSleepMin: string;
    W_shutterDownSleep: string;
    WE_shutterUpSleepMax: string;
    WE_shutterUpSleepMin: string;
    WE_shutterDownSleep: string;
    driveDelayUpSleep: number;
    driveHeightUpSleep: number;
    driveHeightDownSleep: number;
    triggerAutoSleep: string;
    sleepAutomatic: string;
    W_shutterUpChildrenMax: string;
    W_shutterUpChildrenMin: string;
    W_shutterDownChildren: string;
    WE_shutterUpChildrenMax: string;
    WE_shutterUpChildrenMin: string;
    WE_shutterDownChildren: string;
    driveDelayUpChildren: number;
    driveHeightUpChildren: number;
    driveHeightDownChildren: number;
    triggerAutoChildren: string;
    childrenAutomatic: string;
    astroDelayUp: number;
    longitude: string;
    latitude: string;
    astroDelayDown: number;
    driveHeightUpAstro: number;
    driveHeightDownAstro: number;
    driveDelayUpAstro: number;
    sleepEnum: string;
    livingEnum: string;
    livingEnumAuto: string;
    sleepEnumAuto: string;
    sunMonthStart: number;
    sunMonthEnd: number;
    sun_shutterUp: string;
    sun_shutterDown: string;
    sunProtecEnum: string;
    driveHeightSun: number;
    sunProtEndElevation: number;
    LateAllDown: boolean;
    LateAllDownTime: string;
    SummerStart: string;
    SummerEnd: string;
    XMasStart: string;
    XMasEnd: string;
    useXmasLevel: boolean;
    betweenPosition: boolean;
    noGoTime: number;
    betweenPositionTime: string;
    schoolfree: boolean;
    schoolfreeSleepArea: boolean;
    schoolfreeLivingArea: boolean;
    schoolfreeChildrenArea: boolean;
    schoolfreeInstance: string;
    lightsensorDown: number;
    lightsensorDownTime: string;
    lightsensorUp: number;
    lightsensorUpTime: string;
    lightsensorUpDown: string;
    alarmWind1Level: number;
    alarmWind2Level: number;
    alarmRainLevel: number;
    alarmFrostLevel: number;
    alarmFireLevel: number;
    alarmWind1: string;
    alarmWind2: string;
    alarmRain: string;
    alarmFrost: string;
    alarmFire: string;
    heatProtection: boolean;
    events: ShutterSettings[];
}
