# Operation

## Privacy by design

- The script removes blocked rows from **all** sources and writes them to no tab. The log shows only their number.
- The cockpit reads only stored key figures, never the spreadsheet. It contains no names or addresses, so the link can be shared.
- The manifest limits the script to **this one spreadsheet** (`spreadsheets.currentonly`) instead of all files in Drive.
- The script writes text from a public form that starts with `=` as text and never executes it as a formula.
- Columns that are not needed (message, note, attendance) are not carried over.

## Cockpit

`Datenpflege → Cockpit anzeigen` opens the dashboard inside the spreadsheet. Deployed as a web app (`Bereitstellen → Web-App`), the same page has its own link: **[live cockpit](https://script.google.com/macros/s/AKfycbxigPIFfsmDxaRsgpY2GTBQPTFU-wtq3qKxddGltTRqq5-TF2dZNikwP52lejOiaifE/exec)**. It shows the figures of the last run:

- key figures and balance status;
- the flow of rows from each source to *Sauber*, *Prüfen* and *Gesperrt*;
- the share of rows per source that needs a human decision (trade-fair cards cause the most work, 20 %);
- data protection: blocked rows, the blocked person caught by name, enquiries that were kept;
- reasons on the review list;
- **time saved per run**, as a worked example.

The time saved uses stated assumptions from the configuration, shown in a footnote: 2 minutes per row by hand, 3 minutes per remaining review case, 100 € per hour, a 38-hour week. These values are assumptions, not measurements.

## Tests

The rules are pure functions without Google services ([`src/Bereinigung.gs`](../src/Bereinigung.gs)) and run locally in Node.

```bash
python3 tests/export_fixture.py   # workbook → tests/fixture.json
node tests/run-tests.js           # 128 checks: building blocks, 23 special cases, balance, second run
node tests/smoke-sheets.js        # menu, tabs, log and cockpit against a simulated SpreadsheetApp
```

[`tools/generate_testdaten.py`](../tools/generate_testdaten.py) generates the test data ([`daten/sich-studio-quelldaten.xlsx`](../daten/sich-studio-quelldaten.xlsx)) with a fixed seed. It contains 23 special cases; [`tests/sonderfaelle.json`](../tests/sonderfaelle.json) defines the expected outcome of each.

## Daily use

- **New rows:** append them at the bottom of the existing source tabs and run the menu item again. Every run reads all sources and rewrites *Sauber* and *Prüfen* completely.
- **A new trade fair:** append it to the tab *Messe*. A new tab and an entry in `Konfiguration.gs` are needed only if the columns differ or the cockpit should show the fair as its own source.
- **Corrections:** make them in the source tabs. The next run overwrites changes made directly in *Sauber* or *Prüfen*. After a corrected source row and a new run, the record moves from *Prüfen* to *Sauber* automatically.
- **Row order:** do not sort or delete rows inside a source tab. The column `quellen` refers to row numbers such as `Messe-12`.
- **Block list:** only add rows. If the tab is missing, the run stops.

## Limits

- **Review decisions depend on row numbers.** The script matches decisions by the column `quellen` (tab + row number). If rows in a source tab are inserted, deleted or re-sorted, the decision moves to the tab *Entscheidungen-Archiv* and needs to be re-assigned by hand.
- The rules are written for German names, phone numbers and date formats.
- The time saved is a worked example based on assumptions.
- The script produces only lists. It sends no e-mail and writes no data to a CRM.
- Two freelancers with the same name and no company both go to review. This cautious rule causes manual work on large lists.
- Tested in Google Sheets with 150 rows. In the local test, the rules process 15,000 rows in about half a second; the run time in Sheets for large lists is not measured yet.
