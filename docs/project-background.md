# Project background

The project is based on a course exercise from a training programme in AI management and process automation, in which 18 rows were cleaned with n8n. The idea was rebuilt in Apps Script with synthetic data, stricter rules and a view for management.

Concept, business rules, acceptance and presentation: Dariia Sichynska.

Tools: Google Apps Script, Google Sheets, Node (tests), Claude (Anthropic).

## Scope

- Topic: data cleaning with Apps Script, publishable as a portfolio project.
- A model company (a consultancy for automation services) and synthetic data replace the course data.
- At least 150 rows, so that duplicates and edge cases appear in realistic numbers.

## Acceptance in the real spreadsheet

- Every version was installed in Google Sheets and run from the menu, as an employee without access to the code would run it.
- The first run stopped with `Invalid argument: timeZone`. Cause: an imported spreadsheet without a time zone, a case the local simulation did not cover.
- Each log line was compared with the expected figures, and single records were checked against their source rows. A phone number that looked wrong was traced to its source row before acceptance.

## Quality

- The usual one-line phone fix was checked against `+49 (0)30 …`; see [Pitfalls](rules.md#pitfalls).
- A critical review of the finished script found ten defects outside the test data, among them the missing block list and `+49 030 …`. All defects are fixed and covered by tests.
- Every delivered file has a version number.

## Business rules

- A blocked person who later sends an enquiry goes to review instead of being dropped, because answering an enquiry is not advertising.
- Two people behind one e-mail address are both kept.
- Two freelancers with the same name both go to review for now.

## Management view

- The cockpit addresses a managing director: light, modern, in white, blue and green.
- A web app in Apps Script was chosen instead of a chart tab in Sheets. A run history is not included yet.
- The time saved is a worked example for an owner with a 38-hour week at 100 € per hour; a footnote states the assumptions.

## Operation

- The behaviour for added rows and a new trade-fair source was checked and is described under [Daily use](operations.md#daily-use). This led to v1.5, which keeps review decisions between runs.
