// Version 1.3 (2026-11-10): Auswertung je Quelle und je Prüfgrund für das Cockpit
/**
 * Kernlogik der Kontaktlisten-Bereinigung.
 * Reine Funktionen: kein SpreadsheetApp, kein Netzwerk. Dadurch lokal testbar (tests/run-tests.js).
 *
 * Ablauf: Lesen → Zuordnen → Säubern → Sperren → Zusammenführen → Prüfen → Ergebnis
 * Leitsatz: Die Maschine säubert. Der Mensch entscheidet.
 */

var ZIEL_SPALTEN = ['email', 'vorname', 'nachname', 'firma', 'telefon', 'erster_kontakt', 'quellen'];
var PRUEF_SPALTEN = ['grund'].concat(ZIEL_SPALTEN);

/* ------------------------------------------------------------------ Säubern: Bausteine */

/** Unsichtbare Zeichen weg, geschützte Leerzeichen normal, Leerzeichen zusammenfassen und abschneiden. */
function saeubereText(wert) {
  if (wert === null || wert === undefined) return '';
  return String(wert)
    .replace(/[\u00AD\u200B-\u200F\u2060\uFEFF]/g, '') // unsichtbar: Zero-Width-Space, weiches Trennzeichen, Richtungsmarken
    .replace(/[\u00A0\u2007\u202F]/g, ' ')              // geschützte Leerzeichen
    .replace(/\s+/g, ' ')
    .trim();
}

function saeubereEmail(wert) {
  return saeubereText(wert).toLowerCase();
}

function istGueltigeEmail(email) {
  return /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(email) && email.indexOf('..') === -1;
}

function istRollenadresse(email, konfig) {
  var lokal = email.split('@')[0];
  return konfig.rollenadressen.indexOf(lokal) !== -1;
}

/** Nur wenn der ganze Name GROSS oder ganz klein ist, wird die Schreibweise korrigiert. */
function korrigiereSchreibweise(text, konfig) {
  var ohneSz = text.replace(/ß/g, '');
  var istGross = ohneSz === ohneSz.toUpperCase() && text !== text.toLowerCase();
  var istKlein = text === text.toLowerCase() && text !== text.toUpperCase();
  if (!istGross && !istKlein) return text;
  return text.split(' ').map(function (wort) {
    var klein = wort.toLowerCase();
    if (konfig.namenszusaetze.indexOf(klein) !== -1) return klein;
    return klein.split('-').map(function (teil) {
      return teil.charAt(0).toUpperCase() + teil.slice(1);
    }).join('-');
  }).join(' ');
}

/**
 * Teilt einen Namen aus EINER Zelle.
 * Rückgabe: { vorname, nachname, problem } – problem ist leer, wenn die Maschine sicher ist.
 */
function teileName(rohName, konfig) {
  var name = korrigiereSchreibweise(saeubereText(rohName), konfig);
  if (!name) return { vorname: '', nachname: '', problem: '' };

  var woerter = name.replace(',', ' ').split(' ').filter(Boolean);
  var hatTitel = woerter.some(function (w) { return konfig.titel.indexOf(w.toLowerCase()) !== -1; });
  if (hatTitel) {
    var ohneTitel = woerter.filter(function (w) { return konfig.titel.indexOf(w.toLowerCase()) === -1; });
    return { vorname: ohneTitel.slice(0, -1).join(' '), nachname: ohneTitel[ohneTitel.length - 1] || '', problem: 'Titel im Namen' };
  }

  // „Nachname, Vorname“
  var teile = name.split(',');
  if (teile.length === 2) {
    var nach = teile[0].trim(), vor = teile[1].trim();
    if (nach && vor && vor.indexOf(' ') === -1) return { vorname: vor, nachname: nach, problem: '' };
    return { vorname: vor, nachname: nach, problem: 'Name nicht eindeutig' };
  }
  if (teile.length > 2) return { vorname: '', nachname: name, problem: 'Name nicht eindeutig' };

  woerter = name.split(' ');
  if (woerter.length === 1) return { vorname: '', nachname: woerter[0], problem: '' }; // Visitenkarte: meist Nachname
  if (konfig.namenszusaetze.indexOf(woerter[0].toLowerCase()) !== -1) {
    return { vorname: '', nachname: name, problem: '' };                              // „van Dijk“: nur Nachname
  }
  if (woerter.length === 2) return { vorname: woerter[0], nachname: woerter[1], problem: '' };
  // 3+ Wörter: nur eindeutig, wenn ab dem 2. Wort ein Namenszusatz beginnt („Henrik von der Heide“)
  if (konfig.namenszusaetze.indexOf(woerter[1].toLowerCase()) !== -1) {
    return { vorname: woerter[0], nachname: woerter.slice(1).join(' '), problem: '' };
  }
  return { vorname: woerter[0], nachname: woerter.slice(1).join(' '), problem: 'Name nicht eindeutig' };
}

