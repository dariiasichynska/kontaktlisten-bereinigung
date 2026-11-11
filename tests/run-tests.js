/**
 * Lokale Tests der Kernlogik – ohne Google-Konto.
 * Lädt src/Konfiguration.gs und src/Bereinigung.gs wie Apps Script (gemeinsamer globaler Bereich)
 * und prüft die Abnahme aus docs/spezifikation.md.
 *
 * Aufruf: node tests/run-tests.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = vm.createContext({});
for (const datei of ['Konfiguration.gs', 'Bereinigung.gs']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', datei), 'utf8'), ctx, { filename: datei });
}
const { bereinige, KONFIG, teileName, normalisiereTelefon, normalisiereDatum } = ctx;

let ok = 0, fehler = 0;
function pruefe(bedingung, text) {
  if (bedingung) { ok++; } else { fehler++; console.log('  ✗ ' + text); }
}

// --- 1. Einzelne Bausteine
const T = (roh, erwartet) => pruefe(normalisiereTelefon(roh, KONFIG).wert === erwartet, `Telefon ${roh} -> ${erwartet}, ist ${normalisiereTelefon(roh, KONFIG).wert}`);
T('030/23125002', '+493023125002');
T('0049 40 66969001', '+494066969001');
T('+49 (0)30 231 25002', '+493023125002');   // Kurs-Ausdruck liefert hier +49030…
T('0171-392-0001', '+491713920001');
pruefe(!normalisiereTelefon('040 / 12', KONFIG).lesbar, 'Telefon 040 / 12 unlesbar');
pruefe(!normalisiereTelefon('siehe Website', KONFIG).lesbar, 'Telefon „siehe Website“ unlesbar');

const N = (roh, v, n, p) => {
  const r = teileName(roh, KONFIG);
  pruefe(r.vorname === v && r.nachname === n && r.problem === p, `Name „${roh}“ -> ${v}/${n}/${p || '–'}, ist ${r.vorname}/${r.nachname}/${r.problem || '–'}`);
};
N('Seidel, Bettina', 'Bettina', 'Seidel', '');
N('Henrik von der Heide', 'Henrik', 'von der Heide', '');
N('PETRA  SCHMITT', 'Petra', 'Schmitt', '');
N('franziska meyer-albrecht', 'Franziska', 'Meyer-Albrecht', '');
N('Anna Lena Vogt', 'Anna', 'Lena Vogt', 'Name nicht eindeutig');
N('Dr. Klaus Berg', 'Klaus', 'Berg', 'Titel im Namen');
N('Krause', '', 'Krause', '');

const D = (roh, erwartet) => pruefe(normalisiereDatum(roh) === erwartet, `Datum ${roh} -> ${erwartet}, ist ${normalisiereDatum(roh)}`);
D('8.10.26', '2026-10-08');
D('08.10.2026', '2026-10-08');
D('2026-10-05 18:22', '2026-10-05');
D(46280, '2026-09-15');
D(new Date(2026, 8, 13, 10, 30), '2026-09-13');
D('irgendwann', '');

// --- 1c. v1.5: Entscheidungen behalten, Markierung
{
  const { uebernimmEntscheidungen, markierteZellen, PRUEF_SPALTEN } = ctx;
  const leer = ['', '', '', '', '', '', ''];
  const neu = [['Vorname fehlt', 'a@x.example', '', 'Krause', '', '', '', 'Messe-4'],
               ['E-Mail fehlt', '', 'Ole', 'Hansen', '', '', '', 'Messe-9']];
  const alt = [PRUEF_SPALTEN.concat(['entscheidung', 'notiz']),
               ['Vorname fehlt', 'a@x.example', '', 'Krause', '', '', '', 'Messe-4', 'erledigt', 'Herr Krause'],
               ['E-Mail fehlt', '', 'Alt', '', '', '', '', 'Messe-2', '', 'angerufen'],
               ['E-Mail fehlt', '', 'Leer', '', '', '', '', 'Messe-3', '', '']];
  const e = uebernimmEntscheidungen(alt, neu);
  pruefe(e.zeilen[0].slice(-2).join('|') === 'erledigt|Herr Krause' && e.zeilen[1].slice(-2).join('|') === '|', 'Entscheidung per quellen übernommen, neue Zeile leer');
  pruefe(e.uebernommen === 1 && e.archiv.length === 1 && e.archiv[0][1] === 'Messe-2' && e.archiv[0][7] === 'angerufen', 'verwaiste Notiz ins Archiv, leere Zeile nicht');
  pruefe(uebernimmEntscheidungen(null, neu).zeilen.every(z => z.length === 10), 'erster Lauf: zwei leere Spalten angehängt');
  pruefe(uebernimmEntscheidungen([PRUEF_SPALTEN, ['Vorname fehlt'].concat(leer)], neu).archiv.length === 0, 'Prüfen aus v1.4 ohne Mensch-Spalten: nichts zu übernehmen');
  const m = markierteZellen([['E-Mail ungültig; Titel im Namen', 'x', 'Klaus', 'Berg', '', '', '', 'Messe-1'],
                             ['Mögliches Duplikat zu a@x.example', 'b@x.example', 'Anna', 'Berg', '', '', '', 'Webinar-1']], KONFIG);
  const an = (z) => PRUEF_SPALTEN.filter((s, i) => m[z][i]).join(',');
  pruefe(an(0) === 'email,vorname,nachname', 'Markierung: zwei Gründe -> E-Mail, Vorname, Nachname');
  pruefe(an(1) === 'email,vorname,nachname', 'Markierung: Grund mit Details wird erkannt');
  const alleGruende = ['E-Mail fehlt', 'E-Mail ungültig', 'Rollenadresse', 'Vorname fehlt', 'Name nicht eindeutig', 'Titel im Namen',
    'Gesperrt, aber neue Anfrage', 'Gleiche E-Mail, verschiedene Vornamen', 'Nachname weicht ab', 'Telefon nicht lesbar',
    'Mögliches Duplikat', 'Name auf Sperrliste'];
  pruefe(alleGruende.every(g => (KONFIG.markierung.spalten[g] || []).length > 0), 'jeder Prüfgrund hat eine Markierung');
}

// --- 1b. Regressionstests aus dem Code-Review vom 10.11.2026
T('+49 030 2312 5002', '+493023125002');     // 0 nach Ländervorwahl
T('0049 030 23125002', '+493023125002');
N('van Dijk', '', 'van Dijk', '');            // beginnt mit Namenszusatz
N('JÜRGEN WEIß', 'Jürgen', 'Weiß', '');       // ß hat keinen Großbuchstaben
D('08.10.2026 14:30', '2026-10-08');          // deutsches Datum mit Uhrzeit
D('31.02.2026', '');                          // gibt es nicht
pruefe(ctx.saeubereEmail('max­.muster‎@firma.example') === 'max.muster@firma.example', 'weiches Trennzeichen / Richtungsmarke entfernt');
pruefe(ctx.vergleichsform('Шевченко') === 'шевченко', 'Vergleichsform behält kyrillische Buchstaben');
pruefe(ctx.vergleichsform('René') === ctx.vergleichsform('Rene'), 'Vergleichsform ignoriert Akzente');
pruefe(ctx.firmenSchluessel('Muster & Co.', KONFIG) === ctx.firmenSchluessel('Muster und Co', KONFIG), 'Firmenvergleich: & = und');
{
  const K = ['Anfrage-ID', 'Vorname', 'Nachname', 'Firma', 'E-Mail', 'Telefon', 'Eingang', 'Nachricht'];
  const leer = { Kontaktformular: [K], Webinar: [['Teilnehmer', 'E-Mail-Adresse', 'Unternehmen', 'Anmeldedatum', 'Teilgenommen']],
    Messe: [['Name', 'Firma', 'Mail', 'Tel.', 'Notiz', 'Datum']], Newsletter: [['E-Mail', 'Vorname', 'Angemeldet am', 'Status']],
    Sperrliste: [['E-Mail', 'Name', 'Widerspruch am', 'Kanal']] };
  let abbruch = '';
  try { bereinige(Object.assign({}, leer, { Sperrliste: null }), KONFIG); } catch (e) { abbruch = e.message; }
  pruefe(abbruch.includes('Sperrliste'), 'Fehlende Sperrliste bricht ab (statt alle durchzulassen)');
  const r = bereinige(Object.assign({}, leer, { Kontaktformular: [K, ['1', 'Max', 'Muster', '', 'constructor', '', 'Oktober 2026', '']] }), KONFIG);
  pruefe(r.protokoll.gesperrt === 0 && r.pruefen.length === 1, 'E-Mail-Wert „constructor“ gilt nicht als gesperrt');
  pruefe(r.protokoll.datumUnlesbar === 1, 'Unlesbares Datum wird gezählt');
  // Sperre und spätere Anfrage
  const S = (datumAnfrage) => bereinige(Object.assign({}, leer, {
    Sperrliste: [leer.Sperrliste[0], ['max@a.example', 'Max Muster', '2026-06-02', 'E-Mail']],
    Kontaktformular: [K, ['1', 'Max', 'Muster', 'A GmbH', 'MAX@a.example', '', datumAnfrage, 'Bitte um Rückruf']],
    Messe: [leer.Messe[0], ['Max Muster', 'A GmbH', 'max@a.example', '', '', '08.10.2026']] }), KONFIG);
  let s = S('2026-07-24');
  pruefe(s.pruefen.length === 1 && s.pruefen[0][0] === 'Gesperrt, aber neue Anfrage (Widerspruch am 2026-06-02)' && s.protokoll.gesperrt === 1 && s.sauber.length === 0 && s.protokoll.bilanzOk,
    'Anfrage nach Widerspruch -> Prüfen; Messe-Zeile bleibt gesperrt');
  s = S('2026-05-01');
  pruefe(s.pruefen.length === 0 && s.protokoll.gesperrt === 2, 'Anfrage VOR dem Widerspruch bleibt gesperrt');
  s = S('');
  pruefe(s.pruefen.length === 1, 'Anfrage ohne Datum: im Zweifel Prüfen');
  // Eine E-Mail, zwei Personen
  const g = bereinige(Object.assign({}, leer, { Kontaktformular: [K, ['1', 'Anna', 'Berg', '', 'praxis@berg.example', '', '2026-01-01', ''], ['2', 'Andreas', 'Berg', '', 'praxis@berg.example', '', '2026-01-02', '']] }), KONFIG);
  pruefe(g.sauber.length === 0 && g.pruefen.length === 2 && g.pruefen.every(z => z[0].includes('Gleiche E-Mail, verschiedene Vornamen (Anna / Andreas)')) && g.protokoll.bilanzOk,
    'Eine E-Mail, zwei Vornamen: beide bleiben erhalten, beide auf Prüfen');
  const j = bereinige(Object.assign({}, leer, { Kontaktformular: [K, ['1', 'Jörg', 'Möller', '', 'j@a.example', '', '', '']], Messe: [leer.Messe[0], ['Joerg Moeller', '', 'j@a.example', '', '', '']] }), KONFIG);
  pruefe(j.sauber.length === 1 && j.pruefen.length === 0, 'Jörg / Joerg bleibt EINE Person');
  const k = bereinige(Object.assign({}, leer, { Kontaktformular: [K, ['1', 'Тарас', 'Шевченко', '', 't@a.example', '', '', ''], ['2', 'Тарас', 'Коваленко', '', 't@a.example', '', '', '']] }), KONFIG);
  pruefe(k.pruefen.length === 1 && k.pruefen[0][0].includes('Nachname weicht ab'), 'Nachname-Konflikt auch in kyrillischer Schrift');
}

// --- 2. Gesamtlauf mit den Testdaten
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture.json'), 'utf8'), (k, v) =>
  v && typeof v === 'object' && v.$date ? new Date(v.$date) : v);
const ergebnis = bereinige(fixture, KONFIG);
const p = ergebnis.protokoll;

// Ergebnis als Objekte, mit Fundstellen-Index
const alsObjekt = (zeile, spalten) => Object.fromEntries(spalten.map((s, i) => [s, zeile[i]]));
const sauber = ergebnis.sauber.map(z => alsObjekt(z, ctx.ZIEL_SPALTEN));
const pruefen = ergebnis.pruefen.map(z => alsObjekt(z, ctx.PRUEF_SPALTEN));
const finde = fs_ => {
  for (const d of sauber) if (d.quellen.split(', ').includes(fs_)) return ['Sauber', d];
  for (const d of pruefen) if (d.quellen.split(', ').includes(fs_)) return ['Prüfen', d];
  return ['gesperrt', null];
};

const faelle = JSON.parse(fs.readFileSync(path.join(__dirname, 'sonderfaelle.json'), 'utf8'));
for (const f of faelle) {
  const [tab, d] = finde(f.fundstelle);
  const text = `${f.fall} ${f.fundstelle}: ${f.beschreibung}`;
  pruefe(tab === f.erwartet, `${text} – erwartet ${f.erwartet}, ist ${tab}${d && d.grund ? ' (' + d.grund + ')' : ''}`);
  if (f.grund_enthaelt && d) {
    for (const teil of f.grund_enthaelt.split('; ')) {
      pruefe((d.grund || '').includes(teil), `${text} – Grund soll „${teil}“ enthalten, ist „${d.grund}“`);
    }
  }
  if (f.felder && d) {
    for (const [feld, wert] of Object.entries(f.felder)) {
      const ist = feld === 'anzahl_quellen' ? d.quellen.split(', ').length : d[feld];
      pruefe(ist === wert, `${text} – ${feld} soll ${wert} sein, ist ${ist}`);
    }
  }
}

// --- 3. Abnahme
pruefe(p.bilanzOk, `Bilanz: ${p.summeGelesen} gelesen ≠ ${p.sauberFundstellen} + ${p.pruefenFundstellen} + ${p.gesperrt}`);
pruefe(new Set(sauber.map(d => d.email)).size === sauber.length, 'Sauber: jede E-Mail nur einmal');
pruefe(sauber.every(d => d.vorname && /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(d.email)), 'Sauber: alle mit Vorname und gültiger E-Mail');
pruefe(sauber.every(d => !d.telefon || /^\+\d{10,15}$/.test(d.telefon)), 'Sauber: Telefon immer +49…');
pruefe(sauber.every(d => !d.erster_kontakt || /^\d{4}-\d{2}-\d{2}$/.test(d.erster_kontakt)), 'Sauber: Datum immer JJJJ-MM-TT');
const zweiterLauf = bereinige(fixture, KONFIG);
pruefe(JSON.stringify(zweiterLauf) === JSON.stringify(ergebnis), 'Zweiter Lauf liefert identisches Ergebnis');

// --- Bericht
console.log('\nGelesen:', JSON.stringify(p.gelesen), '=', p.summeGelesen);
console.log(`Sauber: ${p.sauber} Datensätze (${p.sauberFundstellen} Zeilen) · Prüfen: ${p.pruefen} (${p.pruefenFundstellen} Zeilen) · gesperrt: ${p.gesperrt} Zeilen · zusammengeführt: ${p.zusammengefuehrt}`);
console.log(`Bilanz: ${p.bilanzOk ? 'OK' : 'FEHLER'}`);
const gruende = {};
pruefen.forEach(d => d.grund.split('; ').forEach(g => { const k = g.replace(/ \(.*| zu .*/, ''); gruende[k] = (gruende[k] || 0) + 1; }));
console.log('Gründe auf Prüfen:', JSON.stringify(gruende));
console.log(`\n${ok} Prüfungen bestanden, ${fehler} fehlgeschlagen.`);
if (process.argv.includes('--ausgabe')) {
  fs.writeFileSync(path.join(__dirname, 'ergebnis.json'), JSON.stringify({ sauber, pruefen, protokoll: p }, null, 1));
}
process.exit(fehler ? 1 : 0);
