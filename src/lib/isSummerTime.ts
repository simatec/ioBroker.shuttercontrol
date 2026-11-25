import type { ShutterFlag, ShutterSettings } from './types';

/**
 * Converts a date of the configuration (dd.mm or dd.mm.) into a comparable number (month * 100 + day).
 *
 * @param value date as dd.mm
 * @returns month * 100 + day or null when the value is not a valid date
 */
function toMonthDay(value: string): number | null {
    const parts = String(value ?? '').split('.');
    if (parts.length < 2) {
        return null;
    }
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (isNaN(day) || isNaN(month) || day < 1 || day > 31 || month < 1 || month > 12) {
        return null;
    }
    return month * 100 + day;
}

/**
 * Checks whether today is within the given period (day.month). Start and end day are included, a period
 * over the turn of the year (e.g. 01.12. - 06.01.) is supported. Only the calendar day is compared, so the
 * result does not depend on the time of day or on the length of the current month.
 *
 * @param adapter adapter instance
 * @param StartDate start of the period (dd.mm)
 * @param EndDate end of the period (dd.mm)
 * @returns true when today is within the period
 */
export async function IsSummerTime(adapter: ioBroker.Adapter, StartDate: string, EndDate: string): Promise<boolean> {
    let ret = false;
    try {
        adapter.log.debug(`check in time ${StartDate} ${EndDate}`);

        const start = toMonthDay(StartDate);
        const end = toMonthDay(EndDate);

        if (start !== null && end !== null) {
            const now = new Date();
            const today = (now.getMonth() + 1) * 100 + now.getDate();

            // start <= end: period within one year, otherwise over the turn of the year
            ret = start <= end ? today >= start && today <= end : today >= start || today <= end;

            if (ret) {
                adapter.log.debug('we are in period');
            } else {
                adapter.log.debug(`we are not in period ${StartDate} - ${EndDate}`);
            }
        }
    } catch (e) {
        adapter.log.error(`exception catch in IsSummerTime [${e}]`);
    }
    return ret;
}

/**
 * Checks whether the shutter must not go down because it is summer time.
 *
 * @param adapter adapter instance
 * @param shutter settings of the shutter
 * @returns the inSummerNotDown flag of the shutter during summer time, otherwise false
 */
export async function CheckInSummerNotDown(adapter: ioBroker.Adapter, shutter: ShutterSettings): Promise<ShutterFlag> {
    let inSummerNotDown: ShutterFlag = false;

    const resultSummerTime = await IsSummerTime(adapter, adapter.config.SummerStart, adapter.config.SummerEnd);

    if (resultSummerTime) {
        inSummerNotDown = shutter.inSummerNotDown;

        if (inSummerNotDown) {
            adapter.log.debug(`${shutter.shutterName} in summer time not down ${shutter.inSummerNotDown}`);
        } else {
            adapter.log.debug(`${shutter.shutterName} in summer time down ${shutter.inSummerNotDown}`);
        }
    }
    return inSummerNotDown;
}

/**
 * Converts a state value into a boolean ('true', 1 and true are true).
 *
 * @param val state value
 * @returns the boolean value
 */
export function toBool(val: ioBroker.StateValue | undefined): boolean {
    return val === true || val === 'true' || val === 1 || val === '1';
}

/**
 * Checks whether the christmas mode is active. The switch control.Xmas is used; it follows the configured
 * christmas period (XMasStart / XMasEnd) and can be changed manually. Without a value of the switch the
 * configured period is used.
 *
 * @param adapter adapter instance
 * @returns true when the christmas mode is active
 */
export async function IsXmasActive(adapter: ioBroker.Adapter): Promise<boolean> {
    try {
        const state = await adapter.getStateAsync('control.Xmas');
        if (state && state.val !== null && state.val !== undefined) {
            adapter.log.debug(`xmas mode by control.Xmas: ${state.val}`);
            return toBool(state.val);
        }
    } catch (e) {
        adapter.log.debug(`control.Xmas cannot be read: ${e}`);
    }
    return IsSummerTime(adapter, adapter.config.XMasStart ?? '', adapter.config.XMasEnd ?? '');
}

/**
 * Returns the xmas level of the shutter during the xmas period.
 *
 * @param adapter adapter instance
 * @param shutter settings of the shutter
 * @returns the xmas level or -1 when it is not to be used
 */
export async function GetXmasLevel(adapter: ioBroker.Adapter, shutter: ShutterSettings): Promise<number> {
    let XmasLevel = -1;

    adapter.log.debug(`check xmas for ${shutter.shutterName}`);
    if (toBool(shutter.useXmasLevel)) {
        //we should use xmasl level for the current shutter
        const resultXmasTime = await IsXmasActive(adapter);
        if (resultXmasTime) {
            //and we are in xmas time
            XmasLevel = parseFloat(String(shutter.XmasLevel)); //then store level to be used here
            adapter.log.debug(`${shutter.shutterName} in xmas time down ${XmasLevel}`);
        }
    }
    return XmasLevel;
}
