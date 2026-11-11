# Fachkonzept: Kontaktlisten-Bereinigung für SICH Studio

Version 1.5 · 11.11.2026

> **Hinweis:** Demo-Projekt: SICH Studio ist ein Modellunternehmen. Alle Personen, Firmen, E-Mail-Adressen und Telefonnummern im Projekt sind synthetische Testdaten. Alle Domains enden auf `.example` – diese Endung existiert im Internet absichtlich nicht.

## 1. Ausgangslage

SICH Studio berät kleine und mittlere Unternehmen bei der Automatisierung von Geschäftsprozessen. Neue Kontakte kommen über vier Wege herein. Jede Liste wird von einer anderen Person oder einem anderen Tool gepflegt:

| Quelle | Herkunft | Zeilen | Typische Probleme |
|---|---|---|---|
| **Kontaktformular** | Export der Website | 45 | GROSS/klein, Leerzeichen, unsichtbare Zeichen aus Copy & Paste, Doppel-Absendung |
| **Webinar** | Anmelde-Tool „KI im Backoffice“ | 40 | Name in einer Zelle („Seidel, Bettina“), Datum als echtes Datum oder Excel-Zahl |
| **Messe** | Visitenkarten, abgetippt | 35 | Tippfehler, „(at)“, fehlende Mail, „ue“ statt „ü“, gekürzte Firmennamen |
| **Newsletter** | Export des Newsletter-Tools | 30 | Nur E-Mail und Vorname, Status „abgemeldet“ |

Dazu kommt eine **Sperrliste**: Personen, die der Nutzung ihrer Daten für Werbung widersprochen haben (Art. 21 Abs. 3 DSGVO).

**Ziel:** Ein Klick in Google Sheets erzeugt aus 150 Rohzeilen eine saubere, duplikatfreie Kontaktliste. Alles, was eine Maschine nicht sicher entscheiden kann, landet mit Begründung auf einer Prüf-Liste. Gesperrte Personen erscheinen nirgends.

**Leitsatz:** *Die Maschine säubert. Der Mensch entscheidet.*

## 2. Ergebnis

Das Skript schreibt vier Tabs (dazu bei Bedarf ein Archiv). Die Quell-Tabs bleiben unverändert.

| Tab | Inhalt |
|---|---|
| **Sauber** | Ein Datensatz pro Person, sofort nutzbar |
| **Prüfen** | Unklare Datensätze mit Spalte `grund` – ein Mensch entscheidet und trägt das in `entscheidung` / `notiz` ein |
| **Protokoll** | Zeitpunkt, Zeilen je Quelle, Ergebnis, Bilanz-Prüfung |
| **Kontrolle** | Gegenprobe mit Tabellenformeln: Google Sheets zählt selbst nach (siehe 3.9) |
| **Entscheidungen-Archiv** | Entstehen nur bei Bedarf: Entscheidungen, deren Datensatz nicht mehr auf „Prüfen“ steht |

**Ziel-Schema** (Spaltennamen klein, ohne Umlaute, ohne Leerzeichen):

| Spalte | Bedeutung |
|---|---|
| `email` | Schlüssel – daran wird jede Person erkannt |
| `vorname` | Pflicht |
| `nachname` | optional (Newsletter liefert keinen) |
| `firma` | optional (Freiberufliche) |
| `telefon` | optional, einheitlich `+49…` |
| `erster_kontakt` | frühestes Datum über alle Quellen, `JJJJ-MM-TT` |
| `quellen` | Fundstellen, z. B. `Kontaktformular-12, Messe-4` (Tab + Zeilennummer) |

Der Tab **Prüfen** hat zusätzlich vorne die Spalte `grund` und hinten die Spalten `entscheidung` (Auswahlliste: erledigt, in Arbeit, Quelle korrigieren, verwerfen; freier Text erlaubt) und `notiz`. Diese beiden Spalten füllt nur ein Mensch.

Bewusst **nicht** übernommen (Datenminimierung): Anfrage-ID, Nachricht, Notiz, Teilgenommen, Status.

## 3. Ablauf

```
Lesen → Zuordnen → Säubern → Sperren → Zusammenführen → Prüfen → Schreiben → Protokoll
```

### 3.1 Lesen
Alle Quell-Tabs und die Sperrliste werden gelesen. Leere Zeilen werden ignoriert. Die Anzahl gelesener Zeilen je Quelle wird gemerkt (Bilanz, siehe 3.8).

### 3.2 Zuordnen (Mapping)
Die Zuordnung ist **Konfiguration, kein Code**. Eine neue Quelle = ein neuer Eintrag.

| Ziel | Kontaktformular | Webinar | Messe | Newsletter |
|---|---|---|---|---|
| email | E-Mail | E-Mail-Adresse | Mail | E-Mail |
| vorname / nachname | Vorname / Nachname | Teilnehmer *(eine Zelle)* | Name *(eine Zelle)* | Vorname / – |
| firma | Firma | Unternehmen | Firma | – |
| telefon | Telefon | – | Tel. | – |
| datum | Eingang | Anmeldedatum | Datum | Angemeldet am |