/**
 * Telefon -> E.164 (+49…). „(0)“ wird vorher entfernt – sonst entsteht aus „+49 (0)30“ ein falsches „+49030“.
 * Rückgabe: { wert, lesbar }. Leer ist erlaubt (lesbar = true, wert = '').
 */
function normalisiereTelefon(roh, konfig) {
  var text = saeubereText(roh);
  if (!text) return { wert: '', lesbar: true };
  var t = text.replace(/\(0\)/g, '').replace(/[^0-9+]/g, '');
  var plus = t.charAt(0) === '+';
  t = t.replace(/\+/g, '');
  var nummer;
  if (plus) nummer = t;
  else if (t.indexOf('00') === 0) nummer = t.slice(2);
  else if (t.indexOf('0') === 0) nummer = konfig.telefon.laendervorwahl + t.slice(1);
  else return { wert: text, lesbar: false };
  var lv = konfig.telefon.laendervorwahl;
  if (nummer.indexOf(lv + '0') === 0) nummer = lv + nummer.slice(lv.length + 1); // „+49 030…“ -> „+4930…“
  if (nummer.length < konfig.telefon.minZiffern || nummer.length > konfig.telefon.maxZiffern) {
    return { wert: text, lesbar: false };
  }
  return { wert: '+' + nummer, lesbar: true };
}

function zweistellig(n) { return (n < 10 ? '0' : '') + n; }

function datumGueltig(j, m, t) {
  var probe = new Date(Date.UTC(j, m - 1, t));
  if (probe.getUTCFullYear() !== j || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== t) return ''; // 31.02. gibt es nicht
  return j + '-' + zweistellig(m) + '-' + zweistellig(t);
}

/** Datum -> JJJJ-MM-TT. Versteht Datumszellen, Excel-Seriennummern und gängige Textformen. */
function normalisiereDatum(wert) {
  if (Object.prototype.toString.call(wert) === '[object Date]') {
    if (isNaN(wert.getTime())) return '';
    return datumGueltig(wert.getFullYear(), wert.getMonth() + 1, wert.getDate());
  }
  if (typeof wert === 'number') {
    if (wert < 20000 || wert > 80000) return '';           // plausible Excel-Seriennummer (1954–2119)
    var d = new Date(Date.UTC(1899, 11, 30) + Math.floor(wert) * 86400000);
    return datumGueltig(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  var text = saeubereText(wert);
  var m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return datumGueltig(+m[1], +m[2], +m[3]);
  m = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?!\d)/); // auch „08.10.2026 14:30“
  if (m) return datumGueltig(m[3].length === 2 ? 2000 + (+m[3]) : +m[3], +m[2], +m[1]);
  return '';
}

/** Vergleichsform: klein, Umlaute ausgeschrieben. „Möller“ und „Moeller“ werden gleich. Nur zum Vergleichen! */
function vergleichsform(text) {
  return saeubereText(text).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // Akzente: é -> e
    .replace(/ı/g, 'i')
    .replace(/[^\p{L}\p{N} -]/gu, '')                   // Buchstaben aller Schriften bleiben
    .replace(/\s+/g, ' ').trim();
}

