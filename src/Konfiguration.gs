// Version 1.3 (2026-11-10): Firmenname SICH Studio
/**
 * Konfiguration der Kontaktlisten-Bereinigung (SICH Studio)
 *
 * Neue Quelle anbinden = einen Eintrag in QUELLEN ergänzen. Der Code bleibt unverändert.
 * Felder je Quelle: Ziel-Feld -> Spaltenname im Tab.
 *   name     = Vor- und Nachname in EINER Zelle (wird automatisch geteilt)
 *   vorname / nachname = getrennte Spalten
 * prioritaet: 1 = zuverlässigste Quelle. Sie gewinnt, wenn Werte sich widersprechen.
 */
var KONFIG = {
  quellen: [
    {
      tab: 'Kontaktformular',
      prioritaet: 1, // Person tippt ihre Daten selbst ein
      aktiveAnfrage: true, // Person meldet sich von sich aus: Anfrage nach einem Widerspruch geht auf „Prüfen“
      felder: { email: 'E-Mail', vorname: 'Vorname', nachname: 'Nachname', firma: 'Firma', telefon: 'Telefon', datum: 'Eingang' }
    },
    {
      tab: 'Webinar',
      prioritaet: 2,
      felder: { email: 'E-Mail-Adresse', name: 'Teilnehmer', firma: 'Unternehmen', datum: 'Anmeldedatum' }
    },
    {
      tab: 'Newsletter',
      prioritaet: 3,
      felder: { email: 'E-Mail', vorname: 'Vorname', datum: 'Angemeldet am', status: 'Status' },
      gesperrtWenn: { feld: 'status', wert: 'abgemeldet' } // Abmeldung = Widerspruch gegen Werbung
    },
    {
      tab: 'Messe',
      prioritaet: 4, // Visitenkarten, abgetippt – am fehleranfälligsten
      felder: { email: 'Mail', name: 'Name', firma: 'Firma', telefon: 'Tel.', datum: 'Datum' }
    }
  ],

  sperrliste: { tab: 'Sperrliste', felder: { email: 'E-Mail', name: 'Name', datum: 'Widerspruch am' } },

  ausgabe: { sauber: 'Sauber', pruefen: 'Prüfen', protokoll: 'Protokoll' },

  // Adressen ohne Ansprechperson
  rollenadressen: ['info', 'kontakt', 'contact', 'office', 'service', 'mail', 'hallo', 'hello', 'team',
                   'vertrieb', 'sales', 'buero', 'post', 'empfang', 'verwaltung', 'anfrage', 'support'],

  // Titel im Namen -> ein Mensch entscheidet über die Anrede
  titel: ['dr.', 'dr', 'prof.', 'prof', 'dipl.-ing.', 'dipl.', 'mag.', 'ing.'],

  // Namenszusätze: bleiben klein und gehören zum Nachnamen
  namenszusaetze: ['von', 'van', 'de', 'der', 'den', 'dem', 'vom', 'zu', 'zum', 'zur', 'la', 'le', 'di', 'da', 'del', 'ten', 'ter'],

  // Rechtsformen werden beim Firmenvergleich ignoriert („Havelkontor Logistik“ = „Havelkontor Logistik GmbH“)
  rechtsformen: ['gmbh', 'ggmbh', 'mbh', 'ug', 'haftungsbeschraenkt', 'ag', 'kg', 'ohg', 'gbr', 'ek', 'ev',
                 'partg', 'partgmbb', 'se', 'co', 'und', 'gmbh&co', 'kgaa'],

  telefon: { laendervorwahl: '49', minZiffern: 10, maxZiffern: 15 },

  // Annahmen für das Rechenbeispiel „Gesparte Zeit“ im Cockpit – bitte an den eigenen Betrieb anpassen
  cockpit: { minutenJeZeileVonHand: 2, minutenJePruefDatensatz: 3, stundensatz: 100, wochenstunden: 38 }
};
