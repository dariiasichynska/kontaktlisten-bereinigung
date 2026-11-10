"""Erzeugt synthetische Testdaten für das Modellunternehmen SICH Studio (Beratung für Prozessautomatisierung).

Alle Personen, Firmen, E-Mail-Adressen und Telefonnummern sind erfunden.
Alle Domains enden auf .example (RFC 2606) – an diese Adressen geht nie eine Mail.

Aufruf:  python3 tools/generate_testdaten.py
Ergebnis: daten/sich-studio-quelldaten.xlsx  (reproduzierbar durch festen Seed)
"""
import datetime as dt
import random
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

SEED = 46
R = random.Random(SEED)
OUT = Path(__file__).resolve().parent.parent / "daten" / "sich-studio-quelldaten.xlsx"

VORNAMEN = """Anna Jürgen Thomas Lena Klaus Petra Michael Sabine Jonas Lisa Mehmet Sophie
Ole Katrin Stefan Julia Andreas Miriam Tobias Nina Florian Sandra Markus Carina Felix Heike
Daniel Svenja Sebastian Ines Patrick Yvonne Ralf Elif Timo Bettina Moritz Anja Kai Doreen
Lukas Gesa Björn Maren Jörg Tanja Henrik Ulrike Malte Franziska Dirk Nadine Jan Christina
Philipp Karin Leon Merle Uwe Greta""".split()

NACHNAMEN = """Berger Weiß Klein Fischer Meyer Weber Hoffmann Koch Wolf Brandt Yilmaz Lange
Hansen Schulz Wagner Becker Schäfer Krüger Neumann Schwarz Zimmermann Braun Hartmann Lehmann
Köhler Richter Jäger Groß Böhm Kaiser Fuchs Peters Möller Vogt Albrecht Busch Sommer Engel
Ludwig Seidel Kühn Franke Arnold Pohl Brinkmann Otto Kraus Günther Thiele Roth Simon Haas
Dietrich Winkler Lorenz Baumann Graf Krause Schmitt Stein""".split()

# (Firmenname, Domain, Vorwahl)
FIRMEN = [
    ("Krume Backwaren GmbH", "krume-backwaren", "30"),
    ("Havelkontor Logistik GmbH", "havelkontor", "331"),
    ("Spreeblick Hausverwaltung GmbH", "spreeblick-hv", "30"),
    ("Nordlicht Steuerberatung PartG", "nordlicht-stb", "40"),
    ("Kiezrad Berlin UG", "kiezrad", "30"),
    ("Brückner Elektrotechnik GmbH", "brueckner-et", "341"),
    ("Pixelgarten Agentur GmbH", "pixelgarten", "30"),
    ("Alpenweit Reisen GmbH", "alpenweit", "89"),
    ("Hafenmeister Gastro GmbH", "hafenmeister", "40"),
    ("Lindgrün Pflegedienst gGmbH", "lindgruen-pflege", "30"),
    ("Ostwind Solar GmbH", "ostwind-solar", "381"),
    ("Quadratmeter Immobilien GmbH", "quadratmeter", "221"),
    ("Tannenhof Möbelwerkstatt", "tannenhof-moebel", "761"),
    ("Kranich Versicherungsmakler GmbH", "kranich-makler", "69"),
    ("Mühlbach Druckerei GmbH", "muehlbach-druck", "711"),
    ("Sternwarte Kita gGmbH", "sternwarte-kita", "30"),
    ("Ziegelrot Architekten PartGmbB", "ziegelrot", "30"),
    ("Feldweg Bio-Hofladen", "feldweg-bio", "33"),
    ("Kupferkessel Brauerei GmbH", "kupferkessel", "911"),
    ("Datenhafen IT-Service GmbH", "datenhafen", "40"),
    ("Löwenzahn Zahnarztpraxis", "loewenzahn-praxis", "30"),
    ("Rheinblick Personalservice GmbH", "rheinblick-ps", "228"),
]
FREEMAIL = ["gmx", "web", "posteo", "t-online", "mail"]
MOBIL = ["151", "160", "170", "171", "176", "177", "152"]

