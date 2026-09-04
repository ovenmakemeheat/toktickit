# Lab 2 Zen Green UI specification

Status: implementation contract completed; UI released to final `main` at `538b5da`; final visual review pending (2026-09-04)

Origin issue: #51 - Lab 2 - Sprint specification and test plan
Applies to: Issues #51-#57 and the integrated Lab 2 result

This document defines the reusable visual and interaction contract for Requester Selection, the application shell, Create Ticket, My Tickets, Requester Ticket Detail, and the Attachment section. It is read with `specification.md` and `api-spec.md`.

## Current Lab 2 state

The UI contract was delivered with Issue #51 and the corresponding implementation is integrated through PRs #58-#64 on `lab2-staging`; test-isolation PR #69 and release PR #70 are also merged. Automated UI/responsive checks and the screenshot inventory are recorded in `tests.md` and `visual-inspection.md`. Final-main repository, contract, release, test-output, and authenticated Project board evidence is recorded under `docs/lab-02/report/evidence/`; complete human visual-review sign-off is still pending.

## 1. Design principles

- Keep the interface recognizably TokTickIT and consistently Zen Green across every Lab 2 screen.
- Make the current Development Requester visible, but label it as a Lab 2 testing context rather than a login.
- Prefer clear text, readable grouping, and nearby validation over decorative complexity.
- Treat loading, empty, no-results, failure, validation, upload, and removal states as designed states.
- Keep Ticket information read-only on Ticket Detail and visually separate it from Attachment actions.
- Do not add authentication, IT Staff controls, comments, Actions Taken, or later status-workflow controls.

## 2. Visual tokens

### 2.1 Color

| Token | Value | Use |
| --- | --- | --- |
| `--zen-primary` | `#006B3C` | App header, primary actions, strong emphasis. |
| `--zen-secondary` | `#0B7A46` | Active tabs, focus accents, links, hover states. |
| `--zen-pale` | `#EAF6EF` | Selected, success, and subtle section emphasis. |
| `--zen-page` | `#F5F7F6` | Quiet near-white page background. |
| `--zen-surface` | `#FFFFFF` | Cards and panels. |
| `--zen-text` | Dark charcoal-green | Body text; never pure black. |
| `--zen-readonly` | Soft gray-green or warm ivory | Read-only field backgrounds. |
| `--zen-error` | Dark red | Error text and field borders. |
| `--zen-warning` | Amber | Warning callouts and badges only. |
| `--zen-success` | Green | Success confirmations, with text in addition to color. |

Color is never the only signal for success, warning, error, priority, current status, selected controls, or removed attachments.

### 2.2 Typography

- Use the existing system sans-serif stack: Inter when available, then system UI and Segoe UI.
- Body text is at least 1rem with a comfortable line height of approximately 1.5.
- Page title is the largest heading and is unique per screen.
- Section headings use a consistent size and weight; do not skip heading levels.
- Labels are medium or semibold, appear above controls, and use consistent spacing.
- Supporting text and state explanations remain readable and do not rely on low-contrast gray.

### 2.3 Spacing and surfaces

- Use a consistent 4px base spacing scale, with common gaps of 8px, 12px, 16px, 24px, and 32px.
- Use white surfaces with subtle borders and restrained shadows.
- Center page content in a sensible maximum-width container.
- Keep related controls in a panel or field group with a visible heading when grouping improves scanning.
- Keep touch targets at least 44px high where practical.

## 3. Shared components

### 3.1 Application shell

The shell includes:

- TokTickIT application identity.
- Current Development Requester name and a testing-context label.
- My Tickets navigation.
- Create Ticket navigation.
- Change Requester action.
- Clear active-page indication.
- Responsive mobile navigation that remains keyboard accessible.

The shell must not use labels such as logged-in, authenticated, or secure account for the temporary requester context. The explanatory text is: `Select a Development Requester to test requester-specific ticket behavior. This is not a login screen.`

### 3.2 Field component

