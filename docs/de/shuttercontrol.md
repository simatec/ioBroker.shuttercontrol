## Shuttercontrol ist ein Adapter zur automatischen Steuerung von Rollläden und Markisen.

Der Adapter arbeitet mit den Aufzählungen (ENUMS) von IoBroker.

Folgende Szenarien und Funktionen werden aktuell unterstützt.

* Zeitsteuerung für Rollläden im Wohnbereich
* Zeitsteuerung für Rollläden im Wohnbereich mit Umschaltung von Automatik und Handbetrieb
* Zeitsteuerung für Rollläden im Schlafbereich
* Zeitsteuerung für Rollläden im Schlafbereich mit Umschaltung von Automatik und Handbetrieb Steuerung der Rollläden über Sonnenaufgang und Sonnenuntergang
* Steuerung der Rollläden abhängig von Feiertagen (Hier wird der Adapter Feiertage zusätzlich benötigt)
* zeitgesteuerte Regelung der Rollläden für den Sonnenschutz im Sommer

## Was wird benötigt?

Für die Nutzung des Adapters werden lediglich Aufzählungen (ENUMS) als Funktion benötigt.
Um alle Funktionen zu nutzen, müssen die Rollläden 5 unterschiedliche Aufzählungen zugeordnet werden.
Die angelegten Funktionen können dann in den Adaptereinstellungen ausgewählt werden.
Folgende Funktionen können angelegt werden:

### Rollläden für den Wohnbereich:
* Hier sollten allen Rollläden angelegt werden, die im Wohnbereich liegen und immer zu den errechneten Zeiten von shuttercontrol fahren sollen.

### Rollläden für den Wohnbereich mit Umschaltung von Automatik / Handbetrieb:
* Hier sollten alle Rollläden angelegt werden, die im Wohnbereich liegen, aber nur bei der Umschaltung auf Automatikbetrieb zu den errechneten Zeiten von shuttercontrol fahren sollen. Die Umschaltung zwischen Automatikbetrieb und Handbetrieb erfolgt über den von shuttercontrol angelegten Datenpunkt „autoLiving“. Dieser kann z.B. über die VIS oder über Homekit etc. gesetzt werden.
Der Hintergrund für diese Funktion ist, dass es Rollläden im Wohnbereich geben kann, die  bei Anwesenheit nicht automatisch runterfahren dürfen (z.B. eine Terrassentür).

### Rollläden für den Schlafbereich:
* Hier sollten allen Rollläden angelegt werden, die im Schlafbereich liegen und immer zu den errechneten Zeiten von shuttercontrol fahren sollen.

### Rollläden für den Schlafbereich mit Umschaltung von Automatik / Handbetrieb:

* Hier sollten alle Rollläden angelegt werden, die im Schlafbereich liegen, aber nur bei der Umschaltung auf Automatikbetrieb zu den errechneten Zeiten von shuttercontrol fahren sollen. Die Umschaltung zwischen Automatikbetrieb und Handbetrieb erfolgt über den von shuttercontrol angelegten Datenpunkt „autoSleep“. Dieser kann z.B. über die VIS oder über Homekit etc. gesetzt werden.
Der Hintergrund für diese Funktion ist, dass es Rollläden im Schlafbereich geben kann, die   in bestimmten Situationen (Krankheit, Ferien oder Urlaub) nicht automatisch fahren hochfahren sollen.

### Rollläden für die Funktion Sonnenschutz:
* Hier sollten alle Rollläden angelegt werden, die für die Sonnenschutz-Funktion benötigt werden.
Alle Rollläden die hier angelegt werden, werden bei überschreiten der eingestellten Solltemperatur auf das eingestellte Level gefahren und erst nach unterschreiten der eingestellten Solltemperatur oder nach Ablauf der eingestellten Sonnenschutzzeit wieder hochgefahren.
Auch hier sollte man darauf achten, dass Rollläden an Terrassentüren etc. nicht unbedingt in dieser Funktion enthalten sind, um sich nicht selbst auszusperren. ;-)

### weitere Funktionen
* Shuttercontrol unterscheidet zwischen der Arbeitswoche, Wochenende und Feiertagen.
Hier können für freie Tage und Arbeitstage unterschiedliche Zeiten hinterlegt werden.
Des Weiteren gibt es einen Datenpunkt „Holiday“, der ebenfalls über die VIS, Homekit etc. gesetzt werden kann.
Ist der Datenpunkt auf true, werden die Rollladenzeiten für Wochenende / Feiertagen verwendet.

* Sollte die Feiertagsfunktion aktiviert sein, wird der Adapter Feiertage benötigt und die installierte Instanz muss in den Einstellungen von shuttercontrol ausgewählt werden.
Ist die Funktion aktiviert, werden an Feiertagen und am Abend davor ebenfalls die Rollladenzeiten für Wochenende gesetzt.