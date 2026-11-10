/**
 * Rauchtest für Code.gs: simuliert SpreadsheetApp & Co. mit den Testdaten
 * und prüft, dass Menü-Lauf, Tabs, Textformat und Protokoll funktionieren.
 * Aufruf: node tests/smoke-sheets.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture.json'), 'utf8'), (k, v) =>
  v && typeof v === 'object' && v.$date ? new Date(v.$date) : v);

function neuesBlatt(name, werte) {
  const b = { name, werte: werte || [], formate: [], toasts: [] };
  const bereich = (r, c, h, w) => ({
    setNumberFormat(f) { b.formate.push({ r, c, h, w, f }); return this; },
    setValues(v) {
      if (v.length !== h || v.some(z => z.length !== w)) throw new Error(`setValues: Größe passt nicht (${name})`);
      v.forEach((z, i) => { b.werte[r - 1 + i] = z.slice(); });
      return this;
    },
    setFontWeight() { return this; }, setFontColor() { return this; }, setBackground() { return this; },
  });
  Object.assign(b, {
    getDataRange: () => ({ getValues: () => b.werte.map(z => z.slice()) }),
    getRange: bereich,
    clear() { b.werte = []; b.formate = []; },
    setFrozenRows() {}, autoResizeColumns() {},
    getLastRow: () => b.werte.length,
    appendRow(z) { b.werte.push(z); },
  });
  return b;
}

const blaetter = {};
for (const [name, werte] of Object.entries(fixture)) blaetter[name] = neuesBlatt(name, werte);
const eigenschaften = {};
const toasts = [], alerts = [], menue = [];
const ss = {
  getSheetByName: n => blaetter[n] || null,
  insertSheet: n => (blaetter[n] = neuesBlatt(n)),
  toast: t => toasts.push(t),
  getSpreadsheetTimeZone: () => null,
};
const ctx = vm.createContext({
  console,
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ss,
    getUi: () => ({
      createMenu: () => { const m = { addItem: (a, f) => (menue.push(f), m), addSeparator: () => m, addToUi: () => m }; return m; },
      alert: (titel, text) => alerts.push(text),
      ButtonSet: { OK: 'OK' },
    }),
  },
  PropertiesService: { getDocumentProperties: () => ({ setProperty: (k, v) => { eigenschaften[k] = v; }, getProperty: k => eigenschaften[k] || null }) },
  HtmlService: (() => {
    const ausgabe = inhalt => ({ inhalt, getContent() { return this.inhalt; }, setTitle() { return this; }, addMetaTag() { return this; }, setWidth() { return this; }, setHeight() { return this; } });
    return { createHtmlOutput: ausgabe, createHtmlOutputFromFile: n => ausgabe(fs.readFileSync(path.join(__dirname, '..', 'src', n + '.html'), 'utf8')) };
  })(),
  LockService: { getDocumentLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  Utilities: { formatDate: (d, tz) => { if (typeof tz !== 'string') throw new Error('Invalid argument: timeZone'); return '2026-11-10 09:00:00'; } },
  Session: { getScriptTimeZone: () => 'Europe/Berlin' },
  ScriptApp: { getProjectTriggers: () => [], deleteTrigger() {}, newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create() {} }) }) }) }) },
});
for (const datei of ['Konfiguration.gs', 'Bereinigung.gs', 'Code.gs']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', datei), 'utf8'), ctx, { filename: datei });
}

let fehler = 0;
const pruefe = (b, t) => { if (!b) { fehler++; console.log('  ✗ ' + t); } };

pruefe(ctx.doGet().getContent().includes('Noch keine Zahlen'), 'Cockpit vor dem ersten Lauf: Hinweis statt leerer Seite');
ctx.onOpen();
pruefe(menue.includes('bereinigeKontaktlisten'), 'Menüpunkt vorhanden');
ctx.bereinigeKontaktlisten();
ctx.bereinigeKontaktlisten(); // zweiter Klick

const sauber = blaetter['Sauber'], pruefen = blaetter['Prüfen'], prot = blaetter['Protokoll'];
pruefe(sauber && sauber.werte.length === 97, `Sauber: 96 Datensätze + Kopf, ist ${sauber && sauber.werte.length}`);
pruefe(pruefen && pruefen.werte.length === 18, `Prüfen: 17 Datensätze + Kopf, ist ${pruefen && pruefen.werte.length}`);
pruefe(sauber.formate.length === 1 && sauber.formate[0].f === '@', 'Sauber als Text formatiert');
pruefe(prot.werte.length === 3 && prot.werte[1].includes('OK') && prot.werte[2].includes('OK'), 'Protokoll: Kopf + 2 Läufe mit Bilanz OK');
pruefe(toasts.length === 2 && alerts.length === 0, 'Erfolgsmeldung als Toast, kein Fehlerfenster');
pruefe(JSON.stringify(fixture.Messe) === JSON.stringify(blaetter.Messe.werte), 'Quell-Tab Messe unverändert');

pruefe(ctx.entschaerfe('=IMPORTXML("x")') === "'=IMPORTXML(\"x\")" && ctx.entschaerfe('+4930123') === '+4930123', 'Formel-Schutz: = wird Text, +49 bleibt');

// Cockpit: Zahlen des Laufs landen in der Seite, keine personenbezogenen Daten
const cockpit = ctx.doGet().getContent();
const cd = JSON.parse(eigenschaften.COCKPIT_DATEN);
pruefe(cd.sauber === 96 && cd.pruefen === 17 && cd.gesperrt === 8 && cd.fluss.length === 4, 'Cockpit-Daten: 96 / 17 / 8, vier Quellen');
pruefe(cd.fluss.reduce((s, f) => s + f.sauber + f.pruefen + f.gesperrt, 0) === 150, 'Cockpit-Fluss: Summe = 150 Zeilen');
pruefe(cockpit.includes('"sauber":96') && !cockpit.includes('/*DATEN*/'), 'Cockpit-Seite enthält die Zahlen des Laufs');
pruefe(!/@[a-z0-9-]+\.example/.test(cockpit), 'Cockpit-Seite enthält keine E-Mail-Adressen');
fs.writeFileSync(path.join(__dirname, 'cockpit-vorschau.html'), cockpit);

// Fehlerfall: Spalte umbenannt -> verständliche Meldung + Protokoll ABBRUCH
blaetter.Messe.werte[0][2] = 'E-Mail';
try { ctx.bereinigeKontaktlisten(); } catch (e) { /* erwartet */ }
pruefe(alerts.some(a => a.includes('Spalte „Mail“ fehlt im Tab „Messe“')), 'Verständliche Fehlermeldung bei fehlender Spalte');
pruefe(prot.werte[3].includes('ABBRUCH'), 'Abbruch im Protokoll');

console.log('Protokoll:', prot.werte.map(z => z.join(' | ')).join('\n           '));
console.log(fehler ? `${fehler} Fehler` : 'Rauchtest bestanden.');
process.exit(fehler ? 1 : 0);
