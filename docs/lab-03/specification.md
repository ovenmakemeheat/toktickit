# Lab 3 engineering specification

Status: draft implementation contract for Issue #72; human review is required before Lab 3 implementation Pull Requests are completed

Origin issue: #72 - Lab 3 - Sprint specification and test plan
Applies to: Issues #72-#77 and the integrated Lab 3 result
Source: [Lab 3 requirements](requirements/UTF-8_Lab_3_sheet.pdf)
Previous contract: [Lab 2 specification](../lab-02/specification.md)

This document turns the Lab 3 handout into an implementable contract. It is intentionally narrower than the handout, keeps the Lab 2 requester increment working, and records the choices that the coding agent must follow. The companion contracts are [tests.md](tests.md), [ui-spec.md](ui-spec.md), and [api-spec.md].

## 1. Sprint goal

Deliver a secure, responsive TokTickIT increment in which real Users sign in with an email address and password, complete a mandatory first-login password change when required, and see only the role-appropriate application. Requesters retain the Lab 2 ticket and attachment experience through their authenticated identity; IT Staff receive an operational Ticket Queue and Ticket Detail workflow; and Administrators receive the required minimalist User Management screen.

## 2. Stakeholder request

Replace the temporary Development Requester selector with real authentication. A user with an initial password must choose a new password before entering the normal application. Requesters must continue to create and manage only their own Tickets and Attachments. IT Staff need a shared queue, detail operations, ownership, IT Priority, permitted status changes, Public Comments, and private Internal Notes. Administrators need a simple way to list, search, create, edit, activate, deactivate, and initialize Users. Every API and screen must enforce role and ownership rules on the server while continuing the Zen Green design language from Lab 2.

## 3. Scope

### Included

- Real email-and-password authentication with logout, current-user retrieval, sessions, safe credential failures, and mandatory first-login password change.
- Exactly one role per User: `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`.
- Server-side role authorization and ownership checks for every protected endpoint and screen.
- Migration of Lab 2 Development Requesters to authenticated Requester Users without losing Ticket or Attachment ownership.
- Repeat-safe Lab 3 seed data with active and inactive Requesters, active and inactive IT Staff, an active Administrator, realistic Tickets, Public Comments, and Internal Notes.
- Authenticated continuation of the Lab 2 Requester Ticket and Attachment functions with the Development Requester selector and Change Requester action removed.
- Requester Public Comments and the Problem Appears Resolved indication without allowing a Requester to formally resolve or close a Ticket.
- IT Staff Ticket Queue with search, suitable filters, sorting, pagination, ownership information, status, priorities, and clear operational states.
- IT Staff Ticket Detail with claim or reassign, IT Priority, permitted status transitions, Public Comments, Internal Notes, existing Attachments, and safe validation.
- Administrator Ticket Review for a known Ticket ID with read-only access to Ticket facts, Public Comments, Internal Notes, Attachment metadata, and Requester resolution indication, plus the handout-required IT Priority update.
- Minimalist Administrator User Management with listing, name/email search, optional one-role filter, create, basic edit, activation/deactivation, initial-password setting, and account-safety rules.
- Zen Green extensions, responsive behavior, accessibility, automated tests, E2E tests, and final evidence planning.

### Explicitly excluded

- Email invitations, password-reset email, multi-factor authentication, social login, and single sign-on.
- Self-registration and Requester-created accounts.
- Actions Taken by IT Staff.
- Formal SLA calculation, escalation rules, and notification services.
- Dashboards and KPI analytics beyond simple queue counts.
- Multi-tenant organizations, departments, and customer administration.
- Production-grade deployment or cloud infrastructure changes.
- Multiple roles assigned to one User.
- User deletion, bulk User operations, User import/export, and account-history screens.
- Department, organization, profile-photo, and other extended User-profile management.
- Email delivery of initial passwords or reset links.
- Account unlocking, Administrator approval workflows, and advanced identity-management functions.
- Mandatory User-list pagination, multi-column sorting, and multiple simultaneous User-list filters.

## 4. Functional requirements

