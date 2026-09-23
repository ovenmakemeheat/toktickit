# Lab 3 Zen Green UI specification

Status: draft implementation contract for Issue #72; human review is required before Lab 3 implementation Pull Requests are completed
Origin issue: #72 - Lab 3 - Sprint specification and test plan
Related contract: [specification.md](specification.md)
API contract: [api-spec.md](api-spec.md)

This document extends the Lab 2 Zen Green language to authentication, Requester regression, the IT Staff workflow, minimalist Administrator User Management, and the Administrator's narrow read-only Ticket Review. It defines the user-observable structure, modes, states, responsive behavior, and accessibility expectations. It does not copy the complete handout or invent excluded features.

## 1. Design principles

- Keep the interface recognizably TokTickIT and consistently Zen Green across Lab 2 and Lab 3 screens.
- Make the current authenticated User and role visible after login, while never presenting a hidden control as authorization.
- Prefer clear text, readable grouping, and nearby validation over decorative complexity.
- Treat loading, saving, empty, no-results, forbidden, not-found, conflict, success, and failure as designed states.
- Keep Requester Ticket facts read-only where the existing Lab 2 contract requires them and visually distinguish staff-operational fields.
- Make Public Comments and Internal Notes visually distinct so private information cannot be posted publicly by mistake.
- Use visible text and semantic HTML for roles, statuses, priorities, warnings, and errors. Color is a supporting signal only.
- Keep the required scope small: no dashboards, account deletion, email workflows, multi-role UI, Actions Taken, or advanced identity-management screens.

## 2. Zen Green visual tokens

### 2.1 Color

Reuse the Lab 2 tokens and apply them consistently to every new screen.

| Token | Value | Use |
| --- | --- | --- |
| `--zen-primary` | `#006B3C` | Header, primary actions, strong emphasis. |
| `--zen-secondary` | `#0B7A46` | Active navigation, focus accents, links, and hover states. |
| `--zen-pale` | `#EAF6EF` | Selected rows, success surfaces, and subtle section emphasis. |
| `--zen-page` | `#F5F7F6` | Quiet near-white page background. |
| `--zen-surface` | `#FFFFFF` | Cards, tables, forms, and panels. |
| `--zen-text` | Dark charcoal-green | Body text; never pure black. |
| `--zen-readonly` | Soft gray-green or warm ivory | Read-only Ticket fields and non-editable values. |
| `--zen-error` | Dark red | Error text, borders, and error state icon/text. |
| `--zen-warning` | Amber | Warning callouts and badges. |
| `--zen-success` | Green | Success confirmations, with text in addition to color. |

Role, status, and priority badges use these tokens as a background or border only when the text label remains readable. No state may be communicated by color alone.

### 2.2 Typography

- Use the existing system sans-serif stack: Inter when available, then system UI and Segoe UI.
- Body text is at least `1rem` with a comfortable line height of approximately `1.5`.
- Each screen has one unique page title and a logical heading hierarchy.
- Labels are medium or semibold, appear above controls, and use consistent spacing.
- Supporting text and state explanations remain readable and do not depend on low-contrast gray.
- Ticket Numbers and other identifiers may use a monospace treatment only as a readability aid, not as a separate visual system.

### 2.3 Spacing and surfaces

- Use a 4px base scale with common gaps of 8px, 12px, 16px, 24px, and 32px.
- Use white surfaces with subtle borders and restrained shadows.
- Center page content in a sensible maximum-width container.
- Group related controls in a titled panel when grouping improves scanning.
- Keep touch targets at least 44px high where practical.
- Keep error text, help text, and action feedback close to the control or region they describe.

## 3. Shared application shell

### 3.1 Unauthenticated and password-change shells

- Login is a focused public screen with TokTickIT identity and no normal application navigation.
- A User who must change an initial password sees only the Change Password screen and a safe sign-out action. Ticket, Queue, and User Management routes remain blocked by the server and by client routing.
- The Change Password screen explains why the step is required without exposing credentials or internal account details.

### 3.2 Authenticated shell

The shell contains:

