"""Exportiert die Quell-Tabs aus daten/sich-studio-quelldaten.xlsx nach tests/fixture.json –
im selben Format, das Apps Script mit getValues() liefert (leere Zelle = "", Datum = Datumsobjekt).
Aufruf: python3 tests/export_fixture.py
"""
import datetime as dt
import json
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parent.parent
wb = load_workbook(ROOT / "daten" / "sich-studio-quelldaten.xlsx")


def zelle(v):
    if v is None:
        return ""
    if isinstance(v, (dt.datetime, dt.date)):
        return {"$date": v.isoformat()}
    return v


tabs = {ws.title: [[zelle(c) for c in row] for row in ws.iter_rows(values_only=True)] for ws in wb}
(ROOT / "tests" / "fixture.json").write_text(json.dumps(tabs, ensure_ascii=False, indent=1), encoding="utf-8")
print({k: len(v) - 1 for k, v in tabs.items()})
