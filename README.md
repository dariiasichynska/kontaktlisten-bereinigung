# Kontaktlisten-Bereinigung

A Google Apps Script that turns 150 messy contact rows from four sources into 96 clean contacts, a review list with a reason for every open case and a management cockpit.

**Live cockpit:** [open the web app](https://script.google.com/macros/s/AKfycbxigPIFfsmDxaRsgpY2GTBQPTFU-wtq3qKxddGltTRqq5-TF2dZNikwP52lejOiaifE/exec) (figures of the last run, no personal data)

![Kontaktdaten-Cockpit: key figures, row flow from four sources, data protection and time saved](docs/img/cockpit.png)

> Demo project: SICH Studio is a model company. All people, companies, e-mail addresses and phone numbers are synthetic test data; every domain ends in `.example`. The interface and the specification are in German, the language of the target users.

## What it does

One menu item in Google Sheets reads four source tabs and a block list without changing them and writes three tabs: *Sauber* (clean), *Prüfen* (review) and *Protokoll* (log).

| | |
|---|---|
| Rows read | **150** |
| Clean contacts, one per person | **96** |
| Duplicate rows merged | **29** (19 %) |
| Records for a human decision, each with a reason | **17** |
| Blocked rows, written nowhere | **8** |
| Balance check | **OK**: 150 = 124 + 18 + 8, no row lost |

The script removes invisible characters, normalises e-mails, names, phone numbers (E.164) and dates, and merges rows with the same e-mail. Unclear cases go to *Prüfen* with a plain reason; the script guesses no values. People who objected to advertising (Art. 21 GDPR) appear in no list. A separate tab *Kontrolle* recounts the result with spreadsheet formulas.

Principle: **the machine cleans, a human decides.**

## Why

SICH Studio collects contacts through a contact form, webinar registrations, typed-in trade-fair cards and a newsletter. Each list has its own errors, and the number of real contacts is unknown. Duplicate contacts and contacts of people who objected must be prevented.

## Status

Active. Version 1.5 runs in a real Google Sheet. Next steps: measure the run time with several thousand rows; provide a copy link to the spreadsheet.

## Set-up

1. Create a spreadsheet with `sheets.new`. Import `daten/sich-studio-quelldaten.xlsx` via `Datei → Importieren → Hochladen` (*Tabelle ersetzen*).
2. Under `Erweiterungen → Apps Script`, create the script files `Konfiguration`, `Bereinigung`, `Code` and the HTML file `Dashboard`, and paste the contents from [`src/`](src).
3. In the project settings, show `appsscript.json` in the editor and replace it with [`src/appsscript.json`](src/appsscript.json).
4. Reload the spreadsheet and run `Datenpflege → Kontaktlisten bereinigen`. Confirm the permissions once.
5. Open the cockpit with `Datenpflege → Cockpit anzeigen`.

Expected log line: `150 | 8 | 96 | 17 | 29 | OK`.

Run the tests locally:

```bash
python3 tests/export_fixture.py   # workbook → tests/fixture.json
node tests/run-tests.js           # 128 checks
node tests/smoke-sheets.js        # menu, tabs, log and cockpit against a simulated SpreadsheetApp
```

## Documentation

- [Specification](docs/spezifikation.md) (German): target schema, process, all rules
- [Rules](docs/rules.md): automatic fixes, review reasons, pitfalls, rules in code
- [Operation](docs/operations.md): privacy, cockpit, tests, daily use, limits
- [Project background](docs/project-background.md)
- [Changelog](CHANGELOG.md)

## License

[MIT](LICENSE) © 2026 Dariia Sichynska
