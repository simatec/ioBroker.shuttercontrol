'use strict';

/**
 * @param {{ log: { debug: (arg0: string) => void; error: (arg0: string) => void; }; }} adapter
 * @param {string} StartDate
 * @param {string} EndDate
 */
async function IsSummerTime(adapter, StartDate, EndDate) {
    return new Promise(async (resolve) => {
        let ret = false;
        try {
            adapter.log.debug(`check in time ${StartDate} ${EndDate}`);

            if (StartDate.length > 0 && EndDate.length > 0) {
                const StartPeriod = StartDate.split('.');
                const EndPeriod = EndDate.split('.');

                if (StartPeriod.length >= 2 && EndPeriod.length >= 2) {

                    let StartDate = new Date();
                    StartDate.setDate(parseInt(StartPeriod[0]));
                    StartDate.setMonth(parseInt(StartPeriod[1]) - 1);
                    adapter.log.debug(`Start ${StartDate.toDateString()}`);

                    let EndDate = new Date();
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
                        adapter.log.debug(`we are not in period, after start ${StartDate.toDateString()} and before end ${EndDate.toDateString()}`);
                        ret = false;
                    }
                }
            }
        } catch (e) {
            adapter.log.error(`exception catch in IsSummerTime [${e}]`);
        }
        resolve(ret);
    });
}

// @ts-ignore
async function CheckInSummerNotDown(adapter, shutter) {
    return new Promise(async (resolve) => {
        let inSummerNotDown = false;

        const resultSummerTime = await IsSummerTime(adapter, adapter.config.SummerStart, adapter.config.SummerEnd);

        if (resultSummerTime) {
            inSummerNotDown = shutter.inSummerNotDown;

            if (inSummerNotDown) {
                adapter.log.debug(`${shutter.shutterName} in summer time not down ${shutter.inSummerNotDown}`);
            } else {
                adapter.log.debug(`${shutter.shutterName} in summer time down ${shutter.inSummerNotDown}`);
            }
        }
        resolve(inSummerNotDown);
    });
}

/**
 * @param {{ log: any; config?: any; }} adapter
 * @param {{ shutterName: string; useXmasLevel: any; XmasLevel: string; }} shutter
 */
async function GetXmasLevel(adapter, shutter) {
    return new Promise(async (resolve) => {
        let XmasLevel = -1;

        adapter.log.debug(`check xmas for ${shutter.shutterName}`);
        if (shutter.useXmasLevel) { //we should use xmasl level for the current shutter
            const resultXmasTime = await IsSummerTime(adapter, adapter.config.XMasStart, adapter.config.XMasEnd);
            if (resultXmasTime) { //and we are in xmas time
                XmasLevel = parseFloat(shutter.XmasLevel); //then store level to be used here
                adapter.log.debug(`${shutter.shutterName} in xmas time down ${XmasLevel}`);
            }
        }
        resolve(XmasLevel);
    });
}

module.exports = {
    IsSummerTime,
    CheckInSummerNotDown,
    GetXmasLevel
};