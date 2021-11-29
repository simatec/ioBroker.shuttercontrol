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
                        }
                        else {
                            //else decrease Start year
                            StartDate.setFullYear(StartDate.getFullYear() - 1);
                            adapter.log.debug(`corrected Start ${StartDate.toDateString()}`);
                        }
                    }

                    if (now >= StartDate && now <= EndDate) {
                        adapter.log.debug('we are in period');
                        ret = true;
                    }
                    else {
                        adapter.log.debug(`we are not in period, after start ${StartDate.toDateString()} and before end ${EndDate.toDateString()}`);
                        ret = false;
                    }
                }
            }
        }
        catch (e) {
            adapter.log.error(`exception catch in IsSummerTime [${e}]`);
        }
        resolve(ret);
    });
}

// @ts-ignore
async function CheckInSummerNotDown(adapter, shutter) {
    return new Promise(async (resolve) => {
        let inSummerNotDown = false;

        const resultSummerTime = IsSummerTime(adapter, adapter.config.SummerStart, adapter.config.SummerEnd);

        if (resultSummerTime) {
            inSummerNotDown = shutter.inSummerNotDown;

            if (inSummerNotDown) {
                adapter.log.debug(`${shutter.shutterName} in summer time not down ${shutter.inSummerNotDown}`);
            }
            else {
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
            const resultXmasTime = IsSummerTime(adapter, adapter.config.XMasStart, adapter.config.XMasEnd);
            if (resultXmasTime) { //and we are in xmas time
                //then store level to be used here
                XmasLevel = parseFloat(shutter.XmasLevel);
                adapter.log.debug(`${shutter.shutterName} in xmas time down ${XmasLevel}`);
            }
            //hint: this will normally close the shutter only to 50%
            //if you want to close shutter completely later at night use CloseShutterLateAtNight option
            //e.g. in xmas time we close shutter to 50% at normal down time and close it completely with CloseLateAtNight
            //this is used in cases where we want to show our "Schwibbogen" in the window also when shutter is normally already closed (e.g.
            //between sunset and 22:00)
        }
        resolve(XmasLevel);
    });
}

module.exports = {
    IsSummerTime,
    CheckInSummerNotDown,
    GetXmasLevel
};