**Priorität** bei widersprüchlichen Werten (wer hat die Daten am zuverlässigsten erfasst?):
Kontaktformular (Person tippt selbst) → Webinar → Newsletter → Messe (abgetippt).

### 3.3 Säubern – das macht die Maschine

| Regel | Beispiel |
|---|---|
| Unsichtbare Zeichen entfernen (Zero-Width-Space, BOM) | `katrin​@…` → `katrin@…` |
| Geschütztes Leerzeichen → normales Leerzeichen | |
| Leerzeichen vorne/hinten weg, doppelte innen → eins | `PETRA  SCHMITT` → `PETRA SCHMITT` |
| E-Mail klein | `J.NEUMANN@…` → `j.neumann@…` |
| Name nur GROSS oder nur klein → Groß-/Kleinschreibung | `PETRA SCHMITT` → `Petra Schmitt`, `franziska meyer-albrecht` → `Franziska Meyer-Albrecht` |
| Namenszusätze bleiben klein | `von der Heide` |
| Name in einer Zelle teilen: 2 Wörter | `Katrin Hartmann` → Katrin / Hartmann |
| … „Nachname, Vorname“ | `Seidel, Bettina` → Bettina / Seidel |
| … Zusatz „von/van/de/zu“ | `Henrik von der Heide` → Henrik / von der Heide |
| … nur 1 Wort → Nachname | `Krause` → – / Krause |
| Telefon → `+49…` | `030/2312…`, `0049 30 …`, `+49 (0)30 …` → `+4930…` |
| Datum → `JJJJ-MM-TT` | `8.10.26`, `08.10.2026`, `2026-10-05 18:22`, Datumszelle, Excel-Zahl `46280` |

**Was die Maschine bewusst *nicht* tut:** „ue“ in „ü“ umwandeln (`Michael` ≠ `Michäl`), `(at)` reparieren, Titel deuten, Doppelvornamen raten.

### 3.4 Sperren (DSGVO)
Gesperrt ist jede E-Mail aus der **Sperrliste** und jede im Newsletter mit Status **abgemeldet**. Der Abgleich passiert **nach** dem Säubern – sonst rutscht `MARKUS…@` an `markus…@` vorbei.

Fehlt der Tab **Sperrliste**, bricht der Lauf ab – ohne Sperrliste würden gesperrte Personen unbemerkt in „Sauber“ landen. Eine leere Liste mit Kopfzeile ist erlaubt.

**Ausnahme – neue Anfrage nach dem Widerspruch:** Meldet sich eine gesperrte Person später selbst über das Kontaktformular (Datum der Anfrage ≥ Datum des Widerspruchs, oder ein Datum fehlt), geht diese Anfrage auf **Prüfen**. Sie darf nicht still verschwinden: Eine Anfrage zu beantworten ist keine Werbung. Ihre übrigen Zeilen (Messe, Newsletter …) bleiben gesperrt.

Alle anderen gesperrten Zeilen werden aus **allen** Quellen entfernt und **nirgends** ausgegeben, nur im Protokoll gezählt.

### 3.5 Zusammenführen (Duplikate)
Zeilen mit gültiger, gleicher E-Mail werden zu einem Datensatz. Leere Felder werden aus anderen Quellen ergänzt (Priorität 3.2). `quellen` listet alle Fundstellen, `erster_kontakt` ist das früheste Datum.

Zeilen ohne gültige E-Mail werden nicht zusammengeführt – sie gehen einzeln auf die Prüf-Liste.

### 3.6 Prüfen – hier entscheidet ein Mensch

Ein Datensatz kommt auf **Prüfen**, wenn mindestens ein Grund zutrifft. Mehrere Gründe werden mit `;` verbunden.

| Grund | Auslöser |
|---|---|
| `E-Mail fehlt` | leer |
| `E-Mail ungültig` | kein gültiges Format, z. B. `(at)`, Leerzeichen innen, Domain ohne Endung |
| `Rollenadresse` | `info@`, `kontakt@`, `office@`, `service@` … – keine Ansprechperson |
| `Vorname fehlt` | auch nach dem Ergänzen aus anderen Quellen leer |
| `Name nicht eindeutig` | 3+ Wörter ohne Namenszusatz, z. B. Doppelvorname `Anna Lena Vogt` |
| `Titel im Namen` | `Dr.`, `Prof.` … |
| `Gesperrt, aber neue Anfrage` | Person steht auf der Sperrliste, hat sich danach aber selbst über das Kontaktformular gemeldet |
| `Gleiche E-Mail, verschiedene Vornamen` | eine Adresse, mehrere Personen (z. B. `praxis@…` für Anna und Andreas). Es entsteht **je Person ein Datensatz**, niemand geht verloren. `Jörg`/`Joerg` zählt als dieselbe Person |
| `Nachname weicht ab` | gleiche E-Mail, verschiedene Nachnamen (z. B. nach Heirat). `Moeller`/`Möller` zählt **nicht** als Abweichung |
| `Telefon nicht lesbar` | keine gültige Nummer in irgendeiner Quelle, z. B. `040 / 12`, `siehe Website` |
| `Mögliches Duplikat zu …` | gleicher Name + gleiche Firma, aber andere E-Mail (Firma ohne Rechtsform verglichen). Bei zwei gültigen Adressen kommen **beide** auf Prüfen; fehlt einer Zeile die E-Mail, bekommt nur sie den Hinweis |
| `Name auf Sperrliste` | Name steht auf der Sperrliste, E-Mail aber nicht – vielleicht dieselbe Person mit neuer/kaputter Adresse |

