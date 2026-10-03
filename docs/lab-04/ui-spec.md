# Lab 4 Zen Green UI specification

- Status: contract draft; human review pending.
- Parent: [Issue #86](https://github.com/ovenmakemeheat/toktickit/issues/86) · Contract: [Issue #87](https://github.com/ovenmakemeheat/toktickit/issues/87)
- Related: [engineering specification](specification.md), [API contract](api-spec.md), [test plan](tests.md).
- Visual foundation: [Lab 3 Zen Green UI specification](../lab-03/ui-spec.md).

This contract extends the existing Zen Green application with Dashboard navigation, concise role dashboards, Actions Taken on Ticket Detail, and the final status/resolution interactions. It preserves all earlier approved screens and behavior. The UI guides and explains; the server remains authoritative for every role, owner, status, and conflict decision.

## 1. Design principles

- Keep the application recognizably TokTickIT and preserve the Zen Green tokens, typography, spacing, cards, tables, badges, buttons, forms, mobile navigation, and feedback conventions already established.
- Keep dashboards concise and connected to detailed Queue/Ticket screens; do not duplicate My Tickets or replace the Staff Queue.
- Distinguish Ticket Owner from the performer of each Action Taken. A work-log entry must never imply that its performer became the primary coordinator.
- Clearly identify that Requesters can see Actions Taken. Keep Requester work history read-only.
- Keep Public Comments visibly shared and Internal Notes visibly private. Do not add Internal Note content to any dashboard or Action Taken response.
- Use readable text and semantic controls. Color supports meaning but never carries it alone.
- Treat loading, saving, validation, success, empty, no-results, forbidden, not-found, conflict, and safe failure as designed states.
- Remove genuinely obsolete/duplicate/placeholder controls without removing a previously approved Lab 1–3 capability.

Reuse established Lab 3 visual tokens; this contract does not introduce a competing color or component system.

## 2. Role navigation and shared shell

The authenticated shell continues to show TokTickIT identity, current User, role, active page, password/logout actions, and keyboard-accessible responsive navigation. Add a Dashboard destination:

| Role | Dashboard | Other existing destinations |
| --- | --- | --- |
| Requester | Requester Dashboard | My Tickets, Create Ticket |
| IT Staff | IT Staff Dashboard | Ticket Queue |
| Administrator | Same IT Staff Dashboard | Lab 4 operational Queue/Ticket Detail, User Management, existing Ticket Review |

- Do not create a separate Administrator dashboard or user-account KPI surface.
- Administrator operational Queue, Ticket Detail, Action Taken, and status controls are present as approved in the parent contract; User Management and Ticket Review remain available.
- Hide unauthorized destinations from the shell, but do not treat hidden/disabled UI as authorization. Direct route/API access must still be tested.
- Mobile navigation keeps Dashboard, role-appropriate routes, current User/role, and logout discoverable without horizontal scrolling.

## 3. Dashboard surfaces

### 3.1 Shared layout

Each Dashboard has one page heading, brief role-appropriate explanation, concise metric cards, and bounded recent Ticket rows. Metric labels and count values are readable text. A card or row is actionable only when it has a valid destination; actionable cards expose link/button semantics and an accessible name that identifies both the metric and its destination.

- Requester Dashboard never shows another Requester's counts, Ticket number, summary, or destination.
- IT Staff and Administrator Dashboard use the approved operational calculations; no separate Admin metrics are added.
- Each recent list shows at most five Ticket summaries. If there are more, link to the full matching Queue/My Tickets view rather than rendering the full collection.
- No dashboard includes Internal Notes, full descriptions, all Attachments, or complete Ticket collections.
- Use the same `asOf` calculation and 30-day UTC window specified in the API contract. The UI may format a timestamp for readability but cannot change its boundary or count semantics.

### 3.2 Requester Dashboard

Display:

- `Open Tickets` from `openCount`, linking to My Tickets filtered to the active Ticket set.
- `Waiting for You` from `waitingForRequesterCount`, linking to My Tickets filtered to `WAITING_FOR_REQUESTER`.
- `Recently Updated` with up to five owned Ticket rows; each opens its Requester Ticket Detail.
- `Recently Resolved` with a count and up to five currently resolved/closed Ticket rows within the defined window; each opens its Requester Ticket Detail.

The Dashboard is a summary, not another Ticket list. Show a clear zero/empty state when there is no work, a distinct empty recent list when a count is zero, and safe retry feedback if loading fails. Never expose staff-only IT Priority, owner controls, Internal Notes, or Action Taken editing.

### 3.3 IT Staff and Administrator Dashboard

Display:

- `Unassigned Active` from `unassignedActiveCount`, linked to the Staff Queue's unassigned filter.
- `My Active Tickets` from `myActiveCount`, linked to the owner/me filter.
- Active Tickets by status; every active status is represented, including zero counts, and links to the matching Queue filter.
- Active Tickets by IT Priority, plus `High Priority Active`; each links to the matching priority filter.
- `Recently Updated` with up to five active Ticket rows, ordered exactly as the API specifies; each opens Staff Ticket Detail.

The Dashboard offers an operational starting point, not a full Queue replacement. All calculations use the authenticated staff/admin identity where defined. A zero count is shown as `0`; an empty recent list is explained without an error message. Administrators see the same operational Dashboard and retain their User Management/Ticket Review paths.

### 3.4 Dashboard states and interactions

| State | Required behavior |
| --- | --- |
| Initial/loading | Keep card/list structure visible; identify the loading region; do not present stale values as current. |
| Success with data | Render counts and bounded rows from the current response; every actionable card/row navigates to the documented filter/detail. |
| Zero/empty | Show zero counts and explain that there are no matching Tickets; provide the applicable next step. |
| Failure | Show a safe message and Retry action; do not display an old successful response without marking it stale. |
| Forbidden | Explain that the current role cannot access the Dashboard; no protected metrics are rendered. |
| Navigation | Preserve the destination status, IT Priority, owner/unassigned, or Ticket ID filter and use existing detailed screens. |

## 4. Actions Taken on Ticket Detail

### 4.1 Location and structure

Add an `Actions Taken` section to the existing Ticket Detail after the Ticket facts and before or alongside communication panels, preserving the established information hierarchy. Include a visible explanation: `Actions Taken are visible to the Requester of this Ticket.` The Ticket Owner remains displayed in its existing ownership area and is not inferred from the action list.

Each row/card displays:

- Action Date/Time, with a clear timezone label (API/storage use UTC; display the user's local time only when the timezone is identified unambiguously).
- Action Description.
- Result.
- Performed by (name and role) and record creation metadata needed to distinguish performer from editor.
- Follow-Up Required as text, plus Follow-up Note when required.
- Attachment Notes as plain text, clearly not a new upload or linked file control.

Order rows by action date/time ascending, then stable record ID ascending. Do not sort locally in a way that changes the API order.

### 4.2 Staff/Admin create mode

Show `Add Action Taken` only to IT Staff and Administrators with permitted access to the Ticket. Create fields:

1. `Action Date/Time` (required).
2. `Action Description` (required, maximum 2,000 characters).
3. `Result` (required, maximum 2,000 characters).
4. `Follow-Up Required?` (required yes/no control).
5. `Follow-up Note` (required and shown/enabled only when follow-up is required; maximum 2,000 characters).
6. `Attachment Notes` (optional, maximum 2,000 characters; text-only reference to existing Ticket evidence).

The UI does not ask the user to choose `Performed by`; the server records the authenticated User. No new file upload appears in this section. On successful creation, refresh the list and Ticket `updatedAt`/recent dashboard context without changing the Ticket Owner.

### 4.3 Staff/Admin edit mode

- Each editable entry has a clearly labeled `Edit` action.
- Edit Action Date/Time, description, result, follow-up fields, and Attachment Notes. Performer, parent Ticket, record creation time, and creation attribution are read-only.
- Submit the last-read version. On success, show updated metadata and refresh the row.
- On `409 ACTION_TAKEN_CONFLICT`, preserve the entered non-secret values, explain that another User changed the entry, reload the newest version, and let the user compare/reapply. Never retry by silently overwriting.
- Do not expose a delete action, even for Administrators.

### 4.4 Requester read-only mode

A Requester who owns the Ticket sees all Actions Taken in the stable order with performer, date/time, description, result, follow-up information, and Attachment Notes. The section has no create/edit/delete controls. An empty history explains that no work has yet been recorded. Requesters do not see Actions Taken for another User's Ticket through direct navigation.

### 4.5 Action Taken states

- Loading, empty, ready, saving, success, validation, forbidden, not-found, conflict, and retryable safe failure have visible text feedback.
- Field errors are associated with their labels and preserve safe entered values on recoverable failure.
- Disable the submitted action while its request is pending to prevent double-click duplicate work; API idempotency is still required for network retries.
- Success/failure updates are announced through an appropriate live region.
- Follow-up state is understandable with text and non-color cues.
- User-provided text renders as text, not executable markup.

## 5. Ticket workflow and resolution feedback

- Status controls show only targets permitted from the current state in the specification's transition matrix.
- IT Staff and Administrators may operate the matrix; Requesters never receive formal transition controls.
- Display the current status as text, not color alone. Preserve Requested Priority separately from editable IT Priority.
- Transitions to Resolved, Closed, Reopened, and Cancelled require a confirmation step naming the exact action. Cancel/back returns to the previous state without mutation.
- Disable or explain the Resolved action until an eligible Action Taken exists. For a reopened Ticket, the UI must reflect the server's additional-work gate; the server response is authoritative.
- On conflict, explain that the Ticket changed elsewhere, refresh the current summary, and require a deliberate retry. Do not resubmit a stale transition automatically.
- A Requester's `Problem Appears Resolved` action remains a labeled advisory and never appears as a formal status update.
- Successful status changes refresh the Ticket summary and dashboard-relevant data.

## 6. Preserve earlier screens and communication

- Preserve Requester My Tickets, Create Ticket, Ticket Detail, Attachments, and Public Comments.
- Preserve IT Staff Queue, ownership/claim/reassign, priority, status, Public Comments, Internal Notes, and Attachments behavior.
- Preserve Administrator User Management and Ticket Review/IT-Priority behavior while exposing the approved Lab 4 operational capabilities.
- Keep Public Comments shared and Internal Notes restricted/private in Ticket Detail. Dashboards never show Internal Note content.
- Preserve existing cards, tables, badges, feedback, mobile navigation, form conventions, and safe API error states. Remove only genuinely obsolete/duplicate/placeholder controls; do not remove a prior approved capability.

## 7. Responsive behavior

| Viewport | Required representation |
| --- | --- |
| Desktop (`>= 992px`) | Concise metric cards in a readable grid; recent summaries and Actions Taken use readable table/list layouts where they fit. |
| Tablet (`768–991px`) | Reduce columns and stack cards/fields as needed; keep summary text, labels, action controls, and focus visible. |
| Mobile (`< 768px`) | Stack cards and form controls; use readable Ticket/action cards rather than forcing a wide table; keep every required action reachable. |
| All sizes | No clipped text/control, overlap, hidden required action, horizontal page scroll, or hover-only information. Touch targets remain practical. |

Status controls, follow-up notes, requester-visible Action Taken details, and drill-down links must remain available at every supported size.

## 8. Accessibility contract

- Every control has a programmatic label; required fields expose a visible required indicator and text validation.
- Error text is associated with the relevant field; submission-level errors use an appropriate alert/live region.
- Loading/success changes are announced without unnecessarily interrupting screen-reader flow.
- Keyboard order is logical; visible focus is retained after validation/conflict; dialogs can be operated and dismissed by keyboard without trapping focus when closed.
- Metric cards and row destinations expose actionable semantic links/buttons with names that include the metric/Ticket context.
- Status, priority, ownership, follow-up, public/private visibility, success, warning, and error have text/non-color cues.
- Read-only performer/creation data is distinguishable from editable values and remains selectable/readable.
- Dashboard and Action Taken layouts do not rely on hover or color alone.
- No personal/private content is announced from a screen the role cannot access.

## 9. Visual inspection and evidence plan

Planned screenshot destinations, matching the handout structure:

- `artifacts/lab-04/screenshots/staff-dashboard/`
- `artifacts/lab-04/screenshots/requester-dashboard/`
- `artifacts/lab-04/screenshots/actions-taken/`

Inspect both dashboards, staff/admin Ticket Detail, Requester read-only Ticket Detail, status confirmations, action create/edit/conflict, and empty/failure states at desktop, tablet, and mobile viewports. Record route, role, viewport, data marker, revision, screenshot, and result in the `VIS-01` checklist. Screenshots are demonstration evidence, not proof of backend authorization; pair role boundaries with API/E2E evidence.

## 10. User-observable labels and test targets

| Area | Stable visible text/roles |
| --- | --- |
| Navigation | `Dashboard`, `My Tickets`, `Create Ticket`, `Ticket Queue`, `User Management`, `Log out` (role-appropriate). |
| Requester dashboard | `Open Tickets`, `Waiting for You`, `Recently Updated`, `Recently Resolved`. |
| Staff/Admin dashboard | `Unassigned Active`, `My Active Tickets`, `By Status`, `By IT Priority`, `High Priority Active`, `Recently Updated`. |
| Actions Taken | `Actions Taken`, `Add Action Taken`, `Action Date/Time`, `Action Description`, `Result`, `Performed by`, `Follow-Up Required?`, `Follow-up Note`, `Attachment Notes`, `Edit`. |
| Workflow | Visible current status, only permitted transition target, explicit confirmation action, conflict/reload message. |

Equivalent accessible names are acceptable if they communicate the same behavior and remain stable for user-level tests.