- TokTickIT identity and a short product description.
- Current User name and a visible role badge: Requester, IT Staff, or Administrator.
- Role-appropriate navigation:
  - Requester: My Tickets and Create Ticket.
  - IT Staff: Ticket Queue.
  - Administrator: User Management and a direct Ticket Review action for a known Ticket ID.
- A Password action that opens the permitted password flow.
- A visible Logout action.
- A clear active-page indication and a responsive mobile navigation that remains keyboard accessible.

The shell must not display unauthorized destinations as disabled promises. It must also not call a role-restricted endpoint merely to decide whether to hide a button; the server remains authoritative.

### 3.3 Shared controls

- Field labels appear above controls. Required fields expose both a visible required indicator and a text error when invalid.
- Inputs, selects, textareas, and file controls share a consistent border, height, focus, and disabled treatment.
- Read-only values use `--zen-readonly`, remain selectable/readable, and are not styled as editable controls.
- Buttons have visible action text. Icon-only controls require an accessible name and tooltip.
- Destructive or final actions use a confirmation step with a specific action label, not an unlabeled icon.
- Busy actions are disabled during a request and announce progress without allowing duplicate submission.
- State messages use a semantic live region or alert appropriate to urgency.

## 4. Global state and feedback contract

| State | UI behavior |
| --- | --- |
| Initial | Show the expected structure, labels, and available actions without pretending data is loaded. |
| Loading | Preserve the page structure, identify the loading region, and disable only actions that would duplicate the request. |
| Saving/submitting | Disable the submitted action, show a busy label, and prevent duplicate mutations. |
| Success | Explain what changed and expose a clear next action, such as open Ticket, return to list, or continue. |
| Validation | Place a concise message beside the associated field, focus the first invalid field where practical, and preserve valid input. |
| Empty | Explain that no records exist for the current scope and provide the primary recovery action. |
| No results | Explain that the current search/filter combination has no matches and provide Clear filters or a new search. |
| Forbidden | State that the current role cannot perform the action and do not expose protected data. |
| Not found | Explain that the requested resource is unavailable without confirming another Requester's resource exists. |
| Conflict | Explain what must be changed, such as a duplicate email or stale ownership update, without a database error. |
| Safe failure | Explain that the operation could not be completed, preserve safe user input, and offer retry when recovery is meaningful. |

## 5. Login screen

### 5.1 Structure

1. TokTickIT heading and short explanation.
2. Email field.
3. Password field with a show/hide control that has an accessible name.
4. Field-level validation region.
5. Primary `Sign in` action.
6. Submission-level safe failure region.

The screen does not include self-registration, social login, MFA, email recovery, or an account selector.

### 5.2 Interaction and modes

| Mode | Required behavior |
| --- | --- |
| Initial | Email and password are empty and labeled. Sign in is available when client validation permits submission. |
| Validation | Trim and validate the email; require a password; show messages beside invalid fields. |
| Busy | Disable Sign in, announce `Signing in`, and prevent duplicate requests. |
| Invalid credentials | Show a generic safe failure such as `Email or password is incorrect.` Do not identify which credential failed. |
| Inactive account | Show a clear minimal message such as `This account is inactive. Contact an administrator.` Do not expose other account information. |
| Initial password required | Continue to Change Password and do not render the normal shell. |
| Success | Load the permitted shell only after the server confirms the session and password-change state. |
| Recoverable failure | Keep the entered email, clear or protect the password as appropriate, and offer retry. |

The browser must not store passwords in local storage, URLs, query strings, or application logs.

## 6. Mandatory Change Password screen

### 6.1 Structure

1. Page title `Change your initial password`.
2. Short explanation that normal application access is blocked until completion.
3. Current/initial password field.
4. New password field with visible rule text.
5. Confirm new password field.
6. Validation and safe failure region.
7. Primary `Save new password` action.
8. Secondary `Log out` action.

### 6.2 Rules and states

- The password rule text states 12-128 characters, at least one letter, one number, and one non-alphanumeric character.
- Client validation is immediate enough to guide the User; server validation is authoritative.
- New password and confirmation are never echoed in URLs or error messages.
- While saving, the action is disabled and announces progress.
- A successful change clears the required state on the server and then opens the normal role shell.
- Invalid current password, policy failure, mismatch, expired session, and unexpected failure use safe messages and preserve only non-secret fields.
- Direct navigation to Ticket, Queue, or User Management while the change is required is blocked and returns the User to this screen.