function firmenSchluessel(firma, konfig) {
  return vergleichsform(firma).replace(/-/g, ' ').split(' ').filter(function (w) {
    return w && konfig.rechtsformen.indexOf(w) === -1;
  }).join(' ');
}

function namensSchluessel(vorname, nachname) {
  var v = vergleichsform(vorname), n = vergleichsform(nachname);
  return v && n ? v + '|' + n : '';
}

/* ------------------------------------------------------------------ Lesen und Zuordnen */

function spaltenIndex(kopf, tab) {
  var index = Object.create(null);
  kopf.forEach(function (name, i) { index[saeubereText(name)] = i; });
  return function (spalte) {
    if (!(spalte in index)) throw new Error('Spalte „' + spalte + '“ fehlt im Tab „' + tab + '“.');
    return index[spalte];
  };
}

function istLeereZeile(zeile) {
  return zeile.every(function (zelle) { return saeubereText(zelle) === ''; });
}

/** Eine Quellzeile -> Zeile im Ziel-Schema (gesäubert, aber noch nicht geprüft). */
function ordneZu(quelle, werte, zeilenNr, spalte, konfig) {
  var f = quelle.felder;
  var hole = function (feld) { return feld in f ? werte[spalte(f[feld])] : ''; };

  var vorname, nachname, namensproblem = '';
  if ('name' in f) {
    var geteilt = teileName(hole('name'), konfig);
    vorname = geteilt.vorname; nachname = geteilt.nachname; namensproblem = geteilt.problem;
  } else {
    vorname = korrigiereSchreibweise(saeubereText(hole('vorname')), konfig);
    nachname = korrigiereSchreibweise(saeubereText(hole('nachname')), konfig);
  }
  var rohEmail = saeubereEmail(hole('email'));
  var gesperrt = false;
  if (quelle.gesperrtWenn) {
    gesperrt = saeubereText(hole(quelle.gesperrtWenn.feld)).toLowerCase() === quelle.gesperrtWenn.wert;
  }
  return {
    fundstelle: quelle.tab + '-' + zeilenNr,
    tab: quelle.tab,
    prioritaet: quelle.prioritaet,
    zeilenNr: zeilenNr,
    email: rohEmail,
    emailGueltig: istGueltigeEmail(rohEmail),
    vorname: vorname,
    nachname: nachname,
    firma: saeubereText(hole('firma')),
    telefon: normalisiereTelefon(hole('telefon'), konfig),
    datum: normalisiereDatum(hole('datum')),
    datumUnlesbar: saeubereText(hole('datum')) !== '' && normalisiereDatum(hole('datum')) === '',
    namensproblem: namensproblem,
    aktiveAnfrage: !!quelle.aktiveAnfrage,
    gesperrtDurchQuelle: gesperrt
  };
}

/* ------------------------------------------------------------------ Hauptfunktion */

/**
 * @param {Object} tabs  { Tabname: 2D-Array wie getValues(), inkl. Kopfzeile }
 * @param {Object} konfig KONFIG
 * @return {{sauber: Array[], pruefen: Array[], protokoll: Object}}
 */
