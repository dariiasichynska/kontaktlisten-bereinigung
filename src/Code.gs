// Version 1.4 (2026-11-10): Firmenname SICH Studio
/**
 * Anbindung an Google Sheets: Menü, Lesen, Schreiben, Protokoll, Zeitsteuerung.
 * Die eigentlichen Regeln stehen in Bereinigung.gs, die Zuordnung der Spalten in Konfiguration.gs.
 */

var MENUE = 'Datenpflege';

function onOpen() {
  SpreadsheetApp.getUi().createMenu(MENUE)
    .addItem('Kontaktlisten bereinigen', 'bereinigeKontaktlisten')
    .addItem('Cockpit anzeigen', 'zeigeCockpit')
    .addSeparator()
    .addItem('Täglichen Lauf einrichten (7 Uhr)', 'richteTaeglichenLaufEin')
    .addItem('Täglichen Lauf entfernen', 'entferneTaeglichenLauf')
    .addToUi();
}

/** Hauptlauf: aus dem Menü oder per Zeitsteuerung. */
function bereinigeKontaktlisten() {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) {
    meldung('Es läuft bereits eine Bereinigung. Bitte in einer Minute erneut versuchen.');
    return;
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    var tabs = {};
    var namen = KONFIG.quellen.map(function (q) { return q.tab; }).concat([KONFIG.sperrliste.tab]);
    namen.forEach(function (name) {
      var blatt = ss.getSheetByName(name);
      tabs[name] = blatt ? blatt.getDataRange().getValues() : null;
    });

    var ergebnis = bereinige(tabs, KONFIG);

    schreibeTab(ss, KONFIG.ausgabe.sauber, ZIEL_SPALTEN, ergebnis.sauber, '#2F4858');
    schreibeTab(ss, KONFIG.ausgabe.pruefen, PRUEF_SPALTEN, ergebnis.pruefen, '#9C4A2F');
    schreibeProtokoll(ss, ergebnis.protokoll, '');
    speichereCockpitDaten(ergebnis.protokoll);

    var p = ergebnis.protokoll;
    var text = p.summeGelesen + ' Zeilen gelesen → ' + p.sauber + ' sauber, ' + p.pruefen + ' zu prüfen, ' +
               p.gesperrt + ' gesperrt. Bilanz: ' + (p.bilanzOk ? 'OK' : 'FEHLER');
    if (p.bilanzOk) {
      ss.toast(text, MENUE, 10);
    } else {
      meldung('Achtung: Die Bilanz stimmt nicht – es sind Zeilen verloren gegangen.\n\n' + text +
              '\n\nBitte das Ergebnis nicht verwenden und den Tab „' + KONFIG.ausgabe.protokoll + '“ prüfen.');
    }
  } catch (fehler) {
    try { schreibeProtokoll(ss, null, fehler.message); } catch (e) { console.error(e); } // Fehler im Protokoll darf die Ursache nicht verdecken
    meldung('Die Bereinigung wurde abgebrochen:\n\n' + fehler.message);
    throw fehler;
  } finally {
    lock.releaseLock();
  }
}

/** Ergebnis-Tab komplett neu schreiben (idempotent). Alles als Text, damit Sheets nichts umdeutet. */
function schreibeTab(ss, name, kopf, zeilen, farbe) {
  var blatt = ss.getSheetByName(name) || ss.insertSheet(name);
  blatt.clear();
  var daten = [kopf].concat(zeilen.map(function (zeile) { return zeile.map(entschaerfe); }));
  var bereich = blatt.getRange(1, 1, daten.length, kopf.length);
  // Ohne Textformat macht Sheets aus „+493023125002“ eine Zahl und das Plus verschwindet,
  // aus „2026-09-15“ ein Datum. Deshalb zuerst Format „Text“, dann Werte.
  bereich.setNumberFormat('@');
  bereich.setValues(daten);
  blatt.getRange(1, 1, 1, kopf.length).setFontWeight('bold').setFontColor('#FFFFFF').setBackground(farbe);
  blatt.setFrozenRows(1);
  blatt.autoResizeColumns(1, kopf.length);
}

/**
 * Schutz vor Formel-Injektion: Ein Wert aus einem öffentlichen Formular wie „=IMPORTXML(…)“
 * darf in der Tabelle nie als Formel laufen. Ein vorangestelltes Hochkomma macht ihn zu reinem Text.
 */
function entschaerfe(wert) {
  return typeof wert === 'string' && wert.charAt(0) === '=' ? "'" + wert : wert;
}

