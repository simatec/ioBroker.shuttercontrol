'use strict';

function IsSummerTime(adapter, callback) {

    let ret = false;
    try {

        if (adapter.config.SummerStart.length > 0 && adapter.config.SummerEnd.length > 0) {
            const SummmerStart = adapter.config.SummerStart.split('.');
            const SummmerEnd = adapter.config.SummerEnd.split('.');

            if (SummmerStart.length >= 2 && SummmerEnd.length >= 2) {
                const now = new Date();
                let AfterSummerStart = false;
                if (now.getMonth() > parseInt(SummmerStart[1])
                    || now.getMonth() === parseInt(SummmerStart[1]) && now.getDate() >= parseInt(SummmerStart[0])) {
                    AfterSummerStart = true;
                }

                let BeforeSummerEnd = false;
                if (now.getMonth() < parseInt(SummmerEnd[1])
                    || now.getMonth() === parseInt(SummmerEnd[1]) && now.getDate() <= parseInt(SummmerEnd[0])) {
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
    callback(ret);
    return ret;

}
module.exports = IsSummerTime;