- Label appears above the control.
- Required fields show a red asterisk and a text validation message when invalid.
- Help text is associated with the control and is not the only place a requirement is explained.
- Input, select, textarea, and file controls share a consistent height and border treatment.
- Description is taller and may resize only when it does not break the layout.
- Read-only fields use the read-only surface token and remain readable.
- Focus indicators use a visible secondary-green outline or equivalent high-contrast treatment.

### 3.3 Buttons and actions

- Buttons have visible text. Icons may support text but never replace an unclear label.
- Icon-only controls require an accessible name and tooltip.
- Disabled controls have a clear visual distinction and cannot be activated.
- Primary actions use the primary-green token; secondary actions remain visually distinct.
- Submit shows a busy label and is disabled while the request is pending.
- Destructive attachment removal requires confirmation and is not hidden behind an unlabeled icon.

### 3.4 Badges and state messages

- Requested Priority uses a readable badge with text such as Low, Medium, or High.
- Current Status displays `New` as text and does not imply that status can be changed in Lab 2.
- Loading, success, warning, and error messages include text and an appropriate semantic role.
- Removed attachment metadata is visibly muted and explicitly labeled Removed; it is not presented as an active download.

## 4. Requester Selection screen

### Required content

- TokTickIT title.
- Short explanation that the selector is for Lab 2 testing only and is not login.
- Development Requester dropdown containing active PostgreSQL-backed Requesters only.
- Continue button.
- Loading, empty, and safe API-failure states.
- Keyboard-accessible form controls and responsive Zen Green styling.

### Interaction contract

- Continue is disabled until a valid active Requester is selected.
- Loading shows an explicit busy state and prevents duplicate loading actions.
- Empty state explains that no active Requesters are available and provides a recovery message rather than a blank selector.
- Failure state explains that the Requester list could not load and provides a retry action.
- After Continue, the shell displays the selected Requester.
- Change Requester returns to this screen or opens the same selector and clears requester-specific data before loading the new context.

## 5. Create Ticket screen

### Layout

Use this order unless a reviewed responsive refinement is recorded:

1. Page heading and current Requester context.
2. System-generated Ticket Number and Ticket Date fields as read-only placeholders before creation and real values after success.
3. Classification group: Category, Related System, and Requested Priority.
4. Required Summary field.
5. Required Description textarea with enough width and height for a problem report.
6. Attachments selector with accepted-type and 5 MB per-file guidance.
7. Primary Submit action and a secondary navigation action.

### States

- Initial: editable empty form with required indicators.
- Reference loading: selectors show busy state and cannot submit until required reference data is ready.
- Validation: field messages appear beside the associated control; the first invalid field receives focus where practical.
- Submitting: Submit is disabled and announces progress; duplicate clicks do not create additional requests.
- Success: generated Ticket Number is prominent, the saved Ticket Date is visible, uploaded and pending attachment results are clear, and the next action is explicit.
- API failure: safe error appears near the form, entered values remain, and the user can retry.
- Invalid attachment: the file is rejected before upload when possible and the reason is shown beside the attachment entry.
- Partial upload failure: created Ticket Number remains visible; failed files are identified with a retry action.

## 6. My Tickets screen

### Layout

- Page heading includes the current Requester context.
- A visible Create Ticket action is available.
- Search input is labeled and has a clear action when populated.
- Filters include Category, Related System, Requested Priority, and Current Status.
- Sort control exposes the API sort fields and direction.
- Results show enough information to identify and open a Ticket: Ticket Number, Ticket Date, Summary, Category, Requested Priority, Current Status, and Last Updated.
- Pagination shows current page, total pages or item count, and disabled previous/next actions at the boundaries.

### Representations and states

- Desktop uses a readable table with aligned headings and adequate Summary space.
- Tablet keeps the table usable or uses a compact responsive table without clipping.
- Mobile uses a readable Ticket card or responsive table; every card exposes the same open-detail action.
- Loading preserves the page structure and announces that Tickets are loading.
- Empty-list explains that the current Requester has no Tickets and provides Create Ticket.
- No-results explains that the current search/filter combination has no matches and provides Clear filters.
- Failure explains the list could not load and provides retry without silently showing stale results.

