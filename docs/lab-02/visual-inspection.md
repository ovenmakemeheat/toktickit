# Lab 2 visual inspection record

Scope: Issues #56-#57 - Lab 2 Zen Green UI, visual inspection, and E2E evidence
Date: 2026-09-05 (updated)
Contract: `docs/lab-02/ui-spec.md`

This record covers the integrated Lab 2 visual work and its final-main evidence
update, not only the current report branch. Implementation PRs #58-#64, the
test-isolation PR #69, and release PR #70 are merged. The Lab 2 Kanban board
capture records the six Lab 1-aligned columns and Issues #51-#57 in `Done`;
human visual sign-off remains open.

## Design direction

TokTickIT uses a quiet support-desk workspace: a near-white page, white
surfaces, dark charcoal-green text, and a restrained green rail for primary
context. Shared Zen Green tokens are defined in `client/src/index.css` so
navigation, forms, lists, detail, badges, and state messages use the same
visual language.

## Viewport inspection

| Viewport | Inspection result |
| --- | --- |
| Desktop `1280x900` or wider | Centered shell supports the wide ticket table; detail and create panels retain readable maximum widths. |
| Tablet `820x900` | Classification, filters, and read-only fields use two columns; ticket-table overflow is contained inside its bordered wrapper. |
| Mobile `390x844` | Panels use the viewport width, navigation and actions stack to touch-sized controls, ticket results switch to cards, and long names/summaries wrap. |

## State coverage

| Area | Covered states and evidence basis |
| --- | --- |
| Requester Selection | Loading, ready, empty, failure, retry, disabled Continue, and Change Requester are covered by client tests and the E2E assertions; dedicated ready, selected, summary, and Change Requester captures are in `docs/lab-02/report/evidence/`. |
| Create Ticket | Reference loading, validation, submitting, success, API failure with preserved values, and invalid attachments are covered by client tests/E2E; the screenshot inventory and report evidence include reference-loading, initial, validation, submitting, success, API-failure, and invalid-attachment states. |
| My Tickets | Loading, normal results, empty list, no results, API failure/retry, filters, pagination, and Open Ticket action are covered by client tests/E2E; the inventory has empty, failure, filtered, and ownership-isolation captures. |
| Ticket Detail | Loading, owned detail, safe failure, read-only fields, and Back to My Tickets are covered by client tests/E2E; the inventory has active, removed, blocked-download, and invalid-attachment captures. |
| Attachments | Active, removed, upload, invalid file, download, removal confirmation, and explicit blocked-download explanation are covered by client/API tests and E2E evidence. |

## Findings fixed

- Centralized the approved Zen Green palette and added consistent focus rings,
  form control sizing, button sizing, labels, state borders, and disabled-state
  presentation.
- Expanded the shell to the ticket-list width while keeping create and detail
  panels constrained to readable widths.
- Added a tablet two-column breakpoint and mobile stacking rules for forms,
  filters, navigation, pagination, and attachment actions.
- Added safe wrapping and minimum-width rules for long summaries, filenames,
  metadata, and mobile card values to prevent clipping and page overflow.
- Restored the required Open Ticket action in both desktop table and mobile
  card representations; it navigates to the merged requester detail route.
- Made the shell navigation use the active-page treatment for Requester
  Summary, My Tickets, and Create Ticket instead of always highlighting Create
  Ticket.
- Added an explicit explanation to removed attachment records that preview and
  download are unavailable after soft removal.
- Added reduced-motion handling and a client regression test for opening a
  ticket from My Tickets.

## Evidence review

- `bun run test:e2e` passed two tests on the final-main-aligned branch and regenerated 36
  screenshots across 12 states in Create Ticket, My Tickets, and Ticket Detail
  at desktop, tablet, and mobile viewports.
- The browser flow asserts no horizontal overflow at `1280x900`, `820x900`,
  and `390x844`; the final-main-aligned regenerated screenshots show readable labels, stacked
  mobile controls, responsive ticket cards, read-only detail fields, explicit
  validation and failure messages, invalid-attachment feedback, and the
  blocked-download explanation for removed attachments.
- The current final-main commit is `538b5da`, released by PR #70. The renamed
  `docs/lab-02/report/evidence/final-main-test-output.png` records 8 client
  files/32 tests and 13 server files/70 tests. Seven additional `browser-use`
  captures record the final-main tree, README, `.gitignore`, history, rendered
  specification, rendered UI specification, and release PR.

## Evidence inventory

| State | Evidence prefix | Directory |
| --- | --- | --- |
| Reference loading | `create-ticket-reference-loading` | `artifacts/lab-02/screenshots/create-ticket/` |
| Create validation | `create-ticket-validation` | `artifacts/lab-02/screenshots/create-ticket/` |
| Create API failure with preserved values | `create-ticket-api-failure` | `artifacts/lab-02/screenshots/create-ticket/` |
| Create success | `create-ticket-success` | `artifacts/lab-02/screenshots/create-ticket/` |
| Empty ticket list | `my-tickets-empty` | `artifacts/lab-02/screenshots/my-tickets/` |
| Ticket-list API failure | `my-tickets-api-failure` | `artifacts/lab-02/screenshots/my-tickets/` |
| Filtered results | `my-tickets-filtered` | `artifacts/lab-02/screenshots/my-tickets/` |
| Ownership isolation/no results | `my-tickets-ownership-isolation` | `artifacts/lab-02/screenshots/my-tickets/` |
| Invalid attachment | `ticket-detail-invalid-attachment` | `artifacts/lab-02/screenshots/ticket-detail/` |
| Active attachment | `ticket-detail-active` | `artifacts/lab-02/screenshots/ticket-detail/` |
| Blocked download after removal | `ticket-detail-blocked-download` | `artifacts/lab-02/screenshots/ticket-detail/` |
| Removed attachment metadata | `ticket-detail-removed` | `artifacts/lab-02/screenshots/ticket-detail/` |

Every prefix has `desktop`, `tablet`, and `mobile` captures. The E2E test
asserts the corresponding state-specific text or control before each capture.

## Current evidence gaps

The report-evidence Playwright test now provides dedicated desktop captures for
requester selection, selected-user display, Change Requester, the initial Create
Ticket form, the submitting/busy state, mixed attachment validation, and a
non-default filter/sort/page state. These captures are stored under
`docs/lab-02/report/evidence/`.

The `browser-use` CLI additionally captured the final `main` repository
tree/README, `.gitignore`, commit history, rendered `specification.md`, rendered
`ui-spec.md`, release PR #70, and the Lab 2 Kanban Project board. These are
repository, contract/release, and workflow evidence; they do not replace
application E2E screenshots. The board capture shows Issues #51-#57 in
`Done` across the six Lab 1-aligned workflow columns.

- Record the human visual review and approval evidence in `reviewer.md`.
- The final-main-aligned Playwright capture flow has now been rerun; the
  regenerated application screenshots are the current evidence set. Do not
  present older staging or controlled UI fixtures as final-main evidence.

## Follow-up

Issue #57 is implemented and its PR #64 is merged into `lab2-staging`. The
test-isolation follow-up is merged by PR #69, and release PR #70 is merged into
`main`. The remaining Lab 2 follow-up is human visual-review recording.