SOURCES = ["Kontaktformular", "Webinar", "Messe", "Newsletter"]
TARGET_ROWS = {"Kontaktformular": 45, "Webinar": 40, "Messe": 35, "Newsletter": 30}


def translit(s):
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss"), ("Ä", "Ae"), ("Ö", "Oe"), ("Ü", "Ue")):
        s = s.replace(a, b)
    return s


def rand_date(start, end):
    d = (end - start).days
    return start + dt.timedelta(days=R.randint(0, d))


# ---------------------------------------------------------------- Personen
used_names = set()
used_emails = set()


def new_person(vorname=None, nachname=None, firma=None, email=None, freelancer=None, area=None, number=None):
    while vorname is None or nachname is None or (vorname, nachname) in used_names:
        vorname = vorname or R.choice(VORNAMEN)
        nachname = nachname or R.choice(NACHNAMEN)
        if (vorname, nachname) in used_names:
            vorname = nachname = None
    used_names.add((vorname, nachname))
    if freelancer is None:
        freelancer = R.random() < 0.2
    if firma == "":
        domain, vw = R.choice(FREEMAIL), R.choice(MOBIL)
    elif firma is None:
        if freelancer:
            firma, domain, vw = "", R.choice(FREEMAIL), R.choice(MOBIL)
        else:
            firma, domain, vw = R.choice(FIRMEN)
    else:
        domain = next(d for f, d, _ in FIRMEN if f == firma)
        vw = next(v for f, _, v in FIRMEN if f == firma)
    if email is None:
        v, n = translit(vorname).lower(), translit(nachname).lower()
        pattern = R.choice(["v.n", "v.n", "v.n", "vn", "x.n"])
        local = {"v.n": f"{v}.{n}", "vn": f"{v}{n}", "x.n": f"{v[0]}.{n}"}[pattern]
        email = f"{local}@{domain}.example"
    if email in used_emails:  # z. B. zwei „a.berger@…“ – neu würfeln
        used_names.discard((vorname, nachname))
        return new_person(firma=firma if firma else None, freelancer=freelancer)
    used_emails.add(email)
    area = area or vw
    number = number or str(R.randint(2000000, 9899999))
    return dict(vorname=vorname, nachname=nachname, firma=firma, email=email, area=area, number=number)


def phone_variant(p, style=None):
    a, n = p["area"], p["number"]
    style = style or R.choice(["plus", "null", "slash", "0049", "plus0", "dash", "plain"])
    return {
        "plus": f"+49 {a} {n}",
        "null": f"0{a} {n}",
        "slash": f"0{a}/{n}",
        "0049": f"0049 {a} {n}",
        "plus0": f"+49 (0){a} {n[:3]} {n[3:]}",
        "dash": f"0{a}-{n[:3]}-{n[3:]}",
        "plain": f"0{a}{n}",
    }[style]


# ---------------------------------------------------------------- Zeilen-Bausteine
def row_kontakt(p, chaos=True, **o):
    email = o.get("email", p["email"])
    if chaos and "email" not in o:
        r = R.random()
        if r < 0.12:
            email = email.upper()
        elif r < 0.22:
            email = email + " "
        elif r < 0.28:
            email = email[0].upper() + email[1:]
    return {
        "Anfrage-ID": None,  # wird beim Schreiben vergeben
        "Vorname": o.get("vorname", p["vorname"]),
        "Nachname": o.get("nachname", p["nachname"]),
        "Firma": o.get("firma", p["firma"]),
        "E-Mail": email,
        "Telefon": o.get("telefon", phone_variant(p) if R.random() < 0.8 else None),
        "Eingang": o.get("datum", rand_date(dt.date(2026, 1, 12), dt.date(2026, 10, 30)).isoformat()),
        "Nachricht": o.get("nachricht", R.choice([
            "Wir möchten unsere Rechnungsfreigabe automatisieren.",
            "Interesse an einem Erstgespräch zu n8n.",
            "Können Sie uns beim Onboarding neuer Mitarbeitender helfen?",
            "Bitte um Rückruf wegen Angebotsprozess.",
            "Wie läuft ein Prozess-Workshop bei Ihnen ab?",
            "Wir suchen Unterstützung bei der Datenpflege im CRM.",
            "Frage zu DSGVO bei automatisierten Newslettern.",
            None,
        ])),
    }