| ID | Requirement |
| --- | --- |
| FR-01 | The API authenticates an active User with a normalized email address and password. |
| FR-02 | Invalid credentials and inactive accounts receive safe, documented failures without password, hash, session, or unnecessary account data. |
| FR-03 | A successful login establishes an authenticated session and returns only the public User identity and role. |
| FR-04 | An authenticated User can retrieve the current User and can log out so the session cannot be reused. |
| FR-05 | A User marked `mustChangePassword` can use only the password-change flow until a valid new password is saved. |
| FR-06 | Password hashing, password validation, session expiration, session invalidation, and state-changing request protection are enforced by the server. |
| FR-07 | The server authorizes every protected operation by role and, for Requester resources, by the authenticated User identity. |
| FR-08 | The authenticated shell displays the current User and role and exposes only the navigation permitted by that role. |
| FR-09 | Lab 2 Development Requesters are migrated to Requester Users while preserving every Ticket and Attachment ownership relationship. |
| FR-10 | Re-running migration and seed operations is safe and does not duplicate Users, Tickets, comments, notes, or ownership links. |
| FR-11 | An authenticated Requester can create, list, view, upload, download, and soft-remove only their own Lab 2 Tickets and Attachments. |
| FR-12 | Requester operations derive ownership from the session; a client-supplied `requesterId` cannot change the scope. |
| FR-13 | The Development Requester selector and Change Requester action are absent from the Lab 3 Requester flow. |
| FR-14 | A Requester can append a Public Comment to an owned Ticket and indicate that the problem appears resolved. |
| FR-15 | The Requester resolution indication does not formally change a Ticket to `RESOLVED` or `CLOSED`. |
| FR-16 | IT Staff can retrieve a shared Ticket Queue containing realistic work and the approved search, filters, sorting, pagination, owner, status, and priority information. |
| FR-17 | IT Staff can open Ticket Detail, claim an unassigned Ticket, and assign or reassign its primary owner to an eligible active IT Staff or Administrator. |
| FR-18 | IT Staff or an Administrator can set IT Priority, which initially copies Requested Priority; only IT Staff can perform the approved Ticket status transitions. |
| FR-19 | IT Staff can append Public Comments and Internal Notes; Internal Notes are never returned to Requesters. |
| FR-20 | Public Comments are visible to Requesters for their own Tickets, IT Staff, and Administrators; Internal Notes are visible only to IT Staff and Administrators. |
| FR-21 | The Administrator can list Users with Name, Email, Role, Status, and an Edit action. |
| FR-22 | The Administrator can search Users by name or email and optionally apply one role filter. |
| FR-23 | The Administrator can create a User with a valid name, unique email, one permitted role, activation state, and initial password. |
| FR-24 | The Administrator can edit a User's name, email, role, and activation state. |
| FR-25 | The Administrator can set a new initial password that is stored as a hash and requires password change at the next login. |
| FR-26 | The server rejects duplicate email addresses, invalid roles, self-deactivation, and removal or deactivation of the last active Administrator. |
| FR-27 | The data model supports User credentials, one role, sessions, Requester ownership, Ticket ownership, IT Priority, all required statuses, Public Comments, Internal Notes, and migration relationships. |
| FR-28 | The API distinguishes unauthenticated, forbidden, invalid-input, missing-resource, conflict, and unexpected-failure cases with safe error bodies. |
| FR-29 | New screens reuse the Lab 2 Zen Green tokens, components, form conventions, badges, state messaging, responsive rules, and accessibility expectations. |
| FR-30 | Login, password change, authenticated Requester, IT Staff Queue, IT Staff Ticket Detail, comments/notes, and User Management expose meaningful processing, validation, success, empty, no-results, forbidden, not-found, conflict, and safe-failure feedback where applicable. |
| FR-31 | The required screens remain usable on desktop, tablet, and mobile without clipping, overlap, hidden required controls, or horizontal overflow. |
| FR-32 | Automated unit, API/integration, UI, authorization/security, migration/regression, responsive, accessibility, visual, and E2E tests cover the approved contract. |

## 5. Roles and authorization matrix

Authorization is a server decision. Hiding or disabling a client control is useful feedback but never replaces the API check. A `401` means there is no usable authenticated session. A `403` means the session is valid but the role or password-change state does not permit the operation. Requester ownership failures use a non-disclosing `404` where the API could otherwise reveal another User's resource.

