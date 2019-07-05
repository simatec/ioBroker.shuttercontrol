## Shuttercontrol ist ein Adapter zur automatischen Steuerung von Rollläden und Markisen.

# Grundlegendes
Shuttercontrol ist ein Adapter für eine sehr umfangreiche Steuerung für Rollläden und Jalousien.
Diese Steuerung umfasst sowohl automatische Beschattung als auch die nächtliche Verdunklung.

Für diese Steuerung stehen sehr viele einstellbare Parameter zur Verfügung, darunter zwei verschiedene globale Timer 
(z.B. unterschiedlich für Schlaf- und Wohnräume), diverse sonnenstandsabhängige Parameter die individuell je Rolladen 
eingestellt werden können, sowie Trigger für Tür-/Fenstersensoren die einem Aussperrschutz dienen oder ein automatisches 
Öffnen zu einem individuellen Level bei Öffnen der Tür / des Fensters dienen.

Auch für die Beschattung gibt es verschiedene einstellbare Parameter. So kann die automatische Beschattung abhängig gemacht 
werden von Innentemperatur, Außentemperatur, Helligkeit, Hitzesensor u.v.m.

Auch der Sonnenstand kann mit einbezogen werden, so dass nur Räume verdunkelt werden, die tatsächlich beschienen werden.

---

Ab der Version 0.2.11 sind alle Konfigurationsdatenpunkte bereits mit Beispielen voreingestellt, so dass der Adapter nach 
Installation und Eingabe von den IDs der Rollladenaktoren betriebsbereit ist.
Die weitere Konfiguration dient dann der Anpassung an persönliche Wünsche.

## Installation
Der Adapter befindet sich bereits im latest Repository. Um ihn installieren zu können muss man in den Grundeinstellungen von ioBroker sein aktives Repository (vorübergehend) auf latest stellen.

Spätestens nach Refresh der Adapterliste steht der Adapter **Shuttercontrol** zur Verfügung.

Nach anklicken des (+) wird eine Instanz angelegt und die notwendigen Daten des Adapters vom Repository geladen:

# Konfiguration - Haupteinstellungen
Sollte in dem Installationsfenster die Checkbox "***schließen wenn fertig***" nicht angehakt sein muss man dieses natürlich noch schließen.

Das Konfigurationsfenster besteht aus drei Reitern:
* Haupteinstellungen
* Zeit-Einstellungen
* Extra-Einstellungen

Das Konfigurationsfenster öffnet sich automatisch mit den Haupteinstellungen

![main.jpg](img/main.jpg)

Auf dieser Seite ist eine Beispiel-ID abgelegt.
Diese bitte löschen und anschließend die eigenen IDs durch anklicken des (+) links oben an der Tabelle die eigenen Rollladenaktoren hinzufügen

Dabei bitte die Datenpunkte mit LEVEL (o.ä.) auswählen. NICHT das Gerät als solches.

Nach Abschluß der ID-Auswahl ist der Adapter bereits betriebsbereit, aber noch nicht an die eigenen Wünsche angepasst.

![idSelect.jpg](img/idSelect.jpg)


### Aufbau der Tabelle
Nr:  fortlaufende Nummer der gelisteten Rollläden
Aktiv: Checkbox zur Aktivierung der Steuerung des entsprechenden Rollladens
Name: Name des Aktors; wird bei der Auswahl der ID automatisch aus den Objekten eingelesen
Objekt-ID Rollladen: Eindeutige ID des zu steuernden Datenpunkts in den Objekten
(+): Hinzufügen/Ändern der ID
Bleistift: spezifische Konfiguration des jeweiligen Rollladens
Pfeile: verändern der Reihenfolge der verschiedenen Rollläden
Mülleimer: Löschen der ID mit allen Konfigurierten Daten!


## individuelle Konfiguration eines Rollladens
Auch diese Konfigurationsebene besteht aus zwei Reitern: Haupteinstellungen und Sonnenschutz einstellungen

### Haupteinstellungen

![mainShutter.jpg](img/mainShutter.jpg)

Im oberen Bereich werden die Zeitpunkte für das Hoch und Runterfahren zur nächtlichen Verdunklung festgelegt.
Diese Zeiten können unter ***Zeit-Einstellungen*** konfiguriert und hier im pulldown ausgewählt werden.

Folgende Möglichkeiten stehen zur Auswahl:

Erklärungen dazu weiter unten.

**Sollwert des Auslösers:** Um einen Aussperrschutz zu ermöglichen kann man in der untersten Zeile einen Auslöser auswählen, der das Herunterfahren des Rollladens verhindern soll. Hier wird jetzt der Wert des Sensors angegeben, bei der der Rolladen fahren darf.

