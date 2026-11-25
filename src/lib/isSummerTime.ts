import type { ShutterFlag, ShutterSettings } from './types';

/**
 * Checks whether today is within the given period (day.month).
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

        if (StartDate.length > 0 && EndDate.length > 0) {
            const StartPeriod = StartDate.split('.');
            const EndPeriod = EndDate.split('.');

            if (StartPeriod.length >= 2 && EndPeriod.length >= 2) {
                const StartDate = new Date();
                StartDate.setDate(parseInt(StartPeriod[0]));
                StartDate.setMonth(parseInt(StartPeriod[1]) - 1);
                adapter.log.debug(`Start ${StartDate.toDateString()}`);

                const EndDate = new Date();
                EndDate.setDate(parseInt(EndPeriod[0]));
                EndDate.setMonth(parseInt(EndPeriod[1]) - 1);
                adapter.log.debug(`End ${EndDate.toDateString()}`);

                const now = new Date();

                // by year changed
                if (EndDate < StartDate) {
                    if (now > EndDate) {
                        //end already past, increase end year
                        EndDate.setFullYear(EndDate.getFullYear() + 1);
                        adapter.log.debug(`corrected End ${EndDate.toDateString()}`);
                    } else {
                        //else decrease Start year
                        StartDate.setFullYear(StartDate.getFullYear() - 1);
                        adapter.log.debug(`corrected Start ${StartDate.toDateString()}`);
                    }
                }

                if (now >= StartDate && now <= EndDate) {
                    adapter.log.debug('we are in period');
                    ret = true;
                } else {
                    adapter.log.debug(
                        `we are not in period, after start ${StartDate.toDateString()} and before end ${EndDate.toDateString()}`,
                    );
                    ret = false;
                }
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
    if (shutter.useXmasLevel) {
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