## 7. Requester workspace and Lab 2 regression

### 7.1 Shell and navigation

- Replace the Lab 2 Development Requester display with the authenticated User name and Requester badge.
- Remove Development Requester Selection and Change Requester from the normal flow.
- Keep My Tickets, Create Ticket, Ticket Detail, and Attachment behavior from Lab 2.
- Reference data loads for the authenticated Requester; no requester identity is chosen in a select control.

### 7.2 My Tickets and Create Ticket

Keep the Lab 2 layout, tokens, field conventions, search/filter/sort/page behavior, attachment limits, and state messaging. All calls use the authenticated session. The client may not send a requester identity to change ownership.

### 7.3 Requester Ticket Detail additions

Keep Ticket facts and Attachment behavior read-only or permitted as in Lab 2, then add two distinct sections:

- `Public Comments`: visible to the Requester for the owned Ticket, chronological, append-only, with a labeled textarea and `Post public comment` action.
- `Problem Appears Resolved`: a clearly labeled action that records the Requester's indication. The control explains that IT Staff remain responsible for formal resolution or closure and does not present a status selector.

Requesters do not see Internal Notes, IT Priority controls, ownership controls, or formal status actions.

## 8. IT Staff Ticket Queue

### 8.1 Desktop structure

At desktop width, use a readable table or equivalent list inside a Zen Green panel. The recommended columns are:

| Column | Reason |
| --- | --- |
| Ticket Number | Stable identifier and detail link. |
| Created | Age and prioritization context. |
| Summary | Main problem description; give it sufficient width. |
| Category / Related System | Locate the affected area without a mega-grid. |
| Requested Priority | Preserve the Requester's original priority. |
| IT Priority | Show the operational priority. |
| Current Status | Show the workflow state as text. |
| Ticket Owner | Show assigned User or `Unassigned`. |
| Last Updated | Support queue triage. |
| Action | Visible `Open detail` action. |

If the final implementation removes a column to avoid an unreadable grid, the equivalent value must remain visible in the Ticket Detail and the change must be recorded as a reviewed UI refinement.

### 8.2 Query controls

The Queue provides:

- Search labeled `Search tickets`, covering the API's documented fields.
- Filters for status, Requested Priority, IT Priority, owner, Category, and Related System where supported by the API.
- Sort field and direction controls with a visible current selection.
- One-based pagination with page size and current result count.
- Clear filters action when a query is active.

Controls have stable labels and do not rely on placeholder text alone. Query changes show a busy state and cannot leave a previous result set presented as current without an explanatory loading state.

### 8.3 Queue states

- Initial/loading: keep the queue frame visible and announce loading.
- Empty: explain that no Tickets are currently available and distinguish this from a query with no matches.
- No results: show the active query summary and Clear filters.
- Forbidden: explain that the role cannot use the queue and do not show Ticket data.
- Invalid query: identify the invalid control and keep other safe query values.
- Failure: explain that the queue could not load and offer Retry.
- Ready: show owner, status, Requested Priority, and IT Priority as text plus supporting badge treatment.

### 8.4 Mobile representation

Below the desktop table width, use a stacked Ticket card or responsive row. Each card keeps Ticket Number, Summary, status, both priorities, owner, last update, and Open detail. No required value is hidden behind hover, clipping, or a precision-only icon.

## 9. IT Staff Ticket Detail

### 9.1 Information hierarchy

1. Ticket Number heading, current status, and back-to-Queue action.
2. Read-only Requester and Ticket facts: date, Category, Related System, Requested Priority, Summary, Description, and Last Updated.
3. Operational panel for owner, IT Priority, and permitted status action.
4. Public Comments panel.
5. Internal Notes panel with a private-information warning.
6. Existing Attachments panel with the Lab 2 permissions and metadata.
7. Requester Problem Appears Resolved indication, clearly identified as a Requester signal rather than a formal status.

### 9.2 Operational controls