### 3.7 Schreiben
`Sauber` und `Prüfen` werden bei jedem Lauf **komplett neu** geschrieben (idempotent: zweimal klicken = gleiches Ergebnis). Sortierung: `Sauber` nach E-Mail, `Prüfen` nach Grund.

**Entscheidungen bleiben erhalten.** Vor dem Schreiben liest das Skript `entscheidung` und `notiz` aus dem bisherigen Tab **Prüfen** und schreibt sie wieder zum selben Datensatz. Schlüssel ist die Spalte `quellen` (Tab + Zeilennummer, z. B. `Messe-4`): gleiche Fundstellen = derselbe Datensatz. Findet eine Entscheidung keinen Datensatz mehr – etwa weil die Quelle korrigiert wurde und die Person jetzt auf **Sauber** steht –, wird sie mit Datum an den Tab **Entscheidungen-Archiv** angehängt. Eine Entscheidung verschwindet nie still. Das Protokoll nennt, wie viele Entscheidungen übernommen und archiviert wurden.

Die Entscheidung wird **nicht ausgewertet**: Ein „erledigt“ verschiebt nichts nach **Sauber**. Was mit dem Datensatz passiert, bleibt Sache des Menschen.

Grenze: Werden in einem Quell-Tab Zeilen eingefügt, gelöscht oder umsortiert, ändern sich die Zeilennummern. Die Entscheidung landet dann im Archiv statt beim Datensatz.

**Problemzelle markiert.** Auf **Prüfen** wird die Zelle, die den Grund auslöst, hellgelb (`#FFF2CC`), z. B. `email` bei „E-Mail ungültig“, `telefon` bei „Telefon nicht lesbar“. Die Zuordnung Grund → Spalten steht in der Konfiguration.

### 3.8 Protokoll und Bilanz
Jeder Lauf hängt eine Zeile an: Zeitpunkt, gelesene Zeilen je Quelle, gesperrte Zeilen, Datensätze in Sauber/Prüfen, Bilanz.

**Bilanz:** `gelesene Zeilen = Fundstellen in Sauber + Fundstellen in Prüfen + gesperrte Zeilen`. Geht keine Zeile verloren, steht dort **OK**, sonst **FEHLER** und ein Hinweis-Fenster.

> Hintergrund: 2020 verlor die englische Gesundheitsbehörde 15.841 Corona-Fälle, weil eine Datei stillschweigend Zeilen abschnitt. Eine Bilanz hätte es sofort gezeigt.

### 3.9 Kontrolle (Gegenprobe mit Formeln)
Die Bilanz in 3.8 rechnet das Skript selbst – es prüft sich also selbst. Der Tab **Kontrolle** prüft unabhängig davon: Formeln zählen direkt in den Tabs nach.

| Spalte | Formel |
|---|---|
| gelesen | nicht-leere Zeilen im Quell-Tab (`BYROW` + `TEXTJOIN`) |
| in Sauber / in Prüfen | Vorkommen von `Quelle-` in der Spalte `quellen` (`SUBSTITUTE`, `LEN`) |
| gesperrt | Rest: gelesen − in Sauber − in Prüfen |
| Kennzahlen | Datensätze in Sauber / Prüfen (`COUNTA`), zusammengeführte Zeilen |

Daneben stehen die Zahlen des Skripts aus dem letzten Lauf. Jede Zeile zeigt ✓ oder ✗, unten steht **OK** oder **ABWEICHUNG**. Ein ✗ entsteht, wenn jemand **Sauber** oder **Prüfen** später von Hand ändert oder beim Schreiben etwas verloren geht.

Die Formeln werden vom Skript in englischer Schreibweise gesetzt (`setFormula`); Google Sheets zeigt sie in der Sprache der Tabelle an.

## 4. Bedienung
- Menü **Datenpflege → Kontaktlisten bereinigen** in Google Sheets.
- Optional: zeitgesteuerter Trigger (z. B. täglich 7 Uhr).

## 5. Abgrenzung
- Keine KI im Kern: Regeln sind nachvollziehbar und prüfbar. (Möglicher Ausbau: Gemini schlägt für Zeilen auf **Prüfen** eine Lösung vor – die Entscheidung bleibt beim Menschen.)
- Kein Versand von E-Mails, kein Schreiben in ein CRM.
- Die Quell-Tabs werden nie verändert.

## 6. Abnahme
- Alle 23 Sonderfälle in `tests/sonderfaelle.json` verhalten sich wie erwartet.
- Bilanz = OK.
- Zweiter Lauf liefert identisches Ergebnis; Einträge in `entscheidung` / `notiz` bleiben erhalten.
- Tab **Kontrolle**: alle Zeilen ✓, Ergebnis **OK**.