/** Jede Ausführung hängt eine Zeile an – auch abgebrochene Läufe. */
function schreibeProtokoll(ss, p, fehlertext) {
  var name = KONFIG.ausgabe.protokoll;
  var blatt = ss.getSheetByName(name) || ss.insertSheet(name);
  var quellen = KONFIG.quellen.map(function (q) { return q.tab; });
  if (blatt.getLastRow() === 0) {
    var kopf = ['Zeitpunkt'].concat(quellen, ['gelesen gesamt', 'gesperrt', 'Sauber', 'Prüfen',
                'zusammengeführt', 'Bilanz', 'Hinweis']);
    blatt.appendRow(kopf);
    blatt.getRange(1, 1, 1, kopf.length).setFontWeight('bold');
    blatt.setFrozenRows(1);
  }
  // Zeitzone aus dem Manifest (appsscript.json). Die Tabelle selbst liefert nach einem Import nicht immer eine.
  var zeitzone = Session.getScriptTimeZone() || 'Europe/Berlin';
  var zeit = Utilities.formatDate(new Date(), zeitzone, 'yyyy-MM-dd HH:mm:ss');
  if (!p) {
    blatt.appendRow([zeit].concat(quellen.map(function () { return ''; }), ['', '', '', '', '', 'ABBRUCH', entschaerfe(String(fehlertext))]));
    return;
  }
  blatt.appendRow([zeit].concat(
    quellen.map(function (q) { return p.gelesen[q]; }),
    [p.summeGelesen, p.gesperrt, p.sauber, p.pruefen, p.zusammengefuehrt, p.bilanzOk ? 'OK' : 'FEHLER',
     [p.bilanzOk ? '' : 'Gelesen ≠ Sauber + Prüfen + gesperrt',
      p.datumUnlesbar ? p.datumUnlesbar + ' Datumswert(e) nicht lesbar' : ''].filter(Boolean).join('; ')]
  ));
}

/** Hinweisfenster im Menü-Lauf; bei Zeitsteuerung (ohne Oberfläche) nur ins Log. */
function meldung(text) {
  try {
    SpreadsheetApp.getUi().alert(MENUE, text, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    console.warn(text);
  }
}

/* ------------------------------------------------------------------ Cockpit */

var COCKPIT_SCHLUESSEL = 'COCKPIT_DATEN';

/**
 * Legt die Kennzahlen des letzten Laufs als JSON in den Dokument-Eigenschaften ab.
 * Das Cockpit liest nur diese Zahlen – es greift nie auf die Tabelle zu und kennt keine Namen oder Adressen.
 */
function speichereCockpitDaten(p) {
  var daten = {
    stand: Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Europe/Berlin', 'dd.MM.yyyy HH:mm'),
    bilanzOk: p.bilanzOk,
    gelesen: p.summeGelesen, sauber: p.sauber, pruefen: p.pruefen, gesperrt: p.gesperrt, zusammengefuehrt: p.zusammengefuehrt,
    fluss: KONFIG.quellen.map(function (q) {
      var j = p.jeQuelle[q.tab];
      return { quelle: q.tab, sauber: j.sauber, pruefen: j.pruefen, gesperrt: j.gesperrt };
    }).sort(function (a, b) { return (b.sauber + b.pruefen + b.gesperrt) - (a.sauber + a.pruefen + a.gesperrt); }),
    gruende: Object.keys(p.gruende).map(function (g) { return [g, p.gruende[g]]; })
      .sort(function (a, b) { return b[1] - a[1] || (a[0] < b[0] ? -1 : 1); }),
    nameAufSperrliste: p.gruende['Name auf Sperrliste'] || 0,
    anfragenGerettet: p.gruende['Gesperrt, aber neue Anfrage'] || 0,
    annahmen: KONFIG.cockpit
  };
  PropertiesService.getDocumentProperties().setProperty(COCKPIT_SCHLUESSEL, JSON.stringify(daten));
}

/** Baut die Cockpit-Seite: Vorlage Dashboard.html + Zahlen des letzten Laufs. */
function baueCockpit() {
  var json = PropertiesService.getDocumentProperties().getProperty(COCKPIT_SCHLUESSEL);
  if (!json) {
    return HtmlService.createHtmlOutput('<p style="font:16px system-ui;padding:32px">Noch keine Zahlen vorhanden. ' +
      'Bitte zuerst in der Tabelle <b>Datenpflege → Kontaktlisten bereinigen</b> ausführen.</p>');
  }
  var vorlage = HtmlService.createHtmlOutputFromFile('Dashboard').getContent();
  var sicher = json.replace(/</g, '\\u003c'); // kein „</script>“ im eingebetteten JSON
  var html = vorlage.replace(/\/\*DATEN\*\/[\s\S]*?\/\*DATEN\*\//, function () { return sicher; });
  return HtmlService.createHtmlOutput(html)
    .setTitle('Kontaktdaten-Cockpit · SICH Studio')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Web-App: wird über Bereitstellen → Web-App als Link erreichbar. */
function doGet() {
  return baueCockpit();
}

/** Dasselbe Cockpit als Fenster in der Tabelle – ohne Bereitstellung. */
function zeigeCockpit() {
  SpreadsheetApp.getUi().showModelessDialog(baueCockpit().setWidth(1220).setHeight(820), 'Kontaktdaten-Cockpit');
}

function richteTaeglichenLaufEin() {
  entferneTaeglichenLauf(true);
  ScriptApp.newTrigger('bereinigeKontaktlisten').timeBased().everyDays(1).atHour(7).create();
  meldung('Die Bereinigung läuft ab jetzt täglich zwischen 7 und 8 Uhr.');
}

function entferneTaeglichenLauf(still) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'bereinigeKontaktlisten') ScriptApp.deleteTrigger(t);
  });
  if (still !== true) meldung('Der tägliche Lauf ist entfernt.');
}