def name_variant(p, style=None):
    v, n = p["vorname"], p["nachname"]
    style = style or R.choice(["normal"] * 6 + ["komma", "lower", "upper"])
    return {
        "normal": f"{v} {n}",
        "komma": f"{n}, {v}",
        "lower": f"{v} {n}".lower(),
        "upper": f"{v} {n}".upper(),
    }[style]


def row_webinar(p, **o):
    email = o.get("email", p["email"])
    if "email" not in o and R.random() < 0.2:
        email = email[0].upper() + email[1:].replace(".", ".", 1)
        local, dom = email.split("@")
        email = local.title() + "@" + dom
    return {
        "Teilnehmer": o.get("name", name_variant(p)),
        "E-Mail-Adresse": email,
        "Unternehmen": o.get("firma", p["firma"]),
        "Anmeldedatum": o.get("datum", dt.datetime.combine(
            rand_date(dt.date(2026, 9, 1), dt.date(2026, 9, 23)), dt.time(R.randint(7, 21), R.choice([0, 15, 30, 45])))),
        "Teilgenommen": o.get("teilgenommen", R.choice(["ja", "ja", "nein"])),
    }


def messe_datum():
    d = R.choice([dt.date(2026, 10, 7), dt.date(2026, 10, 8)])
    return d.strftime("%d.%m.%Y") if R.random() < 0.7 else f"{d.day}.{d.month}.{d.strftime('%y')}"


def row_messe(p, **o):
    email = o.get("email", p["email"])
    if "email" not in o:
        r = R.random()
        if r < 0.15:
            email = " " + email + " "
        elif r < 0.25:
            email = email.upper()
        elif r < 0.30:
            email = email + " "  # geschütztes Leerzeichen (aus Word/Webseite kopiert)
    firma = o.get("firma", p["firma"])
    if "firma" not in o and firma and R.random() < 0.25:
        firma = firma.replace(" GmbH", "").replace(" gGmbH", "")  # auf der Visitenkarte gekürzt
    return {
        "Name": o.get("name", name_variant(p, R.choice(["normal"] * 5 + ["upper", "lower"]))),
        "Firma": firma,
        "Mail": email,
        "Tel.": o.get("telefon", phone_variant(p) if R.random() < 0.85 else None),
        "Notiz": o.get("notiz", R.choice([None, None, "will Angebot", "Rückruf KW 44", "Workshop?",
                                          "kennt n8n", "nur Infomaterial", "Visitenkarte", "sehr interessiert"])),
        "Datum": o.get("datum", messe_datum()),
    }


def row_newsletter(p, **o):
    email = o.get("email", p["email"])
    if "email" not in o and R.random() < 0.15:
        email = email.upper()
    ts = dt.datetime.combine(rand_date(dt.date(2025, 11, 1), dt.date(2026, 10, 31)),
                             dt.time(R.randint(6, 23), R.randint(0, 59)))
    return {
        "E-Mail": email,
        "Vorname": o.get("vorname", p["vorname"] if R.random() < 0.85 else None),
        "Angemeldet am": o.get("datum", ts.strftime("%Y-%m-%d %H:%M")),
        "Status": o.get("status", "aktiv"),
    }


BUILDERS = {"Kontaktformular": row_kontakt, "Webinar": row_webinar, "Messe": row_messe, "Newsletter": row_newsletter}

rows = {s: [] for s in SOURCES}
sperrliste = []


def add(src, row, case=None):
    rows[src].append((row, case))


# ---------------------------------------------------------------- Sonderfälle (bewusst gesetzt)
ZWSP = "​"

# S01 unsichtbares Zeichen (Zero-Width-Space) aus Copy&Paste – muss trotzdem als Duplikat erkannt werden
p = new_person("Katrin", "Hartmann", "Pixelgarten Agentur GmbH")
add("Kontaktformular", row_kontakt(p, email=p["email"].replace("@", ZWSP + "@")), "S01")
add("Webinar", row_webinar(p, name="Katrin Hartmann"), "S01")