## 7. Requester Ticket Detail screen

### Layout

- Page heading shows the Ticket Number and current Requester context.
- Ticket fields are grouped as read-only: Ticket Date, Requester, Category, Related System, Requested Priority, Current Status, Summary, and Description.
- Attachment section is visually distinct from the read-only Ticket information.
- Navigation back to My Tickets is visible and keyboard accessible.
- No Comments, Internal Notes, Actions Taken, IT Staff controls, IT Priority, or status-transition actions are present.

### Attachment section

- Shows active and removed metadata: display name, type, size, upload time, and removal state.
- Active entries provide Download and permitted Remove actions.
- Removed entries show Removed and removal reason when available; Download and Preview are absent or disabled with an explanation.
- Upload control states allowed types, 5 MB per file, and five active files per Ticket.
- Uploading, invalid, active, removed, unavailable, success, and failure states are explicit.
- Removal opens a confirmation step with a required 3-200 character reason before calling the API.

## 8. Responsive behavior

| Viewport | Required behavior |
| --- | --- |
| Desktop >= 992px | Centered content with the specified multi-column layout and sensible maximum width. |
| Tablet 768-991px | Two columns where practical; Summary and Description retain sufficient width. |
| Mobile < 768px | Fields stack vertically, buttons remain touch-friendly, and no horizontal page scrolling occurs. |
| All sizes | No clipped labels, overlapping messages, hidden buttons, unreadable attachment names, or controls that require precision tapping. |

Responsive navigation may collapse, but the current page and Change Requester action must remain discoverable. Table-to-card changes must preserve all required Ticket information and actions.

## 9. Accessibility contract

- Every form control has a programmatic label.
- Required fields expose both a required indication and a text error when invalid.
- Error messages are associated with their fields and use an alert or live region for submission-level errors.
- Loading and success changes use a polite live region without repeatedly interrupting typing.
- Keyboard focus is visible and follows a logical order.
- Buttons and links have names that describe their action; icon-only buttons have accessible labels and tooltips.
- Disabled controls cannot be activated and do not hide the reason they are unavailable.
- Text and controls meet practical contrast requirements against their surfaces.
- Status and priority are communicated by text as well as color.
- File names, validation messages, and action labels remain readable when browser text is enlarged.

## 10. Visual inspection checklist

Capture Playwright screenshots under:

- `artifacts/lab-02/screenshots/create-ticket/`
- `artifacts/lab-02/screenshots/my-tickets/`
- `artifacts/lab-02/screenshots/ticket-detail/`

For each required screen, inspect desktop at 1280x900 or wider, tablet at 820x900, and mobile at 390x844 or equivalent. The checklist must record:

- Zen Green tokens and shared component consistency.
- No clipping, overlap, unintended horizontal scrolling, or hidden controls.
- Labels, required asterisks, focus states, validation messages, and disabled states.
- Loading, empty, no-results, failure, success, invalid attachment, active attachment, removed attachment, and blocked-download states.
- Desktop table and mobile card or responsive-table readability.
- Search, filters, sorting, pagination, attachment controls, and Change Requester behavior.
- Evidence comparison against this document and the approved Lab 2 illustration, without copying later-lab controls.

## 11. Test hooks and route intent

The implementation may choose its React composition, but these user-observable regions must remain targetable by accessible role/name and stable labels:

- Requester Selection: `Development Requester`, `Continue`, and `Change Requester`.
- Shell navigation: `My Tickets`, `Create Ticket`, and current Requester name.
- Create Ticket: `Category`, `Related System`, `Requested Priority`, `Summary`, `Description`, `Attachments`, and `Submit`.
- My Tickets: `Search`, filter controls, sort controls, pagination controls, `Create Ticket`, and a Ticket open action.
- Ticket Detail: Ticket Number heading, read-only fields, `Attachments`, `Download`, `Remove`, removal reason, and confirmation action.

Suggested browser paths are `/select-requester`, `/tickets`, `/tickets/new`, and `/tickets/:ticketId`. A route implementation may use an equivalent mechanism only if the user-observable navigation and E2E flow remain stable.