**Fahren bei Änderung:** Pulldown zur Auswahl der Funktion; nur Aussperrschutz, oder auch automatisches Wiederhochfahren beim Öffnen; oder einfach aus.

**Rollladenhöhe bei Auslösung:** Soll der Rolladen bei Auslösen des Sensors fahren, wird hier die gewünschte Rollladenposition eingegeben. (z.B. bei Fenstern 25% zum Lüften, oder 100% bei Türen um durchgehen zu können)

**Rollladenhöhe beim Runterfahren:** gewünschte Rollladenposition bei Verdunklung

**Rolladenhöhe beim hochfahren:** gewünschte Rollladenposition am Morgen

**Sonnenhöhe:** Soll die Verdunklung bei einer fixen Elevation starten und enden, wird dieser Wert hier eingegeben; sonst leer lassen.

**Auslöser-ID:** über das (+) den Sensor (State) auswählen der eine Rollladenfahrt verhindern soll.

---
### Zeitvorgaben
**Aus:** keine Vorlagen verwenden

**Wohnbereich:** Die Rollläden werden wie in dem Menüpunkt Zeiteinstellungen/Wohnbereich konfiguriert gefahren.

**Wohnbereich (AUTO):** Die Rollläden werden wie in dem Menüpunkt Zeiteinstellungen/Wohnbereich konfiguriert gefahren. Zusätzlich wird auf den unter Extra-Einstellungen festgelegten Trigger geachtet. Steht dieser auf false werden die Rollläden nicht automatisch gefahren

**Schlafbereich:** Die Rollläden werden wie in dem Menüpunkt Zeiteinstellungen/Schlafbereich konfiguriert gefahren.

**Schlafbereich (AUTO):** Die Rollläden werden wie in dem Menüpunkt Zeiteinstellungen/Schlafbereich konfiguriert gefahren. Zusätzlich wird auf den unter Extra-Einstellungen festgelegten Trigger geachtet. Steht dieser auf false werden die Rollläden nicht automatisch gefahren

**Sonnenuntergang:** Die Rollläden werden bei Sonnenuntergang auf die Verdunklungsstufe gefahren (bei hochfahren steht hier analog der Sonnenaufgang)

**Sonnenhöhe:** Unterschreitet die Elevation den in der individuellen Konfiguration eingestellten Wert werden die Rollläden gefahren

**Golden Hour:** Dieser Wert ist ein astronomischer Begriff und liegt vor Sonnenuntergang. Der Begriff stammt aus der Fotografie, weil dort die Farben einen goldenen Schimmer haben.


### Sonnenschutz-Einstellungen
Der Sonnenschutz kann über verschiedene Mechanismen gesteuert werden. Dabei kann eine Außentemperatur, eine Innentemperatur, die Helligkeit sowie der Sonnenstand o.ä. als Auslöser für die Beschattung und deren Ende ausgewählt werden.

![sunProtect.jpg](img/sunProtect.jpg)

Die Felder im Einzelnen:
**Rollladenhöhe beim runterfahren:** Der Wert wie weit der Rollladen bei Beschattung geschlossen werden soll.

**Himmelsrichtung:** Ausrichtung des Fensters auf der Windrose (0° = Nord; 180° = Süd)

**+/- Bereich der Himmelsrichtung:** Bereich in dem die Sonne (um den Mittelpunkt) störend in das Fenster einstrahlen würde. Außerhalb dieses Bereichs findet keine Beschattung statt.

**Art der Sonnenschutzsteuerung:** Pulldown zur Auswahl verschiedener Parameterkombinationen zur Beschattungssteuerung.

**Sollwert Außentemperatur:** Schwellwert zum starten der Beschattung. Dieser Wert ist natürlich abhängig von dem im nächsten Feld ausgewählten Sensor.

**Hysterese Außentemperatur (Prozent):** Hier kann eine Hysterese in Prozent eingestellt werden, damit der Rollladen bei Schwankungen nicht ständig hoch und runter fährt

**Objekt-ID für die Außentemperatur:** Der hier ausgewählte Sensor muss nicht zwingend die Außentemperatur messen. Er kann irgendeinen Wert, der zur Beschattungsauslösung hinzugezogen werden kann, liefern. Dies kann auch ein Hitzesensor (Temperaturdifferenzsensor) sein.

**Sollwert des Lichtsensors:** Analog zum Außentemperatursensor

**Hysterese Lichtsensor (Prozent):** Hier kann eine Hysterese in Prozent eingestellt werden, damit der Rollladen bei Schwankungen nicht ständig hoch und runter fährt

**Objekt-Id des Lichtsensors:** Analog zum Außentemperatursensor; wenn nicht benutzt leer lassen