# S02 Nachname-Konflikt bei gleicher E-Mail (Heirat) -> Prüfen
p = new_person("Julia", "Neumann", "Kranich Versicherungsmakler GmbH", email="j.neumann@kranich-makler.example")
add("Kontaktformular", row_kontakt(p, nachname="Krüger"), "S02")
add("Webinar", row_webinar(p, name="Julia Neumann"), "S02")

# S03 Umlaut-Schreibweise (ue/ü) bei gleicher E-Mail -> KEIN Konflikt, Sauber als „Müller“
p = new_person("Jörg", "Möller", "Mühlbach Druckerei GmbH")
add("Kontaktformular", row_kontakt(p), "S03")
add("Messe", row_messe(p, name="Joerg Moeller"), "S03")

# S04 gleiche Person, zwei E-Mails (Kurz- und Langform) -> beide Prüfen „mögliches Duplikat“
p = new_person("Jonas", "Wolf", "Datenhafen IT-Service GmbH", email="jonas.wolf@datenhafen.example")
add("Kontaktformular", row_kontakt(p), "S04")
add("Messe", row_messe(p, email="j.wolf@datenhafen.example", name="Jonas Wolf"), "S04")

# S05 Rollenadresse -> Prüfen
p = new_person("Heike", "Sommer", "Feldweg Bio-Hofladen", email="info@feldweg-bio.example")
add("Kontaktformular", row_kontakt(p), "S05")

# S06 (at) statt @ -> Prüfen
p = new_person("Tobias", "Engel", "Kiezrad Berlin UG")
add("Messe", row_messe(p, email=p["email"].replace("@", "(at)")), "S06")

# S07 Domain ohne Endung -> Prüfen
p = new_person("Lisa", "Brandt", "", email="lisa.brandt@web")
add("Messe", row_messe(p, email="lisa.brandt@web"), "S07")

# S08 Messe ohne E-Mail, aber Name+Firma passt zu sauberem Kontakt -> Prüfen mit Hinweis
p = new_person("Stefan", "Richter", "Havelkontor Logistik GmbH")
add("Kontaktformular", row_kontakt(p), "S08")
add("Messe", row_messe(p, email=None, name="Stefan Richter", firma="Havelkontor Logistik"), "S08")

# S09 Sperrliste: Person kommt in zwei Quellen vor (einmal in GROSS) -> überall raus
p = new_person("Markus", "Lehmann", "Quadratmeter Immobilien GmbH")
add("Kontaktformular", row_kontakt(p), "S09")
add("Messe", row_messe(p, email=p["email"].upper()), "S09")
sperrliste.append(dict(email=p["email"], name=f"{p['vorname']} {p['nachname']}", datum="2026-06-02", kanal="E-Mail an datenschutz@"))

# S10 Newsletter abgemeldet + im Webinar -> überall raus
p = new_person("Doreen", "Fuchs", "Lindgrün Pflegedienst gGmbH")
add("Newsletter", row_newsletter(p, status="abgemeldet"), "S10")
add("Webinar", row_webinar(p), "S10")

# S11 gesperrte Person mit kaputter E-Mail in der Messe -> Prüfen mit Warnhinweis Sperrliste
p = new_person("Ralf", "Kaiser", "Nordlicht Steuerberatung PartG")
add("Webinar", row_webinar(p, name="Ralf Kaiser"), "S11")
add("Messe", row_messe(p, email=p["email"].replace("@", " @ "), name="Ralf Kaiser"), "S11")
sperrliste.append(dict(email=p["email"], name="Ralf Kaiser", datum="2026-08-19", kanal="Telefon"))

# S12 Doppelvorname -> nicht eindeutig teilbar -> Prüfen
p = new_person("Anna Lena", "Vogt", "Sternwarte Kita gGmbH", email="annalena.vogt@sternwarte-kita.example")
add("Webinar", row_webinar(p, name="Anna Lena Vogt"), "S12")

