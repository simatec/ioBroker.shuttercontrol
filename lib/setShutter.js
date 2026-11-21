'use strict';

const shutterState = require('./shutterState.js');  // shutterState
let checkShutterState = true;

/**
 * Ermittelt die Ziel-Lamellenneigung passend zur aktuellen Rollladen-Aktion.
 * Rückgabe null bedeutet: kein Slat-Wert für diese Aktion definiert -> nicht schreiben.
 *
 * @param currentShutterSettings
 */
function getSlatTarget(currentShutterSettings) {
    const action = currentShutterSettings.currentAction;

    switch (action) {
        case 'sunProtect':
        case 'OpenInSunProtect':
        case 'manu_sunProtect':
            return currentShutterSettings.slatHeightDownSun !== undefined && currentShutterSettings.slatHeightDownSun !== ''
                ? parseFloat(currentShutterSettings.slatHeightDownSun)
                : null;
        case 'up':
            return currentShutterSettings.slatHeightUp !== undefined && currentShutterSettings.slatHeightUp !== ''
                ? parseFloat(currentShutterSettings.slatHeightUp)
                : null;
        case 'down':
        case 'middle':
        case 'Xmas':
            return currentShutterSettings.slatHeightDown !== undefined && currentShutterSettings.slatHeightDown !== ''
                ? parseFloat(currentShutterSettings.slatHeightDown)
                : null;
        default:
            // Alle nicht explizit gemappten Aktionen (fire, frost, rain, wind1/2, triggered,
            // Manu_Mode, none, sowie frei konfigurierte alarmTriggerAction/triggerAction-Texte)
            // fahren die konfigurierte "zu"-Lamellenneigung an, da sie i. d. R. mit einem
            // Schließen des Rollladens einhergehen.
            return currentShutterSettings.slatHeightDown !== undefined && currentShutterSettings.slatHeightDown !== ''
                ? parseFloat(currentShutterSettings.slatHeightDown)
                : null;
    }
}

/**
 * Wartet, bis die tatsächliche (Ist-)Rollladenhöhe (heightCurrentId) die soeben geschriebene
 * Zielhöhe (targetHeight) erreicht hat, bevor die Lamellenposition gesetzt wird. heightWaitTimeout
 * ist das Intervall, in dem der Vergleich wiederholt wird (pro Rollladen konfigurierbar).
 * Ein interner, nicht konfigurierbarer Sicherheits-Grenzwert (5 Min.) verhindert eine Endlosschleife,
 * falls die Zielhöhe nie exakt erreicht wird. Ohne konfigurierten heightCurrentId wird nicht gewartet.
 *
 * @param adapter
 * @param currentShutterSettings
 * @param targetHeight
 */
async function waitForHeightReached(adapter, currentShutterSettings, targetHeight) {
    if (!currentShutterSettings.heightCurrentId) {
        return;
    }

    const interval = currentShutterSettings.heightWaitTimeout ? parseInt(currentShutterSettings.heightWaitTimeout, 10) : 1000;
    const tolerance = 1;
    const maxTotalWait = 5 * 60 * 1000; // internes Sicherheitsnetz, nicht konfigurierbar

    const start = Date.now();

    while (Date.now() - start < maxTotalWait) {
        let state;

        try {
            state = await adapter.getForeignStateAsync(currentShutterSettings.heightCurrentId);
        } catch (err) {
            adapter.log.warn(`Höhen-Status für ${currentShutterSettings.shutterName} konnte nicht gelesen werden: ${err}`);
            return;
        }

        if (!state || state.val === null || state.val === undefined) {
            return;
        }

        if (Math.abs(parseFloat(state.val) - targetHeight) <= tolerance) {
            return;
        }

        await new Promise((r) => setTimeout(r, interval));
    }

    adapter.log.warn(`Sicherheits-Timeout (5 Min.) beim Warten auf Erreichen der Rollladen-Zielhöhe (${currentShutterSettings.shutterName}) - setze Lamelle trotzdem`);
}

/**
 * slatId ist ein einzelner State, der sowohl zum Schreiben des Soll-Winkels als auch zum
 * Auslesen des Ist-Winkels dient (Shelly slatPosition). Solange ein zuvor geschriebenes
 * Kommando noch nicht vom Aktor bestätigt wurde (ack: false), wird gewartet, bevor ein
 * neuer Zielwert geschrieben wird.
 *
 * @param adapter
 * @param currentShutterSettings
 */
