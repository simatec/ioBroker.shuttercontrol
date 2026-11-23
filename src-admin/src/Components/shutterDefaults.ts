/**
 * One row of `native.events`.
 *
 * The former materialize page stored all values as strings (from the input fields) and the backend
 * relies on that in some places (e.g. a height of `'0'` is truthy, a height of `0` is not).
 * Therefore numbers are stored as strings here, too.
 */
export interface ShutterEntry {
    enabled: boolean;
    shutterName: string;
    name: string;
    [key: string]: string | number | boolean | null | undefined;
}

/** Fields, which are only used by the backend at runtime. They are kept, but not shown */
export const RUNTIME_FIELDS = [
    'currentAction',
    'currentHeight',
    'oldHeight',
    'firstCompleteUp',
    'triggerHeight',
    'triggerAction',
    'sunProtectEndtimerid',
    'alarmTriggerAction',
    'alarmTriggerLevel',
    'lastAutoAction',
];

/** Default values of a new shutter - the same values as the former "add" button of the materialize page */
export function getNewShutter(shutterName: string): ShutterEntry {
    const entry: ShutterEntry = {
        enabled: true,
        shutterName,
        name: '',
        triggerID: '',
        triggerState: 'none',
        triggerStateTilted: 'none',
        typeUp: 'sunrise',
        typeDown: 'sunset',
        heightUp: '100',
        heightDown: '0',
        triggerDrive: '100',
        triggerDriveTildet: '50',
        triggerChange: 'off',
        elevation: '8',
        type: 'in- & outside temperature and direction',
        heightDownSun: '30',
        direction: '120',
        directionRange: '50',
        tempInside: '23',
        tempSensor: '',
        outsideTempSensor: '',
        tempOutside: '23',
        lightSensor: '',
        valueLight: '15',
        autoDrive: 'off',
        hysteresisOutside: '5',
        hysteresisInside: '5',
        hysteresisLight: '5',
        XmasLevel: '0',
        betweenPositionLevel: '50',
        trigDelyUp: '0',
        trigDelyDown: '0',
        sunProtectEndDely: '0',
        tempHeatProtection: '30',
        LateDown: true,
        inSummerNotDown: false,
        KeepSunProtect: true,
        heatProtection: false,
        driveAfterClose: true,
        useXmasLevel: true,
        betweenPosition: false,
        useOpenWindowLevel: false,
        enableAlarmWind1: false,
        enableAlarmWind2: false,
        enableAlarmRain: false,
        enableAlarmFrost: false,
        enableAlarmFire: false,
        ignoreTriggerAutoState: false,
    };
    for (const field of RUNTIME_FIELDS) {
        entry[field] = '';
    }
    return entry;
}

export interface SelectOption {
    value: string;
    label: string;
}

export const TYPE_DOWN_OPTIONS: SelectOption[] = [
    { value: 'off', label: 'off' },
    { value: 'living', label: 'living' },
    { value: 'living-auto', label: 'living-auto' },
    { value: 'sleep', label: 'sleep' },
    { value: 'sleep-auto', label: 'sleep-auto' },
    { value: 'children', label: 'children' },
    { value: 'children-auto', label: 'children-auto' },
    { value: 'sunset', label: 'sunset' },
    { value: 'elevation', label: 'elevation' },
    { value: 'goldenhour', label: 'goldenhour' },
    { value: 'lightsensor', label: 'lightsensor' },
    { value: 'manual-only', label: 'manual-only' },
];

export const TYPE_UP_OPTIONS: SelectOption[] = [
    { value: 'off', label: 'off' },
    { value: 'living', label: 'living' },
    { value: 'living-auto', label: 'living-auto' },
    { value: 'sleep', label: 'sleep' },
    { value: 'sleep-auto', label: 'sleep-auto' },
    { value: 'children', label: 'children' },
    { value: 'children-auto', label: 'children-auto' },
    { value: 'sunrise', label: 'sunrise' },
    { value: 'goldenhour End', label: 'goldenhour End' },
    { value: 'lightsensor', label: 'lightsensor' },
    { value: 'manual-only', label: 'manual-only' },
];

export const TRIGGER_STATE_OPTIONS: SelectOption[] = [
    { value: 'none', label: 'unavailable' },
    { value: 'true', label: 'true' },
    { value: 'false', label: 'false' },
    { value: '0', label: '0' },
    { value: '1', label: '1' },
    { value: '2', label: '2' },
];

export const DRIVE_OPTIONS: SelectOption[] = [
    { value: 'off', label: 'off' },
    { value: 'onlyUp', label: 'only up' },
    { value: 'onlyDown', label: 'only Down' },
    { value: 'upDown', label: 'up and down' },
];

export const SUN_TYPE_OPTIONS: SelectOption[] = [
    { value: 'off', label: 'off' },
    { value: 'in- & outside temperature', label: 'in and outside temperature' },
    { value: 'only direction', label: 'only direction' },
    { value: 'in- & outside temperature and direction', label: 'in and outside temperature and direction' },
    { value: 'outside temperature and direction', label: 'outside temperature and direction' },
    { value: 'only outside temperature', label: 'only outside temperature' },
    { value: 'only inside temperature', label: 'only inside temperature' },
];

/** Converts a stored value into the string shown in an input field */
export function toStr(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return '';
}