**Sollwert Innentemperatursensor:** Hier kann eine Temperatur eines zu dem Rolladen zugeordneten Innentemperatursensors eingegeben werden unter der keine Beschattung stattfinden soll, um z.B. die Wärmeeinstrahlung im Winter zur Heizungsunterstützung zu nutzen.

**Hysterese Innentemperatur (Prozent):** Hier kann eine Hysterese in Prozent eingestellt werden, damit der Rollladen bei Schwankungen nicht ständig hoch und runter fährt

**Objekt-ID des Innensensors:** über das (+) den Temperaturensor (State) auswählen der eine Rollladenfahrt verhindern soll.

### Tipps:
Wird ein Rolladen manuell verstellt und entspricht die Position nicht der automatisch angefahrenen, setzt die Automatik aus!

---

# Konfiguration - Zeit-Einstellungen
In diesem Abschnitt können einige Zeit- bzw. Astro einstellungen vorgenommen werden, die in den individuellen Rollladenkonfigurationen ausgewählt werden können.

![timeSettings.jpg](img/timeSettings.jpg)

## Wohnbereich
In oberen Abschnitt werden die gewünschten Parameter für die Rollläden im Wohnbereich eingegeben.

**Das Pulldown** enthält verschiedene grundlegende Varianten

**in der Woche runterfahren:** Übliche Zeit für die Verdunklung während der Woche

**am Wochenende runterfahren:** Übliche Zeit für die Verdunklung am Wochenende und an Feiertagen

**am Wochenende hochfahren:** Übliche Zeit für das Ende der Verdunklung am Wochenende und an Feiertagen

**Min. Zeit für das Hochfahren in der Woche:** Zeit die bei zusätzlichen Astroeinstellungen mindestens überschritten sein muss, bevor der Rollladen morgens hochfährt

**Max. Zeit für das Hochfahren in der Woche:** Zeit die bei zusätzlichen Astroeinstellungen höchsten überschritten sein muss, bevor der Rollladen morgens hochfährt. Soll der Rolladen niemals hochfahren, wenn die Sonne noch nicht einen bestimmten Stand überschritten hat, muss diese Zeit auf den spätesten Zeitpunkt dieses Sonnenstandes (am 21.12.) eingestellt werden.

**Zeitverzögerung der Rollläden:** Abstand des Starts der Rollladenfahrt der einzelnen Rolläden dieser Gruppe um Funkstörungen zu vermeiden, oder den Anschein zu erwecken, sie würden manuell gefahren.


## Schlafbereich

Hier gilt alles unter Wohnbereich geschriebene analog.
Sollen die Rollläden in den beiden Bereichen unterschiedlich fahren, kann man dies hier eingeben.

### Tipp:
Natürlich muss diese Kategorisierung nicht zwingend für Wohn- und Schlafbereich genutzt werden. Diese beiden Voreinstellungen können natürlich vollkommen frei umgesetzt werden.

---

# Konfiguration - Extra-Einstellungen

In den Extra-Einstellungen werden verschiedene Einstellungen ausgeführt, die in den verschiedenen Kofigurationen eingesetzt werden.

![extraSettings.jpg](img/extraSettings.jpg)

## Astro-Einstellungen
Diese Einstellungen sind eigentlich selbsterklärend: Breiten- und Längengrad des Wohnorts um den Sonnenstand korrekt berechnen zu können.

**Zeitverzögerung:** Hier kann ein Offset eingegeben werden um den sich die Rolladenfahrten für hoch bzw. runter von den später ausgewählten Astro-Events evrschieben soll.

**Zeitverzögerung für das Fahren der Fensterläden:**

**Ende Sonnenschutz mit Sonnenhöhe:** In einer Bebauung oder in der Nähe von hohen Bäumen, muss die Beschattung nicht zwangsläufig bis zum Erreichen des eingestellten Azimuts dauern. Sobald die Sonne die hier eingestellte Höhe (und damit die Nachbarbebauung) unterschreitet, endet die Beschattung

## Extra-Einstellungen

**Überprüfen des aktuellen Rollladenstatus:** Bei einigen User (unter anderen shelly User) tritt das Problem auf, dass sich das Level noch einmal etwas verändert. Ausdiesem Grund gibt es hier eine Checkbox. Sollte die Checkbox aktiv sein, prüft shuttercontroll 1 Minute nach der letzten Fahrt des Rollladens das aktuelle Level und speichert es temporär.

**Verwenden der gesetzlichen Feiertage:** Sollen die Rollläden an Feiertagen so wie an Wochenenden fahren wird die Checkbox aktiviert und eine Instanz des Feiertage-Adapters ausgewählt.
Man kann so ggf. zwei Instanzen des Feiertage-Adapters anlegen; einen zum anzeigen aller möglicher Feiertage und einen mit arbeitszeitrelevanten Feiertagen, auf die dann shuttercontrol zugreift.

