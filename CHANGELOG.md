# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/). Newest entries first.

## [1.5.1] – 2026-11-13

### Changed
- README follows a short template; rules, operation and project background moved to `docs/`; changelog moved to this file.
- Specification rewritten in plain German (Präsens, active voice, no nominalisations). No code change.

### Removed
- Background example about lost COVID cases in README and specification.

## [1.5] – 2026-11-11

### Added
- Review decisions are kept between runs (columns `entscheidung` and `notiz` on *Prüfen*; unmatched decisions move to *Entscheidungen-Archiv*).
- Tab *Kontrolle*: recounts the result with spreadsheet formulas, independently of the script.
- The cell that triggers a review reason is highlighted.

## 2026-11-10

### Added
- Cockpit as a web app and as a menu item.
- Rule: an enquiry after an objection goes to review.
- Rule: two people behind one address are both kept.
- First acceptance run in Google Sheets.

### Fixed
- Ten defects found in a code review.

## 2026-11-09

### Added
- Specification, synthetic test data (150 rows, 23 special cases) and expected outcomes.
