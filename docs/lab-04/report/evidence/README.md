# Lab 4 report evidence assets

These assets support `../toktickit-lab4-report.tex` and the generated `output/pdf/toktickit-lab4-report.pdf`.

## Test output

- `main-verify-output.txt` is the captured passing `bun run verify` output for release source `bd8cecd63f1dd3386b0b7f2ffcf270805e0190f3`.
- `main-e2e-output.txt` is the captured passing `bun run test:e2e` output for the same product source and isolated `toktickit_test` database.
- ANSI color/control sequences and terminal decoration glyphs were normalized for PDF rendering; test names, counts, and results were retained. The captured E2E report is `artifacts/lab-04/e2e/e2e-04-hardening/run-report.json`.

## Screenshot evidence and report crops

The original full-frame screenshots remain unmodified under `artifacts/lab-04/evidence/visual-inspection/`; the report links to these originals. The following files are presentation captures/crops. The PDF groups related viewport captures together; some supporting crops remain available here even when not embedded individually:

- `lab4-project-kanban.png`: public Lab 4 Kanban captured on 2026-10-29 at 2400 × 1100; shows all six workflow columns, parent #86 in Done, and 4/4 native sub-issues complete.
- `requester-dashboard-populated.png`: Requester dashboard with seeded owned open, waiting, resolved, and recent Tickets; captured in Chromium against the isolated PostgreSQL test database and real API.
- `actions-taken-multiple-staff.png` and `actions-taken-multiple-requester.png`: two Action Taken records on one seeded Ticket, shown to Staff (editable) and its owning Requester (read-only).
- `staff-recent-actions-desktop.png`, `staff-recent-actions-tablet.png`, and `staff-recent-actions-mobile.png`: performer-scoped current-user action feed, captured at the three documented viewports with an action on a Ticket owned by a different Staff user.
- `action-form-create-{desktop,tablet,mobile}.png` and `action-form-edit-{desktop,tablet,mobile}.png`: Action Taken create/edit panels captured at 1440 × 900, 768 × 1024, and 390 × 844.
- `viewport/`: exact-viewport presentation crops from the original full-page Requester, Staff, Administrator, Ticket Detail, Queue, and Admin captures. The original images remain the accessibility/layout evidence source; these crops do not replace them.
- `staff-dashboard-recent-lists.png`: presentation crop showing Recently Updated Tickets and the current-user action-feed empty state.
- `staff-action-work-history.png`: 1260 × 700 crop from `it-staff-ticket-detail-1440x900.png`.
- `mobile-action-taken-form.png`, `mobile-staff-dashboard.png`, and `mobile-requester-dashboard.png`: existing mobile presentation crops.

The new populated screenshots were generated in temporary Playwright capture runs after resetting only the guarded `toktickit_test` database. The temporary fixtures were deleted in test cleanup. Existing Lab 4 seeded E2E suites independently assert the same real-API journeys and role boundaries; no business API route mocks were used.

## Rebuild

From the repository root, run `bun run report:build:lab4`. The script uses `latexmk` with XeLaTeX and writes the PDF to `output/pdf/`.
