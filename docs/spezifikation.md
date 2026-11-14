# Fachkonzept: Kontaktlisten-Bereinigung für SICH Studio

Version 1.5.1 · 13.11.2026

> **Hinweis:** Demo-Projekt. SICH Studio ist ein Modellunternehmen. Alle Personen, Firmen, E-Mail-Adressen und Telefonnummern sind synthetische Testdaten. Alle Domains enden auf `.example`. Diese Endung existiert im Internet absichtlich nicht.

## 1. Ausgangslage

SICH Studio berät kleine und mittlere Unternehmen bei der Automatisierung von Geschäftsprozessen. Neue Kontakte kommen über vier Wege. Jede Liste pflegt eine andere Person oder ein anderes Tool:

| Quelle | Herkunft | Zeilen | Typische Probleme |
|---|---|---|---|
| **Kontaktformular** | Export der Website | 45 | GROSS/klein, Leerzeichen, unsichtbare Zeichen aus Copy & Paste, Doppel-Absendung |
| **Webinar** | Anmelde-Tool „KI im Backoffice“ | 40 | Name in einer Zelle („Seidel, Bettina“), Datum als echtes Datum oder Excel-Zahl |
| **Messe** | Visitenkarten, abgetippt | 35 | Tippfehler, „(at)“, fehlende Mail, „ue“ statt „ü“, gekürzte Firmennamen |
| **Newsletter** | Export des Newsletter-Tools | 30 | Nur E-Mail und Vorname, Status „abgemeldet“ |

Dazu kommt eine **Sperrliste**. Sie enthält Personen, die der Nutzung ihrer Daten für Werbung widersprochen haben (Art. 21 Abs. 3 DSGVO).

**Ziel:** Ein Klick in Google Sheets erzeugt aus 150 Rohzeilen eine saubere Kontaktliste ohne Duplikate. Fälle, die das Skript nicht sicher entscheiden kann, kommen mit Begründung auf eine Prüf-Liste. Gesperrte Personen erscheinen nirgends.

**Leitsatz:** *Die Maschine säubert. Der Mensch entscheidet.*

## 2. Ergebnis

Das Skript schreibt vier Tabs und bei Bedarf ein Archiv. Die Quell-Tabs bleiben unverändert.

| Tab | Inhalt |
|---|---|
| **Sauber** | Ein Datensatz pro Person, sofort nutzbar |
| **Prüfen** | Unklare Datensätze mit Spalte `grund`; ein Mensch entscheidet und trägt das Ergebnis in `entscheidung` / `notiz` ein |
| **Protokoll** | Zeitpunkt, Zeilen je Quelle, Ergebnis, Bilanz |
| **Kontrolle** | Gegenprobe mit Tabellenformeln, unabhängig vom Skript (siehe 3.9) |
| **Entscheidungen-Archiv** | Nur bei Bedarf: Entscheidungen, deren Datensatz nicht mehr auf „Prüfen“ steht |

**Ziel-Schema** (Spaltennamen klein, ohne Umlaute, ohne Leerzeichen):

| Spalte | Bedeutung |
|---|---|
| `email` | Schlüssel; das Skript erkennt jede Person an der E-Mail |
| `vorname` | Pflicht |
| `nachname` | optional (der Newsletter liefert keinen) |
| `firma` | optional (Freiberufliche) |
| `telefon` | optional, einheitlich `+49…` |
| `erster_kontakt` | frühestes Datum über alle Quellen, `JJJJ-MM-TT` |
| `quellen` | Fundstellen, z. B. `Kontaktformular-12, Messe-4` (Tab + Zeilennummer) |

Der Tab **Prüfen** hat vorne zusätzlich die Spalte `grund`. Hinten folgen `entscheidung` (Auswahlliste: erledigt, in Arbeit, Quelle korrigieren, verwerfen; freier Text erlaubt) und `notiz`. Diese beiden Spalten füllt nur ein Mensch.

Datenminimierung: Das Skript übernimmt Anfrage-ID, Nachricht, Notiz, Teilgenommen und Status bewusst **nicht**.

## 3. Ablauf

```
Lesen → Zuordnen → Säubern → Sperren → Zusammenführen → Prüfen → Schreiben → Protokoll
```

### 3.1 Lesen
Das Skript liest alle Quell-Tabs und die Sperrliste. Leere Zeilen ignoriert es. Die Anzahl gelesener Zeilen je Quelle speichert es für die Bilanz (siehe 3.8).

### 3.2 Zuordnen
Die Zuordnung steht in der **Konfiguration, nicht im Code**. Eine neue Quelle braucht einen neuen Eintrag.

| Ziel | Kontaktformular | Webinar | Messe | Newsletter |
|---|---|---|---|---|
| email | E-Mail | E-Mail-Adresse | Mail | E-Mail |
| vorname / nachname | Vorname / Nachname | Teilnehmer *(eine Zelle)* | Name *(eine Zelle)* | Vorname / – |
| firma | Firma | Unternehmen | Firma | – |
| telefon | Telefon | – | Tel. | – |
| datum | Eingang | Anmeldedatum | Datum | Angemeldet am |

