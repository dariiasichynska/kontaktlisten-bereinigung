# Rules

The full rule set is in the [specification](spezifikation.md) (German). This page summarises the rules and shows the code.

## Automatic fixes

| The script … | Example |
|---|---|
| removes invisible characters (zero-width space, soft hyphen, direction marks) | `katrin` + zero-width space + `@…` and `katrin@…` are the same person |
| trims and collapses spaces, lower-cases the e-mail | `J.NEUMANN@…` → `j.neumann@…` |
| corrects names in all upper or all lower case | `PETRA  SCHMITT` → `Petra Schmitt` |
| splits a name in one cell | `Seidel, Bettina` → Bettina / Seidel · `Henrik von der Heide` → Henrik / von der Heide |
| converts phone numbers to E.164 | `030/2312…`, `0049 30 …`, `+49 (0)30 …` → `+4930…` |
| converts dates to `YYYY-MM-DD` | `8.10.26`, `08.10.2026 14:30`, a date cell, the Excel number `46280` |
| merges rows with the same e-mail and fills gaps from other sources | form + trade fair → one record; the more reliable source wins |

## Review reasons

The script moves a record to **Prüfen** with a plain reason and guesses no value.

| Reason | Why the script does not decide |
|---|---|
| `E-Mail ungültig` | `tobias.engel(at)…` could be repaired, but a wrong guess would send mail to a stranger. |
| `Name nicht eindeutig` | For `Anna Lena Vogt`, a double first name and a double surname are both possible. |
| `Nachname weicht ab` | The same e-mail appears with `Krüger` and `Neumann`. `Möller` and `Moeller` are **not** a conflict. |
| `Gleiche E-Mail, verschiedene Vornamen` | Two people share one address. The script keeps both records. |
| `Mögliches Duplikat zu …` | The same name and company appear with a different e-mail. |
| `Telefon nicht lesbar` | The script cannot convert values such as `040 / 12` or `siehe Website`. |
| `Rollenadresse` | No contact person is known for `info@…`. |
| `Name auf Sperrliste` | The e-mail of a blocked person is broken in one source, but the name still matches. |
| `Gesperrt, aber neue Anfrage` | An objection to advertising was followed by an enquiry. Answering an enquiry is not advertising, so the record stays. |

## Pitfalls

- **`+49 (0)30 …` and `+49 030 …`.** The usual one-line expression (strip all non-digits, replace a leading `0` with `+49`) produces `+49030…`. The number looks tidy but cannot be reached. The script removes the optional zero first and then checks the length.
- **Google Sheets rewrites values.** In a normal cell, `+4930…` loses the plus and `2026-09-15` becomes a date. The script sets the text format first and writes the values second.
- **Blocking after cleaning.** A raw comparison does not match `MARKUS…@` with `markus…@` on the block list.
- **Merging before review.** The script reviews records, not rows. Another source often fills a missing first name, and some conflicts (different surnames, two people behind one address) appear only when the rows of one person are merged. Rows without a valid e-mail are never merged and cannot disappear as duplicates.
- **Missing block list stops the run.** Otherwise every blocked person would end up in the clean list while the balance still showed OK.
- **Row count.** After each run, the log checks `read = clean + review + blocked`. A lost row shows at once.

## Rules in code

The examples show the rules as they appear in the script, with simplified variable names. Full code: [`src/Bereinigung.gs`](../src/Bereinigung.gs) and [`src/Code.gs`](../src/Code.gs).

**Invisible characters**

```js
text.replace(/[­​-‏⁠﻿]/g, '')   // zero-width space, soft hyphen, direction marks
    .replace(/[   ]/g, ' ')               // non-breaking spaces
    .replace(/\s+/g, ' ')
    .trim()
```

These characters are invisible and come from copy and paste. Without this line, two identical e-mail addresses count as different.

**Valid e-mail**

```js
/^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(email)
```

An `@` alone is not enough. The rule also requires a domain with an ending; otherwise the row goes to review.

**Phone: one-liner and script**

```js
// The usual one-liner, here as an n8n expression. It turns "+49 (0)30 …" into a wrong "+49030…".
{{ $json.telefon.replace(/[^0-9+]/g, '').replace(/^00/, '+').replace(/^0/, '+49') }}

// In the script (shortened)
var t = text.replace(/\(0\)/g, '').replace(/[^0-9+]/g, '');      // remove "(0)" first
if (nummer.indexOf('490') === 0) nummer = '49' + nummer.slice(3); // "+49 030 …" → "+4930…"
if (nummer.length < 10 || nummer.length > 15) { /* → review: "Telefon nicht lesbar" */ }
```

The one-liner only formats a number. The script also checks whether the result can be a valid phone number.

**Comparison without changing the value**

```js
text.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')            // é → e
```

"Möller" and "Moeller" are equal in the comparison. The stored name follows the most reliable source.

**Excel number as a date**

```js
new Date(Date.UTC(1899, 11, 30) + Math.floor(wert) * 86400000)   // 46280 → 2026-09-15
```

Old exports often store a date as a number: the days since 30 December 1899.

**Text format first, values second**

```js
bereich.setNumberFormat('@');   // plain text
bereich.setValues(daten);
```

In the opposite order, Google Sheets converts "+4930…" into a number without the plus.

**Balance**

```js
bilanzOk = gelesen === sauberZeilen + pruefenZeilen + gesperrt;
```

This line shows after every run whether a row was lost.