| Operation | Requester | IT Staff | Administrator |
| --- | --- | --- | --- |
| Login, logout, current User, password change | Own session | Own session | Own session |
| Lab 2 reference data | Yes | Yes when needed by an allowed screen | No dedicated screen |
| Create/list/view own Tickets and Attachments | Own resources only | No Requester context | No Requester context |
| Create Public Comment | Own Tickets | Any permitted Ticket | No |
| Read Public Comments | Own Tickets | Permitted Tickets | Permitted read-only Ticket access |
| Indicate Problem Appears Resolved | Own Tickets | No | No |
| IT Staff Ticket Queue | No | Yes | No queue in this contract |
| IT Staff Ticket Detail operations | No | Yes | No mutation |
| Administrator Ticket Review | No | No | Yes, read-only for any existing Ticket |
| Claim, assign/reassign, Ticket status | No | Yes | No mutation |
| IT Priority | No | Yes | Yes, through the Administrator Ticket Review operation only |
| Read Internal Notes | No | Yes | Yes |
| Create Internal Notes | No | Yes | No |
| User list/search/filter/create/edit/activation | No | No | Yes |
| Set another User's initial password | No | No | Yes |

Administrator and IT Staff responsibilities remain conceptually separate. Administrators have the narrow, handout-required ability to review any existing Ticket and change only its IT Priority; they do not receive the IT Staff Queue, claim/reassign, status, Public Comment, or Internal Note creation workflow. An active Administrator is also a valid Ticket owner or assignment target because the data contract requires that owner domain, but that fact does not grant additional IT Staff permissions.

## 6. Business rules

### Identity and authentication

| ID | Rule |
| --- | --- |
| BR-01 | Only an active User with valid credentials may authenticate. |
| BR-02 | A User with `mustChangePassword = true` cannot enter normal application screens until a valid new password is saved. |
| BR-03 | The authenticated session identity, not a `requesterId` supplied by the client, determines Requester ownership. |
| BR-04 | Login failures do not reveal whether an unknown email, wrong password, or other credential detail caused the failure. A valid credential for an inactive account receives a clear but minimal inactive-account response. |
| BR-05 | Emails are trimmed, normalized to lowercase, and unique. Passwords are never stored, returned, logged, or placed in client code in plaintext. |
| BR-06 | Passwords are 12-128 characters, contain at least one letter, one number, and one non-alphanumeric character, and the confirmation must match for create/change operations. |
| BR-07 | Sessions use an opaque random cookie value, expire after the documented lifetime, and are invalidated on logout. A successful password change or Administrator initial-password reset revokes every existing session for the affected User and creates a fresh session only for the current password-change request when applicable. Expired or revoked sessions cannot access protected resources. |
| BR-08 | State-changing requests require the session CSRF token and same-origin browser behavior documented in `api-spec.md`. |
| BR-09 | A newly set initial password sets `mustChangePassword = true`; a successful first-login change clears it. |

### Migration and data

| ID | Rule |
| --- | --- |
| BR-10 | Every migrated Development Requester becomes exactly one Requester User matched by normalized email. Existing Ticket and Attachment IDs and ownership remain unchanged in meaning. |
| BR-11 | New Tickets store the authenticated Requester User as their requester and never trust an owner identity from the request body. |
| BR-12 | One User has exactly one role. Lab 3 does not support role arrays, role history, or multi-role assignment. |
| BR-13 | A Ticket has zero or one primary owner. If present, the owner is an active IT Staff or Administrator. A new Ticket may be unassigned. |
| BR-14 | Requested Priority remains the value submitted by the Requester. IT Priority is initialized to the same value and may be changed only by an authorized IT Staff or Administrator operation. |
| BR-15 | Required statuses are `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`. |
| BR-16 | Lab 3 does not add Actions Taken; any later rule depending on incomplete Actions Taken is deferred to Lab 4. |

### Ticket workflow and communication

| ID | Rule |
| --- | --- |
| BR-17 | IT Staff or an Administrator can change IT Priority through an authorized operation; only IT Staff can change Ticket status. Requesters cannot formally resolve or close Tickets. |
| BR-18 | Public Comments are visible to Requester, IT Staff, and Administrator according to the authorization matrix. Internal Notes are visible only to IT Staff and Administrator. |
| BR-19 | Public Comments and Internal Notes are append-only. Each entry records the backend-authenticated author and creation time. Editing and deletion are excluded. |
| BR-20 | Comment and note content is trimmed, rejects empty or whitespace-only input, has a maximum of 2,000 characters, and is rendered as text rather than executable markup. |
| BR-21 | A Requester Problem Appears Resolved action records an indication timestamp and author through the backend. It does not set `RESOLVED` or `CLOSED`. Repeating the indication is idempotent. |
| BR-22 | Status changes must appear in the approved transition matrix. Transitions into `RESOLVED`, `CLOSED`, `REOPENED`, or `CANCELLED` require an explicit confirmation value. Invalid transitions do not partially update the Ticket. |
| BR-23 | Claiming is allowed only for an unassigned Ticket. Assigning or reassigning requires an active IT Staff or Administrator target; inactive or unknown targets are rejected. |