- `Claim` appears only for an unassigned Ticket and assigns the authenticated IT Staff User.
- `Assign`/`Reassign` uses a labeled control containing only eligible active IT Staff or Administrator targets. The selected owner is displayed as text after success.
- IT Priority is a labeled select with `LOW`, `MEDIUM`, and `HIGH` labels. Requested Priority remains read-only.
- Status control contains only statuses permitted by the current transition matrix. The UI does not offer unlisted transitions.
- Transitions into Resolved, Closed, Reopened, or Cancelled open a confirmation step with an explicit action label.
- Unauthorized or invalid operations show safe feedback without losing unrelated Ticket data.

### 9.3 Communication panels

- Public Comments use a shared/Requester-facing heading and green communication surface.
- Internal Notes use a private heading, warning text such as `Visible only to IT Staff and Administrators`, and a visually distinct surface.
- Each entry shows author name, role where useful, and formatted creation time.
- Textareas reject empty input client-side and state the 2,000-character maximum.
- Entries are append-only. There is no edit or delete action.
- User content is rendered as escaped text with preserved line breaks; HTML is never interpreted.

## 10. Administrator User Management

### 10.1 List structure

The screen remains intentionally simple:

- Page title `User Management` and Administrator context.
- Search by name or email.
- Optional one-role filter: Requester, IT Staff, or Administrator.
- Clear filters action when active.
- User list with exactly these required columns: Name, Email, Role, Status, and Edit action.
- `Create user` action.
- Loading, empty, no-results, forbidden, conflict, and safe-failure states.

Do not add User-list pagination, multi-column sorting, multiple simultaneous filters, deletion, bulk controls, import/export, audit history, departments, or profile-photo fields.

### 10.2 Create/edit form

Create mode fields:

- Name.
- Email address.
- One Role select.
- Active checkbox or equivalent activation control.
- Initial password and confirmation.

Edit mode fields:

- Name, email, one Role, and activation state.
- A separate `Set new initial password` action with password and confirmation.

The form displays duplicate-email, invalid-role, required-field, password-policy, and safe API-failure feedback beside the relevant control. The current Administrator cannot deactivate themselves, and the UI explains a server rejection for the last active Administrator without exposing database details.

### 10.3 User-management states

- Loading list: preserve headers and announce loading.
- Empty list: explain that no Users are available and provide Create user.
- No results: show active search/filter and Clear filters.
- Saving: disable the submitted action and preserve non-secret fields.
- Success: show the created or updated User and a clear return/list action.
- Forbidden: show no User data and explain that Administrator permission is required.
- Conflict: explain duplicate email or account-safety conflict and identify the field or rule.
- Failure: preserve safe values and provide retry.

### 10.4 Administrator Ticket Review

A direct `/admin/tickets/:ticketId` view is available to an Administrator for a known Ticket ID. It is not a Queue and is not a second operational workflow. The view shows read-only Ticket facts, Requester, Category, Related System, Requested Priority, IT Priority, status, owner, Attachment metadata, Public Comments, Internal Notes, and the Requester resolution indication. Only IT Priority is editable through a clearly labelled `Save IT Priority` action.

The view does not show Claim, Assign, Reassign, status-transition, Public Comment, or Internal Note creation controls. It uses the normal loading, missing-Ticket, forbidden, validation, success, and safe-failure states. Public Comments and Internal Notes are visually distinguished, and all content is rendered as text. The server remains authoritative for both the read-only scope and the IT Priority mutation.

## 11. Responsive behavior

| Viewport | Required behavior |
| --- | --- |
| Desktop `>= 992px` | Centered content with multi-column forms and a readable Queue table where practical. |
| Tablet `768-991px` | Use two columns where useful; retain enough width for Summary, Description, names, and state messages. |
| Mobile `< 768px` | Stack fields and panels, use Ticket cards or a responsive table, keep actions touch-friendly, and prevent horizontal page scrolling. |
| All sizes | No clipped labels, overlapping messages, hidden required controls, unreadable names, or precision-only actions. |

Responsive navigation may collapse, but the current page, User/role identity, Password action, and Logout remain discoverable. Desktop Queue data may become cards only when all required fields and actions remain available.

Required visual viewport captures are:

- Desktop: `1280x900` or wider.
- Tablet: `820x900` or equivalent within the tablet range.
- Mobile: `390x844` or equivalent below the mobile breakpoint.

## 12. Accessibility contract

- Every form control has a programmatic label and an associated help/error region where needed.
- Required fields expose both a visible indicator and text validation.
- Errors are associated with controls and submission-level failures use an alert or live region.
- Loading and success changes use a polite live region unless immediate attention is required.
- Keyboard focus is visible, logical, and not trapped in a closed mobile menu or confirmation dialog.
- Buttons and links have names describing their action. Icon-only controls have accessible labels and tooltips.
- Disabled controls cannot be activated and expose why they are unavailable through nearby text when the reason is not obvious.
- Text and controls meet practical contrast requirements against their surfaces.
- Role, status, priority, comment visibility, and account state are communicated by text as well as color.
- Tables, cards, filters, dialogs, and pagination remain operable with keyboard and assistive technology.
- Password fields do not expose values in the DOM as plain explanatory text, URLs, or logs.

## 13. Visual inspection checklist and evidence

Capture final evidence under:

- `artifacts/lab-03/screenshots/authentication/`
- `artifacts/lab-03/screenshots/staff-queue/`
- `artifacts/lab-03/screenshots/staff-ticket-detail/`
- `artifacts/lab-03/screenshots/user-management/`

Inspect each major screen at desktop, tablet, and mobile widths. Record pass/fail and a short note for:

- Zen Green tokens, typography, spacing, surfaces, and reusable components.
- Current User, role badge, permitted navigation, Password, and Logout.
- Login validation, busy, invalid credential, inactive-account, password-change, and logout states.
- Requester regression with no Development Requester selector and no Change Requester action.
- Queue search, filters, sorting, pagination, status, both priorities, owner, open-detail action, empty, no-results, forbidden, and failure states.
- Ticket Detail read-only versus operational fields, ownership, status confirmation, Public Comments, Internal Notes, Attachments, and resolution indication.
- Administrator Ticket Review read-only fields, Public Comments, Internal Notes, Attachment metadata, Requester resolution indication, IT Priority edit, and forbidden/not-found behavior.
- User Management list columns, search, optional role filter, create/edit form, account-safety feedback, and forbidden behavior.
- Desktop/tablet/mobile clipping, overlap, hidden controls, and horizontal overflow.
- Keyboard order, visible focus, labels, required indicators, live regions, text alternatives, and readable dialogs.

Screenshots must be readable without extreme zoom and must be linked to actual final-branch behavior in the Lab 3 report. Do not claim a screenshot proves backend authorization; pair UI evidence with API or integration evidence.

## 14. Stable test hooks and route intent

The implementation may choose its React composition, but these user-observable labels and regions remain targetable:

| Area | Stable labels or roles |
| --- | --- |
| Login | `Email`, `Password`, `Sign in`, `Signing in`, `Invalid credentials`/safe failure region. |
| Change Password | `Current password`, `New password`, `Confirm new password`, `Save new password`, `Log out`. |
| Authenticated shell | Current User name, role badge, `Password`, `Log out`, permitted navigation. |
| Requester | `My Tickets`, `Create Ticket`, `Public Comments`, `Post public comment`, `Problem Appears Resolved`. |
| IT Staff Queue | `Search tickets`, filter labels, sort labels, pagination controls, `Open detail`, owner/status/priority text. |
| IT Staff Detail | Ticket Number heading, `Claim`, `Assign`, `Reassign`, `IT Priority`, `Status`, `Public Comments`, `Internal Notes`, confirmation action. |
| Administrator Ticket Review | Ticket Number heading, `IT Priority`, `Save IT Priority`, `Public Comments`, `Internal Notes`, read-only Ticket fields. |
| User Management | `User Management`, `Search users`, `Role`, `Create user`, `Edit`, `Set new initial password`. |

Suggested route intent is `/login`, `/change-password`, `/tickets`, `/tickets/new`, `/tickets/:ticketId`, `/staff/tickets`, `/staff/tickets/:ticketId`, `/admin/tickets/:ticketId`, and `/admin/users`. An equivalent route mechanism is acceptable only when direct navigation, server protection, and accessible navigation remain equivalent.
