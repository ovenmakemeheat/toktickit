# Lab 2 visual inspection record

Issue: #56 - Lab 2 - Zen Green responsive UI and visual inspection
Date: 2026-08-31
Contract: `docs/lab-02/ui-spec.md`

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

| Area | Covered states |
| --- | --- |
| Requester Selection | Loading, ready, empty, failure, retry, disabled Continue, and Change Requester. |
| Create Ticket | Reference loading, validation, submitting, success, API failure with preserved values, and invalid attachments. |
| My Tickets | Loading, normal results, empty list, no results, API failure/retry, filters, pagination, and Open Ticket action. |
| Ticket Detail | Loading, owned detail, safe failure, read-only fields, and Back to My Tickets. |
| Attachments | Active, removed, upload, invalid file, download, removal confirmation, and blocked removed-file actions. |

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
- Added reduced-motion handling and a client regression test for opening a
  ticket from My Tickets.

## Follow-up

Exact desktop, tablet, and mobile screenshot capture remains part of Issue #57
under `artifacts/lab-02/screenshots/`. It requires the browser/E2E and seeded
database environment; the component state coverage and responsive CSS review
are recorded here for this Issue #56 handoff.