### Administrator account safety

| ID | Rule |
| --- | --- |
| BR-24 | Administrator User Management is limited to listing, name/email search, one optional role filter, create, basic edit, activation/deactivation, and setting a new initial password. |
| BR-25 | A User cannot be assigned an invalid role or more than one role. Duplicate normalized email addresses return a safe conflict. |
| BR-26 | An Administrator cannot deactivate their own account. The system cannot deactivate or remove the last active Administrator, and it rejects a role or activation update that would leave an existing Ticket owned by an inactive or Requester User. User deletion is not available; deactivation is used instead. |

### Seed, errors, and scope

| ID | Rule |
| --- | --- |
| BR-27 | Seed behavior is idempotent and includes at least four active Requesters, one inactive Requester, three active IT Staff, one inactive IT Staff, one active Administrator, realistic Tickets across statuses/priorities/owners, and safe example comments/notes. |
| BR-28 | API errors use the common safe envelope, contain no stack trace, password, token, storage path, or private note content, and do not disclose another Requester's protected resources. |
| BR-29 | Lab 3 does not implement the excluded email, identity-management, SLA, organization, dashboard, bulk, history, or infrastructure features. |

### Status transition matrix

All transitions in this matrix are performed by IT Staff. The `confirmation` request field is required and must be `true` for transitions marked `Yes`.

| From | To | Confirmation | Notes |
| --- | --- | --- | --- |
| `NEW` | `OPEN` | No | Staff begins queue handling. |
| `NEW` | `CANCELLED` | Yes | The cancellation reason is shown in the UI feedback; no event-log feature is added. |
| `OPEN` | `IN_PROGRESS` | No | Staff starts work. |
| `OPEN` | `WAITING_FOR_REQUESTER` | No | More information is needed from the Requester. |
| `OPEN` | `RESOLVED` | Yes | Staff declares the operational work resolved. |
| `OPEN` | `CANCELLED` | Yes | Staff cancels the Ticket. |
| `IN_PROGRESS` | `OPEN` | No | Return to the open queue. |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER` | No | Waiting for Requester information. |
| `IN_PROGRESS` | `RESOLVED` | Yes | Staff declares the operational work resolved. |
| `IN_PROGRESS` | `CANCELLED` | Yes | Staff cancels the Ticket. |
| `WAITING_FOR_REQUESTER` | `OPEN` | No | Work is ready to be picked up again. |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS` | No | Staff resumes work. |
| `WAITING_FOR_REQUESTER` | `RESOLVED` | Yes | Staff resolves with the required confirmation. |
| `WAITING_FOR_REQUESTER` | `CANCELLED` | Yes | Staff cancels with the required confirmation. |
| `RESOLVED` | `CLOSED` | Yes | Formal closure requires confirmation. |
| `RESOLVED` | `REOPENED` | Yes | A resolved Ticket needs more work. |
| `CLOSED` | `REOPENED` | Yes | A closed Ticket is explicitly reopened. |
| `REOPENED` | `OPEN` | No | Return to the open queue. |
| `REOPENED` | `IN_PROGRESS` | No | Staff resumes work directly. |
| `REOPENED` | `WAITING_FOR_REQUESTER` | No | Staff needs Requester information. |
| `REOPENED` | `RESOLVED` | Yes | Staff resolves again. |
| `REOPENED` | `CANCELLED` | Yes | Staff cancels again. |
| `CANCELLED` | `REOPENED` | Yes | Explicitly reopen a cancelled Ticket. |

Any transition not listed is rejected as `TICKET_STATUS_TRANSITION_INVALID`. A same-status update is rejected as invalid input rather than silently changing data.

## 7. UI specification summary

The complete visual and interaction contract is in [ui-spec.md](ui-spec.md). The Lab 3 application contains these user-visible areas:

| Area | Required behavior |
| --- | --- |
| Login | Email/password form, validation, busy state, safe failure, inactive-account response, and no normal shell before authentication. |
| Change Password | Mandatory first-login flow with password rules, confirmation, validation, success, and no bypass to normal screens. |
| Authenticated shell | TokTickIT identity, current User, role badge, permitted navigation, password action, and Logout. |
| Requester workspace | Lab 2 My Tickets, Create Ticket, Ticket Detail, Attachments, Public Comments, and Problem Appears Resolved using authenticated ownership. |
| IT Staff Queue | Search, filters, sorting, pagination, owner/status/priority information, open-detail action, and designed loading/empty/no-results/failure states. |
| IT Staff Ticket Detail | Read-only ticket facts plus permitted ownership, IT Priority, status, comments, notes, attachments, and requester-resolution indication. Public and private communication are visually distinct. |
| Administrator Ticket Review | Direct read-only lookup for any existing Ticket, including Public Comments, Internal Notes, Attachment metadata, and Requester resolution indication; only IT Priority may be edited. |
| Administrator User Management | Minimalist list and create/edit flow with Name, Email, Role, Status, Edit, search, optional role filter, account safety, and safe feedback. |

Every screen uses text plus non-color cues for role, status, priority, success, warning, and error. The application does not present unauthorized destinations or controls as available.

## 8. Data changes

### Models and fields

| Model | Required design |
| --- | --- |
| `User` | `id`, `name`, normalized unique `email`, one `role`, `passwordHash`, `active`, `mustChangePassword`, `createdAt`, `updatedAt`. |
| `Session` | `id`, `userId`, unique hash of opaque session token, `expiresAt`, nullable `revokedAt`, `createdAt`; raw tokens are never persisted. |
| `Category` | Preserve Lab 2 rows, names, IDs, and active behavior. |
| `RelatedSystem` | Preserve Lab 2 rows, names, IDs, and active behavior. |
| `Ticket` | Preserve existing identity and requester ownership; add or rename the authenticated `requesterUserId`, nullable `primaryOwnerUserId`, `itPriority`, expanded `currentStatus`, nullable `requesterResolutionIndicatedAt`, and existing timestamps. |
| `Attachment` | Preserve existing rows, ownership through Ticket, generated storage key, safe display metadata, active/removed state, and removal reason. |
| `PublicComment` | `id`, `ticketId`, `authorUserId`, trimmed `content`, `createdAt`; append-only. |
| `InternalNote` | `id`, `ticketId`, `authorUserId`, trimmed `content`, `createdAt`; append-only. |

Use database enums or equivalent constrained values for `Role`, `RequestedPriority`/`ITPriority`, and `TicketStatus`. IDs remain positive JSON integers and timestamps are UTC ISO 8601 values at the API boundary.

### Relationships and indexes

- One Requester User owns many submitted Tickets; every Ticket has exactly one Requester after migration.
- One Ticket has zero or one primary owner; the owner must be an active IT Staff or Administrator.
- One Ticket has many Attachments, Public Comments, and Internal Notes.
- Each Comment and Note has one backend-authenticated author.
- Existing Categories, Related Systems, Tickets, and Attachments remain valid after migration.
- Unique constraints apply to normalized User email, session token hash, and any existing unique Ticket fields.
- Index `Ticket(requesterUserId, ticketDate, id)` for Requester ownership and deterministic ordering.
- Index `Ticket(primaryOwnerUserId, currentStatus, updatedAt, id)` for the IT Staff Queue.
- Indexes on `Ticket(currentStatus)`, `Ticket(itPriority)`, `Ticket(requestedPriority)`, `Ticket(categoryId)`, and `Ticket(relatedSystemId)` support approved queue filters.
- Index `PublicComment(ticketId, createdAt, id)` and `InternalNote(ticketId, createdAt, id)` support append-only chronological retrieval.
- Index `Session(userId, expiresAt)` supports expiration and logout cleanup.

### Migration strategy

1. Preflight the existing database and record Development Requester, Ticket, and Attachment counts.
2. Create the `User`, `Session`, `PublicComment`, and `InternalNote` structures and the new role/status values without deleting Lab 2 data.
3. Add a nullable authenticated Requester foreign key to Ticket, then create one Requester User for each Development Requester matched by normalized email. Existing users are not duplicated on rerun.
4. Generate a cryptographically random one-time initial password for migrated Users, store only its hash, set `mustChangePassword = true`, and write the password only to the explicit local handoff workflow below. No migration password is committed to the repository, terminal history, or application logs.
5. Backfill every Ticket's authenticated Requester foreign key from its Development Requester relationship and verify that every Ticket and Attachment remains reachable by the same person.
6. Copy `requestedPriority` into `itPriority` for existing Tickets. Preserve `NEW` as `NEW`; map no later Lab 2 status because Lab 2 had no later status transitions.
7. Validate zero orphaned ownership links and equal before/after Ticket and Attachment counts. Only then make the authenticated Requester foreign key required.
8. Remove the selector and old Development Requester dependency from application code. The old table may be removed only after the backfill and verification are complete; no API or UI path may continue to use it as identity.

