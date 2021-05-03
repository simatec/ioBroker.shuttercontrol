'use strict';

//const schedule = require('node-schedule');
const shutterState = require('./shutterState.js');         // shutterState
//const IsSummerTime = require('./isSummerTime.js');         // IsSummerTime

//const CheckInSummerNotDown = require('./isSummerTime.js').CheckInSummerNotDown;
//const GetXmasLevel = require('./isSummerTime.js').GetXmasLevel;

function getDate(d) {
    d = d || new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

function shutterBrightnessSensor(adapter, delayDown, shutterSettings) {
    adapter.log.debug('Test shutterBrightnessSensor');
}
module.exports = shutterBrightnessSensor;