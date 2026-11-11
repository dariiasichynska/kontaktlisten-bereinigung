/**
 * Rauchtest für Code.gs: simuliert SpreadsheetApp & Co. mit den Testdaten
 * und prüft, dass Menü-Lauf, Tabs, Textformat und Protokoll funktionieren.
 * v1.5: zusätzlich Markierung, Auswahlliste, Tab „Kontrolle“ (Formeln in JS nachgerechnet), Entscheidungen über Läufe.
 * Aufruf: node tests/smoke-sheets.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture.json'), 'utf8'), (k, v) =>
  v && typeof v === 'object' && v.$date ? new Date(v.$date) : v);

function neuesBlatt(name, werte) {
  const b = { name, werte: werte || [], formate: [], formeln: {}, farben: {}, auswahl: [], toasts: [] };
  const setze = (r, c, v) => {
    while (b.werte.length < r) b.werte.push([]);
    b.werte[r - 1][c - 1] = v;
  };
  const bereich = (r, c, h = 1, w = 1) => ({
    setNumberFormat(f) { b.formate.push({ r, c, h, w, f }); return this; },
    setValues(v) {
      if (v.length !== h || v.some(z => z.length !== w)) throw new Error(`setValues: Größe passt nicht (${name})`);
      v.forEach((z, i) => z.forEach((x, j) => setze(r + i, c + j, x)));
      return this;
    },
    setValue(v) { setze(r, c, v); return this; },
    setFormula(f) { b.formeln[`${r},${c}`] = f; setze(r, c, f); return this; },
    setBackgrounds(m) {
      if (m.length !== h || m.some(z => z.length !== w)) throw new Error(`setBackgrounds: Größe passt nicht (${name})`);
      m.forEach((z, i) => z.forEach((x, j) => { if (x) b.farben[`${r + i},${c + j}`] = x; }));
      return this;
    },
    setDataValidation(regel) { b.auswahl.push({ r, c, h, w, regel }); return this; },
    clearDataValidations() { b.auswahl = []; return this; },
    setFontWeight() { return this; }, setFontColor() { return this; }, setBackground() { return this; }, setFontSize() { return this; },
  });
  Object.assign(b, {
    getDataRange: () => ({ getValues: () => b.werte.map(z => z.slice()) }),
    getRange: bereich,
    clear() { b.werte = []; b.formate = []; b.formeln = {}; b.farben = {}; },
    setFrozenRows() {}, autoResizeColumns() {}, setColumnWidth() {},
    getMaxRows: () => Math.max(1000, b.werte.length), getMaxColumns: () => 26,
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
    newDataValidation: () => {
      const regel = {};
      const builder = {
        requireValueInList(liste) { regel.liste = liste; return builder; },
        setAllowInvalid(x) { regel.frei = x; return builder; },
        build: () => regel,
      };
      return builder;
    },
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
const kopfP = pruefen.werte[0];
const zeileVon = (teil) => pruefen.werte.findIndex(z => String(z[0]).includes(teil)) + 1; // 1-basiert

// --- v1.5: Markierung der Problemzelle
const spalteP = n => kopfP.indexOf(n) + 1;
{
  const r = zeileVon('Telefon nicht lesbar');
  pruefe(pruefen.farben[`${r},${spalteP('telefon')}`] === '#FFF2CC', 'Telefon nicht lesbar: Telefon-Zelle markiert');
  pruefe(!pruefen.farben[`${r},${spalteP('firma')}`], 'Telefon nicht lesbar: Firma nicht markiert');
  const e = zeileVon('E-Mail ungültig');
  pruefe(pruefen.farben[`${e},${spalteP('email')}`] === '#FFF2CC', 'E-Mail ungültig: E-Mail-Zelle markiert');
  pruefe(Object.keys(pruefen.farben).length >= 17, 'jede Prüf-Zeile hat mindestens eine markierte Zelle');
}

// --- v1.5: Gegenprobe im Tab „Kontrolle“ – Formeln in JS nachgerechnet
const kontrolle = blaetter['Kontrolle'];
function rechne(formel) {
  let m = formel.match(/^=SUMPRODUCT\(\(LEN\('(.+?)'!([A-Z])2:[A-Z]\)-LEN\(SUBSTITUTE\('.+?'!.+?,"(.+?)",""\)\)\)\/LEN\(".+?"\)\)$/);
  if (m) {
    const [, tab, sp, such] = m; const i = sp.charCodeAt(0) - 65;
    return blaetter[tab].werte.slice(1).reduce((s, z) => s + String(z[i] || '').split(such).length - 1, 0);
  }
  m = formel.match(/^=SUMPRODUCT\(--\(LEN\(TRIM\(BYROW\('(.+?)'!A2:Z,LAMBDA\(zeile,TEXTJOIN\("",TRUE,zeile\)\)\)\)\)>0\)\)$/);
  if (m) return blaetter[m[1]].werte.slice(1).filter(z => z.map(x => x === null || x === undefined ? '' : String(x)).join('').trim() !== '').length;
  m = formel.match(/^=COUNTA\('(.+?)'!([A-Z])2:[A-Z]\)$/);
  if (m) { const i = m[2].charCodeAt(0) - 65; return blaetter[m[1]].werte.slice(1).filter(z => z[i] !== '' && z[i] !== undefined).length; }
  return null;
}
const wert = (r, c) => { const f = kontrolle.formeln[`${r},${c}`]; return f ? rechne(f) : kontrolle.werte[r - 1][c - 1]; };
let summeGelesen = 0, summeGesperrt = 0;
for (let r = 5; r <= 8; r++) {
  const gelesen = wert(r, 2), inSauber = wert(r, 4), inPruefen = wert(r, 5);
  pruefe(gelesen !== null && gelesen === wert(r, 3), `Kontrolle ${wert(r, 1)}: gelesen Formel ${gelesen} = Skript ${wert(r, 3)}`);
  pruefe(gelesen - inSauber - inPruefen === wert(r, 7), `Kontrolle ${wert(r, 1)}: Rest ${gelesen - inSauber - inPruefen} = gesperrt laut Skript ${wert(r, 7)}`);
  summeGelesen += gelesen; summeGesperrt += gelesen - inSauber - inPruefen;
}
pruefe(summeGelesen === 150 && summeGesperrt === 8, `Kontrolle Summe: 150 gelesen, 8 gesperrt (ist ${summeGelesen} / ${summeGesperrt})`);
pruefe(wert(12, 2) === 96 && wert(12, 3) === 96 && wert(13, 2) === 17 && wert(13, 3) === 17, 'Kontrolle: COUNTA Sauber 96, Prüfen 17');
pruefe(/^=IF\(COUNTIF\(H5:H9,"✗"\)\+COUNTIF\(D12:D14,"✗"\)=0,"OK","ABWEICHUNG"\)$/.test(kontrolle.formeln['16,2']), 'Kontrolle: Gesamtergebnis-Formel zeigt auf die richtigen Zellen');
pruefe(kontrolle.formeln['13,2'].includes("'Prüfen'!H2:H") && kontrolle.formeln['12,2'].includes("'Sauber'!G2:G"), 'Kontrolle: Spalte „quellen“ = G in Sauber, H in Prüfen');

// --- v1.5: Entscheidungen bleiben über Läufe hinweg erhalten
{
  const iE = kopfP.indexOf('entscheidung'), iN = kopfP.indexOf('notiz'), iQ = kopfP.indexOf('quellen');
  const r1 = zeileVon('Titel im Namen') - 1, r2 = zeileVon('Rollenadresse') - 1;
  const key1 = pruefen.werte[r1][iQ];
  pruefen.werte[r1][iE] = 'erledigt'; pruefen.werte[r1][iN] = 'Anrede: Frau Dr.';
  pruefen.werte[r2][iE] = 'in Arbeit';
  // ein Datensatz, den es im nächsten Lauf nicht mehr gibt (z. B. Quelle korrigiert)
  pruefen.werte.push(['E-Mail fehlt', '', 'Alt', 'Fall', '', '', '', 'Messe-999', 'verwerfen', 'doppelt erfasst']);
  ctx.bereinigeKontaktlisten();
  const neu = blaetter['Prüfen'].werte;
  const z1 = neu.find(z => z[iQ] === key1);
  pruefe(z1 && z1[iE] === 'erledigt' && z1[iN] === 'Anrede: Frau Dr.', 'Entscheidung + Notiz nach erneutem Lauf noch da');
  pruefe(neu.filter(z => z[iE] === 'in Arbeit').length === 1, 'zweite Entscheidung noch da');
  pruefe(neu.length === 18, 'Prüfen weiterhin 17 Datensätze');
  const archiv = blaetter['Entscheidungen-Archiv'];
  pruefe(archiv && archiv.werte.length === 2 && archiv.werte[1][1] === 'Messe-999' && archiv.werte[1][6] === 'verwerfen', 'verwaiste Entscheidung im Archiv');
  pruefe(prot.werte[prot.werte.length - 1].slice(-1)[0].includes('2 Entscheidung(en) übernommen; 1 Entscheidung(en) archiviert'), 'Protokoll nennt übernommene und archivierte Entscheidungen');
  ctx.bereinigeKontaktlisten(); // noch einmal: nichts doppelt im Archiv
  pruefe(archiv.werte.length === 2, 'Archiv: dritter Lauf schreibt nichts doppelt');
  pruefe(blaetter['Prüfen'].werte.filter(z => z[iE] === 'erledigt').length === 1, 'Entscheidung auch nach drittem Lauf da');
}
pruefe(sauber && sauber.werte.length === 97, `Sauber: 96 Datensätze + Kopf, ist ${sauber && sauber.werte.length}`);
pruefe(pruefen && pruefen.werte.length === 18, `Prüfen: 17 Datensätze + Kopf, ist ${pruefen && pruefen.werte.length}`);
pruefe(pruefen.werte[0].slice(-2).join() === 'entscheidung,notiz', 'Prüfen: Spalten entscheidung und notiz am Ende');
pruefe(pruefen.auswahl.length === 1 && pruefen.auswahl[0].h === 17 && pruefen.auswahl[0].regel.frei === true, 'Auswahlliste für 17 Zeilen, freier Text erlaubt');
pruefe(sauber.formate.length === 1 && sauber.formate[0].f === '@', 'Sauber als Text formatiert');
pruefe(prot.werte.length === 5 && prot.werte.slice(1).every(z => z.includes('OK')), 'Protokoll: Kopf + 4 Läufe mit Bilanz OK');
pruefe(toasts.length === 4 && alerts.length === 0, 'Erfolgsmeldung als Toast, kein Fehlerfenster');
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
pruefe(prot.werte[prot.werte.length - 1].includes('ABBRUCH'), 'Abbruch im Protokoll');

console.log('Protokoll:', prot.werte.map(z => z.join(' | ')).join('\n           '));
console.log(fehler ? `${fehler} Fehler` : 'Rauchtest bestanden.');
process.exit(fehler ? 1 : 0);