The migration is repeat-safe: a User is matched by normalized email, a Ticket is backfilled only when its authenticated owner is absent, and reruns fail safely if a consistency check detects conflicting ownership instead of overwriting data.

### Migrated-password handoff workflow

The migration command must make the local credential handoff explicit and verifiable:

1. The operator runs the migration with an explicit handoff path outside tracked source, for example `server/.local/lab3-migration-handoff.json`. The command refuses a path that is tracked or not ignored and refuses to overwrite an existing handoff file.
2. For each newly migrated User, the command generates a cryptographically random one-time password using the server's password generator, stores only its salted scrypt hash, and writes `{ email, initialPassword }` to the handoff file. Existing Users are not regenerated on a repeat run.
3. The handoff file is created with owner-only permissions where the local platform supports them. The command prints only a count and a non-secret file path; passwords never appear in stdout, application logs, Git history, or error messages.
4. The local operator opens the ignored file locally and delivers each credential out of band to the corresponding local tester. Lab 3 does not implement email delivery. The tester signs in once, is forced to Change Password, and chooses a new password.
5. The operator verifies the handoff by confirming that each migrated email can complete the first-login flow and that `mustChangePassword` becomes `false`. Automated migration tests verify that the database contains a hash rather than the plaintext and that ownership/count checks pass.
6. After all handoffs are verified, the operator securely deletes the local handoff file. If a credential is lost, an Administrator uses the approved Set New Initial Password operation; migration does not expose or regenerate existing plaintext passwords.

The exact command name and ignored local path may follow the repository's script conventions, but the implementation must preserve these generation, delivery, verification, and cleanup guarantees.

### Seed decisions

The seed uses stable `.test` emails and deterministic fixture keys. It must include at least:

- four active Requesters and one inactive Requester;
- three active IT Staff and one inactive IT Staff;
- one active Administrator;
- Tickets distributed across Requesters, all required statuses, Requested/IT Priorities, and assigned/unassigned owners;
- safe example Public Comments and Internal Notes;
- local-only credentials supplied through the documented development/test environment, with password hashes stored in the database and no real personal secrets in the repository.

## 9. API contract summary

The detailed wire contract is in [api-spec.md](api-spec.md). The API is served under `/api`; the Express app remains importable from `server/src/app.ts`, and listener startup remains in `server/src/index.ts`.

| Capability | Route family |
| --- | --- |
| Login/logout/current User/password change | `/api/auth/*` |
| Lab 2 reference data | `GET /api/categories`, `GET /api/related-systems` |
| Authenticated Requester Tickets | `/api/tickets*` |
| Requester Attachments | `/api/tickets/:ticketId/attachments*` |
| Public Comments | `/api/tickets/:ticketId/comments` |
| Problem Appears Resolved | `/api/tickets/:ticketId/resolution-indication` |
| IT Staff Queue and operations | `/api/staff/tickets*` |
| Internal Notes | `/api/tickets/:ticketId/internal-notes` |
| Administrator Ticket Review and IT Priority | `/api/admin/tickets*` |
| Administrator User Management | `/api/admin/users*` |

## 10. Acceptance criteria