# S13 Namenszusatz „von der“ -> automatisch teilbar -> Sauber
p = new_person("Henrik", "von der Heide", "Ziegelrot Architekten PartGmbB", email="h.vonderheide@ziegelrot.example")
add("Webinar", row_webinar(p, name="Henrik von der Heide"), "S13")

# S14 „Nachname, Vorname“ -> automatisch teilbar -> Sauber
p = new_person("Bettina", "Seidel", "Alpenweit Reisen GmbH")
add("Webinar", row_webinar(p, name="Seidel, Bettina"), "S14")

# S15 Titel im Namen -> Prüfen
p = new_person("Klaus", "Berg", "Löwenzahn Zahnarztpraxis", email="dr.berg@loewenzahn-praxis.example")
add("Messe", row_messe(p, name="Dr. Klaus Berg"), "S15")

# S16 Telefon nicht lesbar -> Prüfen
p = new_person("Malte", "Pohl", "Hafenmeister Gastro GmbH")
add("Kontaktformular", row_kontakt(p, telefon="040 / 12"), "S16")
p = new_person("Gesa", "Thiele", "", freelancer=True)
add("Messe", row_messe(p, telefon="siehe Website"), "S16")

# S17 Newsletter ohne Vorname, nur dort -> Prüfen; Newsletter mit Vorname ohne Nachname -> Sauber
p = new_person("Kai", "Schulz", "", email="k.schulz@posteo.example")
add("Newsletter", row_newsletter(p, vorname=None), "S17")
p = new_person("Merle", "Hansen", "", email="merle.hansen@gmx.example")
add("Newsletter", row_newsletter(p, vorname="Merle"), "S17")

# S18 Messe ohne Vorname-Info (nur Nachname) ergänzt durch Kontaktformular -> Sauber (Lücken füllen)
p = new_person("Svenja", "Krause", "Ostwind Solar GmbH")
add("Kontaktformular", row_kontakt(p, telefon=None), "S18")
add("Messe", row_messe(p, name="Krause", telefon=phone_variant(p, "plus0")), "S18")

# S19 Doppelte Formular-Absendung in derselben Quelle -> ein Datensatz
p = new_person("Philipp", "Graf", "Brückner Elektrotechnik GmbH")
add("Kontaktformular", row_kontakt(p, datum="2026-04-07"), "S19")
add("Kontaktformular", row_kontakt(p, datum="2026-04-07", email=p["email"].upper()), "S19")

# S20 doppelte Leerzeichen und GROSSBUCHSTABEN im Namen
p = new_person("Petra", "Schmitt", "Spreeblick Hausverwaltung GmbH")
add("Messe", row_messe(p, name="PETRA  SCHMITT"), "S20")

# S21 Excel-Datumsfalle: Datum als Zahl (Seriennummer) aus altem Export
p = new_person("Uwe", "Lorenz", "Kupferkessel Brauerei GmbH")
add("Webinar", row_webinar(p, datum=46280), "S21")  # 46280 = 2026-09-15

# S22 kleingeschriebener Name mit Bindestrich
p = new_person("Franziska", "Meyer-Albrecht", "Rheinblick Personalservice GmbH", email="f.meyer-albrecht@rheinblick-ps.example")
add("Webinar", row_webinar(p, name="franziska meyer-albrecht"), "S22")

# ---------------------------------------------------------------- Füllmenge (Mehrfach- und Einzelvorkommen)
multi_plan = [("Kontaktformular", "Webinar")] * 4 + [("Kontaktformular", "Messe")] * 3 + \
             [("Webinar", "Newsletter")] * 3 + [("Kontaktformular", "Newsletter")] * 3 + \
             [("Messe", "Newsletter")] * 2 + [("Kontaktformular", "Webinar", "Messe")] * 2 + \
             [("Webinar", "Messe", "Newsletter")] + [("Kontaktformular", "Webinar", "Messe", "Newsletter")]
for plan in multi_plan:
    p = new_person()
    for s in plan:
        add(s, BUILDERS[s](p))