async function waitForSlatIdle(adapter, currentShutterSettings) {
    if (!currentShutterSettings.slatId) {
        return;
    }

    const timeout = currentShutterSettings.slatWaitTimeout ? parseInt(currentShutterSettings.slatWaitTimeout, 10) : 30000;
    const interval = currentShutterSettings.slatWaitInterval ? parseInt(currentShutterSettings.slatWaitInterval, 10) : 1000;
    const start = Date.now();

    while (Date.now() - start < timeout) {
        let state;

        try {
            state = await adapter.getForeignStateAsync(currentShutterSettings.slatId);
        } catch (err) {
            adapter.log.warn(`Slat-Status für ${currentShutterSettings.shutterName} konnte nicht gelesen werden: ${err}`);
            return;
        }

        if (!state || state.ack) {
            return;
        }

        await new Promise((r) => setTimeout(r, interval));
    }

    adapter.log.debug(`Timeout beim Warten auf Bestätigung der Lamellenposition (${currentShutterSettings.shutterName}) - fahre trotzdem fort`);
}

/**
 * Wartet auf Erreichen der Zielhöhe und ein evtl. vorheriges Lamellenkommando, und setzt dann
 * die neue Lamellenposition. Läuft bewusst NICHT blockierend (nicht awaited vom Aufrufer) - so
 * können mehrere Rollläden in einer Schleife weiterhin gleichzeitig losfahren, statt dass die
 * Schleife auf jeden einzelnen Rollladen wartet, bevor der nächste sein Kommando bekommt.
 *
 * @param adapter
 * @param currentShutterSettings
 * @param shutterHeight
 * @param slatTarget
 * @param logInfo
 */
async function setSlatDeferred(adapter, currentShutterSettings, shutterHeight, slatTarget, logInfo) {
    try {
        // 1) Erst warten, bis die Rollladenhöhe ihr Ziel erreicht hat
        await waitForHeightReached(adapter, currentShutterSettings, shutterHeight);
        // 2) Dann sicherstellen, dass ein evtl. vorheriges Lamellenkommando bestätigt ist
        await waitForSlatIdle(adapter, currentShutterSettings);

        adapter.log.info(`${logInfo} Set Slat ID: ${currentShutterSettings.slatId} value: ${slatTarget}%`);

        await adapter.setForeignStateAsync(currentShutterSettings.slatId, slatTarget, false);
    } catch (err) {
        adapter.log.warn(`The slat value for ${currentShutterSettings.shutterName} could not be set: ${err}`);
    }
}

async function setShutterState(adapter, shutterSettings, currentShutterSettings, shutterHeight, nameDevice, logInfo) {
    return new Promise(async (resolve) => {
        adapter.log.info(`${logInfo} Set ID: ${currentShutterSettings.shutterName} value: ${shutterHeight}%`);

        try {
            await adapter.setForeignStateAsync(currentShutterSettings.name, shutterHeight, false);
        } catch (err) {
            adapter.log.warn(`The value for ${currentShutterSettings.shutterName} could not be set: ${err}`);
        }

        // --- Lamellenneigung (Slat/Tilt) ---
        if (currentShutterSettings.slatEnabled && currentShutterSettings.slatId) {
            const slatTarget = getSlatTarget(currentShutterSettings);

            if (slatTarget !== null && !isNaN(slatTarget)) {
                // bewusst nicht awaited - siehe Kommentar an setSlatDeferred()
                setSlatDeferred(adapter, currentShutterSettings, shutterHeight, slatTarget, logInfo);
            }
        }
        // --- Ende Lamellenneigung ---

        checkShutterState = false;
        await setShutterInfo(adapter, shutterSettings, currentShutterSettings, nameDevice);

        // @ts-ignore
        resolve();
    });
}

/**
 * @param adapter
 * @param shutterSettings
 * @param currentShutterSettings
 * @param nameDevice
 */
async function setShutterInfo(adapter, shutterSettings, currentShutterSettings, nameDevice) {
    return new Promise(async (resolve) => {
        try {
            await adapter.setStateAsync(`shutters.autoLevel.${  nameDevice}`, { val: parseFloat(currentShutterSettings.currentHeight), ack: true });
            await adapter.setStateAsync(`shutters.autoState.${  nameDevice}`, { val: currentShutterSettings.currentAction, ack: true });
        } catch (err) {
            adapter.log.warn(`autoState and/or Level for Shutter ${nameDevice} could not be set: ${err}`);
        }
        if (checkShutterState) {
            await shutterState(currentShutterSettings.name, adapter, shutterSettings, false);
        }

        // @ts-ignore
        resolve();
    });
}

module.exports = {
    setShutterState,
    setShutterInfo
};