| ID | Given / When / Then |
| --- | --- |
| AC-01 | Given an active User with valid credentials, when the User logs in, then the server establishes authenticated access and returns the permitted public identity and role. |
| AC-02 | Given invalid credentials, when login is attempted, then the response is safe and generic and no session is created. |
| AC-03 | Given a valid credential for an inactive User, when login is attempted, then access is rejected with a clear minimal inactive-account response and no normal session is granted. |
| AC-04 | Given an authenticated User, when current User or logout is requested, then current identity is returned safely and logout invalidates the session. |
| AC-05 | Given a User who must change an initial password, when login succeeds, then normal application APIs and screens remain unavailable until a valid password change succeeds. |
| AC-06 | Given a password change request, when the old password, new password, confirmation, or policy is invalid, then no password state changes and field-safe errors are returned. |
| AC-07 | Given a valid session, when a role-forbidden endpoint is called directly, then the server returns `403` without relying on hidden UI controls. |
| AC-08 | Given a logged-in User, when the shell renders, then the User name, role, Logout, password action, and only permitted navigation are visible. |
| AC-09 | Given a Lab 2 database, when migration runs, then Development Requesters become Requester Users and every Ticket and Attachment retains its original ownership and identity. |
| AC-10 | Given migration or seed is run repeatedly, when the database is inspected, then no duplicate Users, Tickets, comments, notes, or ownership links are created. |
| AC-11 | Given an authenticated Requester, when Ticket or Attachment operations are requested, then the server uses the session User and never accepts a client requester identity. |
| AC-12 | Given Requesters A and B own different Tickets, when A requests B's Ticket, Attachment, or Internal Note, then no protected data is disclosed and the operation is rejected safely. |
| AC-13 | Given an authenticated Requester, when the Requester uses the Lab 2 workflow, then create, list, detail, upload, download, soft removal, and ownership behavior continue without the Development Requester selector. |
| AC-14 | Given an owned Ticket, when the Requester posts a Public Comment or indicates Problem Appears Resolved, then the append-only communication or indication is recorded and the Ticket is not formally resolved or closed by that action. |
| AC-15 | Given an IT Staff session, when the Queue is requested, then realistic Tickets are returned with approved search, filters, sorting, pagination, owner, status, and priority information. |
| AC-16 | Given valid and invalid Queue query parameters, when the Queue is requested, then valid queries are deterministic and invalid queries return documented validation errors. |
| AC-17 | Given an IT Staff User and an unassigned Ticket, when claim is requested, then the Ticket becomes owned by the authenticated IT Staff User. |
| AC-18 | Given an IT Staff User, when assignment or reassignment targets an inactive or invalid User, then the server rejects it and preserves the existing owner. |
| AC-19 | Given a Ticket, when IT Staff or an Administrator changes IT Priority through the permitted operation, then the initial value equals Requested Priority, Requested Priority remains unchanged, and unauthorized roles are rejected. |
| AC-20 | Given a Ticket in a matrix source status, when IT Staff requests an allowed or disallowed transition, then only allowed transitions with required confirmation update the Ticket. |
| AC-21 | Given an existing Ticket, when an Administrator uses the Ticket Review endpoint, then Ticket facts, Public Comments, and Internal Notes are readable and only IT Priority may be changed through its separate operation; Requesters still cannot read Internal Notes and both collections remain append-only. |
| AC-22 | Given an Administrator session, when User Management is opened, then the list shows Name, Email, Role, Status, and Edit and supports name/email search plus one optional role filter. |
| AC-23 | Given valid User data, when an Administrator creates a User, then exactly one role, activation state, and an initial password are saved with a secure hash. |
| AC-24 | Given an existing User, when an Administrator edits name, email, role, or activation state, then valid changes persist, duplicate emails or invalid roles are rejected safely, and an update that would make an existing Ticket owner ineligible is rejected atomically. |
| AC-25 | Given an Administrator sets a new initial password, when that User logs in, then the User must complete password change before normal application access. |
| AC-26 | Given an Administrator attempts self-deactivation or deactivation of the last active Administrator, when the request is submitted, then the server rejects it and preserves account safety. |
| AC-27 | Given meaningful processing, validation, success, empty, no-results, forbidden, not-found, conflict, and safe-failure paths, when each relevant screen is used, then the UI explains the state and offers the appropriate next action. |
| AC-28 | Given the required Lab 3 screens, when viewed at desktop, tablet, and mobile sizes, then the Zen Green layout has no clipping, overlap, hidden required control, or horizontal overflow. |
| AC-29 | Given keyboard and assistive-technology use, when the required screens are operated, then labels, required indicators, focus, live states, button names, badges, and editable/read-only distinctions are available without color alone. |
| AC-30 | Given the complete Lab 3 increment, when the planned automated tests and E2E flows run on the integrated branch, then the accepted contract is covered by actual passing results and the final evidence package can trace each result to this specification. |

Every criterion maps to one or more planned tests in [tests.md](tests.md). A test may cover multiple criteria, but no criterion may remain without a planned test.

## 11. Product Definition of Done