# 2 weitere Sperrlisten-Einträge: einer kommt in den Daten vor (Newsletter, anders geschrieben), einer nicht
p = new_person(freelancer=False)
add("Newsletter", row_newsletter(p, email=" " + p["email"].title() + " "), "S23")
add("Kontaktformular", row_kontakt(p), "S23")
sperrliste.append(dict(email=p["email"], name=f"{p['vorname']} {p['nachname']}", datum="2026-03-11", kanal="Formular"))
sperrliste.append(dict(email="alt.kunde@gmx.example", name="", datum="2025-12-01", kanal="Brief"))

# Newsletter: weitere Abmeldungen ohne andere Vorkommen
for _ in range(3):
    p = new_person()
    add("Newsletter", row_newsletter(p, status="abgemeldet"))

for s in SOURCES:
    while len(rows[s]) < TARGET_ROWS[s]:
        p = new_person()
        add(s, BUILDERS[s](p))
    R.shuffle(rows[s])

# ---------------------------------------------------------------- Excel schreiben
HEAD = Font(bold=True, color="FFFFFF")
FILL = PatternFill("solid", fgColor="2F4858")

wb = Workbook()
wb.remove(wb.active)


def write_sheet(name, header, data, widths=None):
    ws = wb.create_sheet(name)
    ws.append(header)
    for c in ws[1]:
        c.font, c.fill = HEAD, FILL
    for d in data:
        ws.append([d.get(h) for h in header])
    ws.freeze_panes = "A2"
    for i, h in enumerate(header, 1):
        ws.column_dimensions[get_column_letter(i)].width = (widths or {}).get(h, max(14, len(h) + 4))
    return ws


kf = []
for i, (r, _) in enumerate(rows["Kontaktformular"], 1):
    r["Anfrage-ID"] = f"AN-2026-{i:03d}"
    kf.append(r)
write_sheet("Kontaktformular", list(row_kontakt(new_person()).keys()), kf,
            {"E-Mail": 40, "Firma": 34, "Nachricht": 50, "Telefon": 22})
ws = write_sheet("Webinar", ["Teilnehmer", "E-Mail-Adresse", "Unternehmen", "Anmeldedatum", "Teilgenommen"],
                 [r for r, _ in rows["Webinar"]], {"Teilnehmer": 28, "E-Mail-Adresse": 42, "Unternehmen": 34, "Anmeldedatum": 18})
for c in ws["D"][1:]:
    if isinstance(c.value, dt.datetime):
        c.number_format = "DD.MM.YYYY HH:MM"
write_sheet("Messe", ["Name", "Firma", "Mail", "Tel.", "Notiz", "Datum"], [r for r, _ in rows["Messe"]],
            {"Name": 26, "Firma": 34, "Mail": 42, "Tel.": 24, "Notiz": 22})
write_sheet("Newsletter", ["E-Mail", "Vorname", "Angemeldet am", "Status"], [r for r, _ in rows["Newsletter"]],
            {"E-Mail": 42, "Angemeldet am": 18})
write_sheet("Sperrliste", ["E-Mail", "Name", "Widerspruch am", "Kanal"],
            [{"E-Mail": s["email"], "Name": s["name"], "Widerspruch am": s["datum"], "Kanal": s["kanal"]} for s in sperrliste],
            {"E-Mail": 42, "Name": 22, "Widerspruch am": 16, "Kanal": 24})

OUT.parent.mkdir(parents=True, exist_ok=True)
wb.save(OUT)

# Fundstellen der Sonderfälle (Tab-Zeile) für die Tests
import json
fund = {}
for s in SOURCES:
    for i, (_, case) in enumerate(rows[s], start=2):
        if case:
            fund.setdefault(case, []).append(f"{s}-{i}")
(OUT.parent.parent / "tests" / "sonderfaelle-fundstellen.json").write_text(
    json.dumps(dict(sorted(fund.items())), ensure_ascii=False, indent=2), encoding="utf-8")
print("geschrieben:", OUT)
print({s: len(rows[s]) for s in SOURCES}, "Summe", sum(len(v) for v in rows.values()), "Sperrliste", len(sperrliste))