**Priorität** bei widersprüchlichen Werten, nach Zuverlässigkeit der Erfassung:
Kontaktformular (die Person tippt selbst) → Webinar → Newsletter → Messe (abgetippt).

### 3.3 Säubern

| Regel | Beispiel |
|---|---|
| Unsichtbare Zeichen entfernen (Zero-Width-Space, BOM) | `katrin​@…` → `katrin@…` |
| Geschütztes Leerzeichen → normales Leerzeichen | |
| Leerzeichen vorne/hinten entfernen, doppelte innen → eins | `PETRA  SCHMITT` → `PETRA SCHMITT` |
| E-Mail klein | `J.NEUMANN@…` → `j.neumann@…` |
| Name nur GROSS oder nur klein → Groß-/Kleinschreibung | `PETRA SCHMITT` → `Petra Schmitt`, `franziska meyer-albrecht` → `Franziska Meyer-Albrecht` |
| Namenszusätze bleiben klein | `von der Heide` |
| Name in einer Zelle teilen: 2 Wörter | `Katrin Hartmann` → Katrin / Hartmann |
| … „Nachname, Vorname“ | `Seidel, Bettina` → Bettina / Seidel |
| … Zusatz „von/van/de/zu“ | `Henrik von der Heide` → Henrik / von der Heide |
| … nur 1 Wort → Nachname | `Krause` → – / Krause |
| Telefon → `+49…` | `030/2312…`, `0049 30 …`, `+49 (0)30 …` → `+4930…` |
| Datum → `JJJJ-MM-TT` | `8.10.26`, `08.10.2026`, `2026-10-05 18:22`, Datumszelle, Excel-Zahl `46280` |

**Bewusst nicht automatisiert:** „ue“ in „ü“ umwandeln (`Michael` ≠ `Michäl`), `(at)` reparieren, Titel deuten, Doppelvornamen raten.

### 3.4 Sperren (DSGVO)
Gesperrt ist jede E-Mail aus der **Sperrliste** und jede E-Mail mit Status **abgemeldet** im Newsletter. Das Skript gleicht **nach** dem Säubern ab. Sonst erkennt es `MARKUS…@` nicht als `markus…@`.

Fehlt der Tab **Sperrliste**, bricht der Lauf ab. Ohne Sperrliste kämen gesperrte Personen unbemerkt in „Sauber“. Eine leere Liste mit Kopfzeile ist erlaubt.

**Ausnahme: neue Anfrage nach dem Widerspruch.** Eine gesperrte Person meldet sich später selbst über das Kontaktformular. Das Datum der Anfrage liegt am oder nach dem Datum des Widerspruchs, oder ein Datum fehlt. Dann kommt diese Anfrage auf **Prüfen**, denn die Antwort auf eine Anfrage ist keine Werbung. Die übrigen Zeilen der Person (Messe, Newsletter …) bleiben gesperrt.

Alle anderen gesperrten Zeilen entfernt das Skript aus **allen** Quellen. Es gibt sie **nirgends** aus und zählt sie nur im Protokoll.

### 3.5 Zusammenführen (Duplikate)
Zeilen mit gültiger, gleicher E-Mail führt das Skript zu einem Datensatz zusammen. Leere Felder ergänzt es aus anderen Quellen (Priorität siehe 3.2). `quellen` listet alle Fundstellen, `erster_kontakt` enthält das früheste Datum.

Zeilen ohne gültige E-Mail führt das Skript nicht zusammen. Sie kommen einzeln auf die Prüf-Liste.

### 3.6 Prüfen
Ein Datensatz kommt auf **Prüfen**, wenn mindestens ein Grund zutrifft. Mehrere Gründe verbindet das Skript mit `;`.

| Grund | Auslöser |
|---|---|
| `E-Mail fehlt` | leer |
| `E-Mail ungültig` | kein gültiges Format, z. B. `(at)`, Leerzeichen innen, Domain ohne Endung |
| `Rollenadresse` | `info@`, `kontakt@`, `office@`, `service@` …; keine Ansprechperson |
| `Vorname fehlt` | auch nach dem Ergänzen aus anderen Quellen leer |
| `Name nicht eindeutig` | 3+ Wörter ohne Namenszusatz, z. B. Doppelvorname `Anna Lena Vogt` |
| `Titel im Namen` | `Dr.`, `Prof.` … |
| `Gesperrt, aber neue Anfrage` | Person steht auf der Sperrliste und hat sich danach selbst über das Kontaktformular gemeldet |
| `Gleiche E-Mail, verschiedene Vornamen` | eine Adresse, mehrere Personen (z. B. `praxis@…` für Anna und Andreas). Das Skript legt **je Person einen Datensatz** an. `Jörg`/`Joerg` gilt als dieselbe Person |
| `Nachname weicht ab` | gleiche E-Mail, verschiedene Nachnamen (z. B. nach Heirat). `Moeller`/`Möller` gilt **nicht** als Abweichung |
| `Telefon nicht lesbar` | keine gültige Nummer in irgendeiner Quelle, z. B. `040 / 12`, `siehe Website` |
| `Mögliches Duplikat zu …` | gleicher Name und gleiche Firma, aber andere E-Mail (Firma ohne Rechtsform verglichen). Bei zwei gültigen Adressen kommen **beide** auf Prüfen. Fehlt einer Zeile die E-Mail, erhält nur diese Zeile den Hinweis |
| `Name auf Sperrliste` | Name steht auf der Sperrliste, E-Mail aber nicht; möglicherweise dieselbe Person mit neuer oder fehlerhafter Adresse |