- [ ] This specification, `tests.md`, `ui-spec.md`, and `api-spec.md` have been reviewed and approved before implementation PR completion.
- [ ] Every FR, BR, and AC has a stable identifier and at least one planned test.
- [ ] Migration preserves Lab 2 Ticket and Attachment identity and ownership, is repeat-safe, and has automated regression evidence.
- [ ] Passwords are securely hashed, sessions are protected and invalidated on logout, first-login change is mandatory, and secrets are absent from source control.
- [ ] Backend authorization protects every endpoint, including direct calls, role boundaries, Requester ownership, Internal Notes, and Administrator safety.
- [ ] Administrator read-only Ticket Review and IT Priority access are explicit, tested, and do not grant the separate IT Staff Queue/status workflow.
- [ ] Requester regression removes the temporary selector while preserving permitted Lab 2 Ticket and Attachment functions.
- [ ] IT Staff Queue and Ticket Detail implement the approved query, ownership, priority, status, comment, note, validation, and safe-error contracts.
- [ ] Administrator User Management implements only the minimalist approved feature set and enforces duplicate-email and last-Administrator safety rules.
- [ ] Zen Green UI, responsive, accessibility, loading, empty, no-results, forbidden, not-found, conflict, success, and failure behavior is implemented and inspected.
- [ ] Unit, API/integration, UI, authorization/security, migration/regression, responsive, accessibility, visual, and E2E tests pass on the integrated branch.
- [ ] `reviewer.md` records the human reviewer, linked PRs, review comments, author responses, approvals, and merge evidence; automation is not treated as approval.
- [ ] `ai-use.md` records the LLM, selected prompts, reflection, and human responsibility.
- [ ] The Lab 3 Project board uses `Backlog`, `Specified`, `Started`, `PR Review`, `Fixing`, and `Done`; an Issue reaches `Done` only after acceptance, tests, peer review, and merge into `lab3-staging`.
- [ ] Each feature PR targets `lab3-staging`, links its Issue, has every review comment answered, and is merged by the reviewer rather than the PR author.
- [ ] Integration testing passes on `lab3-staging`, then a separately reviewed release PR is prepared from `lab3-staging` to `main`.
- [ ] One concise PDF contains `Answer Part 1` through `Answer Part 9` in order with working links and readable screenshots.

### Repository deliverable timing

The Lab 3 handout requires `reviewer.md` and `ai-use.md` in the final repository structure. They are intentionally deferred from Issue #72 because this PR establishes the pre-implementation contract; Issue #77 owns the final review/evidence package. PR #78 records that deferral explicitly, and both files must exist before the Lab 3 release PR is completed.

## 12. Assumptions and decisions

- Use an opaque, database-backed session cookie named `toktickit_session`. The raw random token is held by the browser; only a hash is stored in `Session`.
- Use Node's built-in `crypto.scrypt` with a per-password random salt for password hashing so the server remains Node-compatible without committing a new native dependency. Password comparison is timing-safe.
- Use `HttpOnly`, `SameSite=Lax`, and `Secure` in production for the session cookie. Use a session-bound CSRF token in `X-CSRF-Token` for state-changing requests; the API contract defines how the client obtains it.
- Store normalized email addresses as the unique identity key. IDs remain integers to preserve the Lab 2 database convention.
- Use UTC ISO 8601 timestamps at the API boundary and deterministic `id` tie-breakers for lists.
- Use the status transition matrix in this document as the approved Lab 3 workflow. No unlisted transition is inferred from a button or client state.
- Allow IT Staff to operate the shared Ticket workflow without restricting actions to the current Ticket owner. Ownership records responsibility; the queue remains shared.
- Keep Administrator access conceptually separate from IT Staff operations. Administrators can read any existing Ticket and its Public Comments/Internal Notes through the dedicated read-only endpoint and can change only IT Priority, as required by the handout; they do not receive Queue, ownership, status, Public Comment, or Internal Note creation permissions.
- Use a maximum of 2,000 characters for Public Comments and Internal Notes. Render content as escaped text with preserved line breaks; do not accept HTML or Markdown as executable input.
- Queue filters support one search string, individual field filters, one sort field/direction, and one page/page-size pair. This does not add the excluded advanced User-list features.
- Local seed credentials are supplied through an uncommitted development/test environment variable and are documented as local-only. The repository stores hashes and fixture account names, never real personal credentials.
- Existing Lab 2 Categories, Related Systems, Ticket numbers, Ticket dates, Attachments, and Requester-owned data are the source of truth during migration. No data reset or destructive migration is allowed.
