'use strict';

function IsSummerTime(adapter) {

    let ret = false;
    try {

        if (adapter.config.SummerStart.length > 0 && adapter.config.SummerEnd.length > 0) {
            const SummmerStart = adapter.config.SummerStart.split('.');
            const SummmerEnd = adapter.config.SummerEnd.split('.');

            if (SummmerStart.length >= 2 && SummmerEnd.length >= 2) {
                const now = new Date();
                let AfterSummerStart = false;
                const curMonth = now.getMonth() + 1;
                const curDate = now.getDate(); 

                if (curMonth > parseInt(SummmerStart[1])
                    || curMonth === parseInt(SummmerStart[1]) && curDate >= parseInt(SummmerStart[0])) {
                    AfterSummerStart = true;
                }

                let BeforeSummerEnd = false;
                if (curMonth < parseInt(SummmerEnd[1])
                    || curMonth === parseInt(SummmerEnd[1]) && curDate <= parseInt(SummmerEnd[0])) {
                    BeforeSummerEnd = true;
                }
                if (AfterSummerStart && BeforeSummerEnd) {

                    adapter.log.debug('we are in summer time');
                    ret = true;
                }
                else {
                    adapter.log.debug('we are not in summer time');
                }
            }
            else {
                adapter.log.debug('!!! ' + SummmerStart.length + ' ' + SummmerEnd.length);
            }
        }
    }
    catch (e) {
        adapter.log.error('exception catch in IsSummerTime [' + e + '] ');
    }
    return ret;

}
module.exports = IsSummerTime;