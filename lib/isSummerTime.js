'use strict';

function IsSummerTime(adapter, StartDate, EndDate) {

    let ret = false;
    try {

        if (StartDate.length > 0 && EndDate.length > 0) {
            const StartPeriod = StartDate.split('.');
            const EndPeriod = EndDate.split('.');

            if (StartPeriod.length >= 2 && EndPeriod.length >= 2) {
                const now = new Date();
                let AfterPeriodStart = false;
                const curMonth = now.getMonth() + 1;
                const curDate = now.getDate(); 

                if (curMonth > parseInt(StartPeriod[1])
                    || curMonth === parseInt(StartPeriod[1]) && curDate >= parseInt(StartPeriod[0])) {
                    AfterPeriodStart = true;
                }

                let BeforePeriodEnd = false;
                if (curMonth < parseInt(EndPeriod[1])
                    || curMonth === parseInt(EndPeriod[1]) && curDate <= parseInt(EndPeriod[0])) {
                    BeforePeriodEnd = true;
                }
                if (AfterPeriodStart && BeforePeriodEnd) {

                    adapter.log.debug('we are in period');
                    ret = true;
                }
                else {
                    adapter.log.debug('we are not in period');
                }
            }
            else {
                adapter.log.debug('!!! ' + StartPeriod.length + ' ' + EndPeriod.length);
            }
        }
    }
    catch (e) {
        adapter.log.error('exception catch in IsSummerTime [' + e + '] ');
    }
    return ret;

}


function CheckInSummerNotDown(adapter, shutter) {

    let inSummerNotDown = false;

    const resultSummerTime = IsSummerTime(adapter, adapter.config.SummerStart, adapter.config.SummerEnd);

    if (resultSummerTime) {
        inSummerNotDown = shutter.inSummerNotDown;

        if (inSummerNotDown) {
            adapter.log.debug(shutter.shutterName + ' in summer time not down ' + shutter.inSummerNotDown);
        }
        else {
            adapter.log.debug(shutter.shutterName + ' in summer time down ' + shutter.inSummerNotDown);
        }
    }



    return inSummerNotDown;
}


function GetXmasLevel(adapter,shutter) {

    let XmasLevel = -1;

    if (shutter.useXmasLevel) { //we should use xmasl level for the current shutter
        const resultXmasTime = IsSummerTime(adapter, adapter.config.XMasStart, adapter.config.XMasEnd);
        if (resultXmasTime) { //and we are in xmas time

            //then store level to be used here
            XmasLevel = shutter.XmasLevel;
            adapter.log.debug(shutter.shutterName + ' in xmas time down ' + XmasLevel);
        }
        //hint: this will normally close the shutter only to 50%
        //if you want to close shutter completely later at night use CloseShutterLateAtNight option
        //e.g. in xmas time we close shutter to 50% at normal down time and close it completely with CloseLateAtNight
        //this is used in cases where we want to show our "Schwibbogen" in the window also when shutter is normally already closed (e.g.
        //between sunset and 22:00)
    }

    return XmasLevel;

}


module.exports = { IsSummerTime, CheckInSummerNotDown, GetXmasLevel } ;