function bereinige(tabs, konfig) {
  var gelesen = {};
  var zeilen = [];

  // 1–3 Lesen, Zuordnen, Säubern
  konfig.quellen.forEach(function (quelle) {
    var werte = tabs[quelle.tab];
    if (!werte || !werte.length) throw new Error('Tab „' + quelle.tab + '“ fehlt oder ist leer.');
    var spalte = spaltenIndex(werte[0], quelle.tab);
    gelesen[quelle.tab] = 0;
    for (var i = 1; i < werte.length; i++) {
      if (istLeereZeile(werte[i])) continue;
      gelesen[quelle.tab]++;
      zeilen.push(ordneZu(quelle, werte[i], i + 1, spalte, konfig));
    }
  });

  // 4 Sperren – erst NACH dem Säubern abgleichen
  // Object.create(null): kein geerbter Schlüssel wie „constructor“ kann versehentlich als Treffer zählen
  var sperrEmails = Object.create(null), sperrNamen = Object.create(null);
  var sperrWerte = tabs[konfig.sperrliste.tab];
  if (!sperrWerte || !sperrWerte.length) {
    // Ohne Sperrliste würden gesperrte Personen unbemerkt in „Sauber“ landen – lieber abbrechen.
    throw new Error('Tab „' + konfig.sperrliste.tab + '“ fehlt oder hat keine Kopfzeile. ' +
                    'Ohne Sperrliste wird nicht bereinigt (eine leere Liste mit Kopfzeile ist erlaubt).');
  }
  var sp = spaltenIndex(sperrWerte[0], konfig.sperrliste.tab);
  sperrWerte.slice(1).forEach(function (z) {
    var e = saeubereEmail(z[sp(konfig.sperrliste.felder.email)]);
    var seit = konfig.sperrliste.felder.datum ? normalisiereDatum(z[sp(konfig.sperrliste.felder.datum)]) : '';
    if (e) sperrEmails[e] = { seit: seit };
    var n = teileName(z[sp(konfig.sperrliste.felder.name)], konfig);
    var key = namensSchluessel(n.vorname, n.nachname);
    if (key) sperrNamen[key] = true;
  });
  zeilen.forEach(function (z) {
    if (z.gesperrtDurchQuelle && z.email && !sperrEmails[z.email]) sperrEmails[z.email] = { seit: '' }; // Datum der Abmeldung unbekannt
  });

  var datumUnlesbar = zeilen.filter(function (z) { return z.datumUnlesbar; }).length;

  // Auswertung je Quelle: wohin ist jede Zeile gegangen?
  var jeQuelle = {};
  konfig.quellen.forEach(function (q) { jeQuelle[q.tab] = { sauber: 0, pruefen: 0, gesperrt: 0 }; });

  var gesperrt = 0;
  zeilen = zeilen.filter(function (z) {
    var sperre = z.email ? sperrEmails[z.email] : null;
    if (!z.gesperrtDurchQuelle && !sperre) return true;
    // Ausnahme: Die Person hat sich NACH dem Widerspruch selbst gemeldet (z. B. Kontaktformular).
    // Diese Anfrage darf nicht still verschwinden – ein Mensch entscheidet. Im Zweifel (Datum fehlt) ebenfalls.
    if (!z.gesperrtDurchQuelle && z.aktiveAnfrage && (!sperre.seit || !z.datum || z.datum >= sperre.seit)) {
      z.anfrageTrotzSperre = 'Gesperrt, aber neue Anfrage (Widerspruch ' + (sperre.seit ? 'am ' + sperre.seit : 'ohne Datum') + ')';
      return true;
    }
    gesperrt++;
    jeQuelle[z.tab].gesperrt++;
    return false;
  });

  // 5 Zusammenführen: gleiche gültige E-Mail = eine Person
  var gruppen = Object.create(null), reihenfolge = [], datensaetze = [];
  zeilen.forEach(function (z) {
    if (z.emailGueltig) {
      if (!gruppen[z.email]) { gruppen[z.email] = []; reihenfolge.push(z.email); }
      gruppen[z.email].push(z);
    } else {
      datensaetze.push(fuehreZusammen([z], konfig)); // ohne gültige E-Mail: nie zusammenführen
    }
  });
  reihenfolge.forEach(function (email) {
    teileNachPerson(gruppen[email]).forEach(function (teil) {
      datensaetze.push(fuehreZusammen(teil.zeilen, konfig, teil.grund));
    });
  });

  // 6 Prüfen über Datensätze hinweg: mögliche Duplikate, Name auf Sperrliste
  var nachPerson = Object.create(null);
  datensaetze.forEach(function (d) {
    var key = namensSchluessel(d.vorname, d.nachname);
    if (!key) return;
    key += '|' + firmenSchluessel(d.firma, konfig);
    (nachPerson[key] = nachPerson[key] || []).push(d);
  });
  Object.keys(nachPerson).forEach(function (key) {
    var liste = nachPerson[key];
    if (liste.length < 2) return;
    liste.forEach(function (d) {
      var andere = liste.filter(function (x) { return x !== d && x.emailGueltig && x.email !== d.email; })
        .map(function (x) { return x.email; });
      if (!andere.length) return;
      // Zwei gültige Adressen: beide prüfen. Sonst bekommt nur die Zeile ohne gültige E-Mail den Hinweis.
      d.gruende.push('Mögliches Duplikat zu ' + andere.join(', '));
    });
  });
  datensaetze.forEach(function (d) {
    if (d.anfrageTrotzSperre) return; // steht schon mit eigenem Grund auf Prüfen
    if (sperrNamen[namensSchluessel(d.vorname, d.nachname)]) d.gruende.push('Name auf Sperrliste');
  });

  // 7 Ergebnis
  var sauber = [], pruefen = [];
  datensaetze.forEach(function (d) { (d.gruende.length ? pruefen : sauber).push(d); });
  sauber.sort(function (a, b) { return a.email < b.email ? -1 : a.email > b.email ? 1 : 0; });
  pruefen.forEach(function (d) { d.grund = d.gruende.join('; '); });
  pruefen.sort(function (a, b) {
    return a.grund < b.grund ? -1 : a.grund > b.grund ? 1 : (a.quellen < b.quellen ? -1 : 1);
  });

  sauber.forEach(function (d) { d.tabs.forEach(function (t) { jeQuelle[t].sauber++; }); });
  pruefen.forEach(function (d) { d.tabs.forEach(function (t) { jeQuelle[t].pruefen++; }); });
  var gruendeZaehler = {};
  pruefen.forEach(function (d) {
    d.gruende.forEach(function (g) {
      var kurz = g.replace(/ \(.*$/, '').replace(/ zu .*$/, ''); // ohne Details in Klammern
      gruendeZaehler[kurz] = (gruendeZaehler[kurz] || 0) + 1;
    });
  });

  var fundstellen = function (liste) { return liste.reduce(function (s, d) { return s + d.anzahlQuellen; }, 0); };
  var summeGelesen = Object.keys(gelesen).reduce(function (s, k) { return s + gelesen[k]; }, 0);
  var protokoll = {
    gelesen: gelesen,
    summeGelesen: summeGelesen,
    gesperrt: gesperrt,
    datumUnlesbar: datumUnlesbar,
    jeQuelle: jeQuelle,
    gruende: gruendeZaehler,
    sauber: sauber.length,
    sauberFundstellen: fundstellen(sauber),
    pruefen: pruefen.length,
    pruefenFundstellen: fundstellen(pruefen),
    zusammengefuehrt: fundstellen(sauber) + fundstellen(pruefen) - sauber.length - pruefen.length
  };
  protokoll.bilanzOk = summeGelesen === protokoll.sauberFundstellen + protokoll.pruefenFundstellen + gesperrt;

  return {
    sauber: sauber.map(function (d) { return ZIEL_SPALTEN.map(function (s) { return d[s]; }); }),
    pruefen: pruefen.map(function (d) { return PRUEF_SPALTEN.map(function (s) { return d[s]; }); }),
    protokoll: protokoll
  };
}

/**
 * Eine E-Mail, mehrere Personen (z. B. praxis@… für Anna und Andreas): niemand darf verschwinden.
 * Unterscheiden sich die Vornamen, entsteht je Vorname ein eigener Datensatz – beide gehen auf „Prüfen“,
 * denn die Maschine kann „zwei Personen“ nicht von „Tom / Thomas“ unterscheiden.
 * Zeilen ohne Vorname bleiben bei der ersten Person (höchste Priorität).
 */
function teileNachPerson(gruppe) {
  var sortiert = gruppe.slice().sort(function (a, b) { return a.prioritaet - b.prioritaet || a.zeilenNr - b.zeilenNr; });
  var schluessel = [], teile = Object.create(null), anzeige = [];
  sortiert.forEach(function (z) {
    var key = vergleichsform(z.vorname);
    if (key && !teile[key]) { teile[key] = []; schluessel.push(key); anzeige.push(z.vorname); }
  });
  if (schluessel.length < 2) return [{ zeilen: gruppe, grund: '' }];
  sortiert.forEach(function (z) { teile[vergleichsform(z.vorname) || schluessel[0]].push(z); });
  var grund = 'Gleiche E-Mail, verschiedene Vornamen (' + anzeige.join(' / ') + ')';
  return schluessel.map(function (key) { return { zeilen: teile[key], grund: grund }; });
}

/** Mehrere Zeilen einer Person -> ein Datensatz. Lücken werden aus anderen Quellen gefüllt (nach Priorität). */
function fuehreZusammen(gruppe, konfig, zusatzGrund) {
  var z = gruppe.slice().sort(function (a, b) { return a.prioritaet - b.prioritaet || a.zeilenNr - b.zeilenNr; });
  var erster = function (feld) {
    for (var i = 0; i < z.length; i++) if (z[i][feld]) return z[i][feld];
    return '';
  };
  var gruende = [];
  var email = z[0].email;
  var anfrageTrotzSperre = '';
  z.forEach(function (x) { if (x.anfrageTrotzSperre) anfrageTrotzSperre = x.anfrageTrotzSperre; });
  if (anfrageTrotzSperre) gruende.push(anfrageTrotzSperre);
  if (zusatzGrund) gruende.push(zusatzGrund);

  if (!email) gruende.push('E-Mail fehlt');
  else if (!z[0].emailGueltig) gruende.push('E-Mail ungültig');
  else if (istRollenadresse(email, konfig)) gruende.push('Rollenadresse');

  var vorname = erster('vorname');
  if (!vorname) gruende.push('Vorname fehlt');

  z.forEach(function (x) {
    if (x.namensproblem && gruende.indexOf(x.namensproblem) === -1) gruende.push(x.namensproblem);
  });

  var nachnamen = {}, nachnamenAnzeige = [];
  z.forEach(function (x) {
    var key = vergleichsform(x.nachname);
    if (key && !nachnamen[key]) { nachnamen[key] = true; nachnamenAnzeige.push(x.nachname); }
  });
  if (nachnamenAnzeige.length > 1) gruende.push('Nachname weicht ab (' + nachnamenAnzeige.join(' / ') + ')');

  var telefon = '', unlesbar = '';
  z.forEach(function (x) {
    if (x.telefon.lesbar && x.telefon.wert && !telefon) telefon = x.telefon.wert;
    if (!x.telefon.lesbar && !unlesbar) unlesbar = x.telefon.wert;
  });
  if (!telefon && unlesbar) { telefon = unlesbar; gruende.push('Telefon nicht lesbar'); }

  var daten = z.map(function (x) { return x.datum; }).filter(Boolean).sort();

  var quellen = gruppe.slice().sort(function (a, b) { return a.prioritaet - b.prioritaet || a.zeilenNr - b.zeilenNr; })
    .map(function (x) { return x.fundstelle; });

  return {
    email: email,
    emailGueltig: z[0].emailGueltig,
    vorname: vorname,
    nachname: erster('nachname'),
    firma: erster('firma'),
    telefon: telefon,
    erster_kontakt: daten[0] || '',
    quellen: quellen.join(', '),
    anzahlQuellen: quellen.length,
    tabs: z.map(function (x) { return x.tab; }),
    anfrageTrotzSperre: anfrageTrotzSperre,
    gruende: gruende
  };
}