### 3.7 Schreiben
Das Skript schreibt `Sauber` und `Prüfen` bei jedem Lauf **komplett neu**. Ein zweiter Lauf liefert dasselbe Ergebnis (idempotent). Sortierung: `Sauber` nach E-Mail, `Prüfen` nach Grund.

**Entscheidungen bleiben erhalten.** Vor dem Schreiben liest das Skript `entscheidung` und `notiz` aus dem bisherigen Tab **Prüfen** und überträgt sie auf denselben Datensatz. Schlüssel ist die Spalte `quellen` (Tab + Zeilennummer, z. B. `Messe-4`). Gleiche Fundstellen bedeuten denselben Datensatz.

Findet das Skript zu einer Entscheidung keinen Datensatz mehr, hängt es die Entscheidung mit Datum an den Tab **Entscheidungen-Archiv** an. Das passiert zum Beispiel, wenn die Quelle korrigiert ist und die Person jetzt auf **Sauber** steht. Keine Entscheidung geht verloren. Das Protokoll nennt die Zahl übernommener und archivierter Entscheidungen.

Das Skript wertet die Entscheidung **nicht aus**. „erledigt“ verschiebt nichts nach **Sauber**. Über den Datensatz entscheidet der Mensch.

Grenze: Werden in einem Quell-Tab Zeilen eingefügt, gelöscht oder umsortiert, ändern sich die Zeilennummern. Die Entscheidung kommt dann ins Archiv statt zum Datensatz.

**Problemzelle markiert.** Auf **Prüfen** färbt das Skript die auslösende Zelle hellgelb (`#FFF2CC`), z. B. `email` bei „E-Mail ungültig“ und `telefon` bei „Telefon nicht lesbar“. Die Zuordnung Grund → Spalten steht in der Konfiguration.

### 3.8 Protokoll und Bilanz
Jeder Lauf hängt eine Zeile an: Zeitpunkt, gelesene Zeilen je Quelle, gesperrte Zeilen, Datensätze in Sauber und Prüfen, Bilanz.

**Bilanz:** `gelesene Zeilen = Fundstellen in Sauber + Fundstellen in Prüfen + gesperrte Zeilen`. Stimmt die Bilanz, steht dort **OK**. Sonst steht dort **FEHLER**, und ein Hinweis-Fenster erscheint.

### 3.9 Kontrolle (Gegenprobe mit Formeln)
Die Bilanz in 3.8 berechnet das Skript selbst. Der Tab **Kontrolle** prüft unabhängig davon: Formeln zählen direkt in den Tabs nach.

| Spalte | Formel |
|---|---|
| gelesen | nicht-leere Zeilen im Quell-Tab (`BYROW` + `TEXTJOIN`) |
| in Sauber / in Prüfen | Vorkommen von `Quelle-` in der Spalte `quellen` (`SUBSTITUTE`, `LEN`) |
| gesperrt | Rest: gelesen − in Sauber − in Prüfen |
| Kennzahlen | Datensätze in Sauber / Prüfen (`COUNTA`), zusammengeführte Zeilen |

Daneben stehen die Zahlen des Skripts aus dem letzten Lauf. Jede Zeile zeigt ✓ oder ✗, unten steht **OK** oder **ABWEICHUNG**. Ein ✗ erscheint, wenn jemand **Sauber** oder **Prüfen** später von Hand ändert oder beim Schreiben etwas verloren geht.

Das Skript setzt die Formeln in englischer Schreibweise (`setFormula`). Google Sheets zeigt sie in der Sprache der Tabelle an.

## 4. Bedienung
- Menü **Datenpflege → Kontaktlisten bereinigen** in Google Sheets.
- Optional: zeitgesteuerter Trigger (z. B. täglich 7 Uhr).

## 5. Abgrenzung
- Keine KI im Kern: Die Regeln sind nachvollziehbar und prüfbar. Möglicher Ausbau: Gemini schlägt für Zeilen auf **Prüfen** eine Lösung vor; die Entscheidung bleibt beim Menschen.
- Kein Versand von E-Mails, kein Schreiben in ein CRM.
- Das Skript verändert die Quell-Tabs nie.

## 6. Abnahme
- Alle 23 Sonderfälle in `tests/sonderfaelle.json` verhalten sich wie erwartet.
- Bilanz = OK.
- Ein zweiter Lauf liefert ein identisches Ergebnis; Einträge in `entscheidung` / `notiz` bleiben erhalten.
- Tab **Kontrolle**: alle Zeilen ✓, Ergebnis **OK**.
