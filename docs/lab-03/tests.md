# Lab 3 Test DD and traceability plan

Status: planned before implementation for Issue #72; no result in this document is reported as passing yet
Origin issue: #72 - Lab 3 - Sprint specification and test plan
Contract: [specification.md](specification.md)
UI contract: [ui-spec.md](ui-spec.md)
API contract: [api-spec.md](api-spec.md)

This is the test plan for the Lab 3 increment. It is created before feature implementation so that tests are derived from the approved contract rather than reconstructed from generated code. The `Final status` column must be updated only with actual execution evidence on the integrated branch.

## 1. Test strategy

Lab 3 is accepted only when the behavior is covered at the right boundary:

- Unit tests verify password boundaries, hashing behavior, session/CSRF helpers, query parsing, migration mapping, safe text validation, and the Ticket status transition matrix without starting a server.
- API/integration tests use Supertest against the importable Express app and an isolated PostgreSQL test database. They verify authentication, server-side authorization, ownership, migration, seed behavior, validation, safe errors, and persistence.
- Client UI tests use Vitest and Testing Library at the user-observable boundary. They verify labels, role navigation, form states, feedback, Requester regression, Queue, Ticket Detail, Administrator Ticket Review, User Management, and keyboard-accessible behavior.
- Style and responsive tests verify Zen Green tokens, shared components, viewport-specific representations, no horizontal overflow, and accessible control names.
- End-to-end tests use Playwright against the integrated application and seeded local data. They verify complete role workflows, direct navigation protection, and evidence capture.
- Manual visual inspection verifies the rendered desktop, tablet, and mobile screenshots against `ui-spec.md`. A screenshot is not treated as proof of backend authorization without a matching API result.

All tests must use local `.test` fixture accounts and isolated data. Tests must not use real personal credentials, production data, or committed plaintext passwords.

## 2. Test data and isolation

The Lab 3 test fixture provides stable accounts with unique test markers:

| Fixture | Role/state | Purpose |
| --- | --- | --- |
| Requester A | Active Requester | Own-ticket success and first-login flow. |
| Requester B | Active Requester | Cross-Requester ownership isolation. |
| Requester C/D | Active Requester | Seed count and queue distribution. |
| Inactive Requester | Inactive Requester | Inactive-account rejection. |
| IT Staff A | Active IT Staff | Queue, claim, status, comments, and notes. |
| IT Staff B/C | Active IT Staff | Assignment and reassignment. |
| Inactive IT Staff | Inactive IT Staff | Invalid owner and inactive-login checks. |
| Administrator | Active Administrator | User Management, read-only Ticket Review, IT Priority maintenance, and permitted communication visibility. |

Fixture requirements:

- Each test suite resets or isolates its database state using the repository's test-database setup. A test must not rely on execution order or data created by another file.
- Seeded passwords come from an uncommitted test/development environment variable. Test output may identify fixture names but must not print passwords, session values, CSRF values, hashes, or cookies.
- Tickets cover every required status, all priorities, assigned and unassigned ownership, at least two Requesters, Attachments, Public Comments, and Internal Notes.
- Migration fixtures start from Lab 2-shaped Development Requester, Ticket, and Attachment data so counts, IDs, ownership, and repeat safety can be verified.
- Tests that create records use a unique marker and clean up through the isolated database rather than relying on a global shared database.
- Migration handoff verification uses an ignored local handoff file, confirms no plaintext password appears in logs or tracked files, exercises first-login password change, and deletes the handoff after verification.

## 3. Planned automated tests

`Planned` means the test is specified but implementation and execution evidence are not complete. Replace it with `Pass` or `Fail` only after recording the command, branch/commit, and relevant output.

### 3.1 Unit tests

| Test ID | Type | AC mapping | What it tests | Expected result | Planned file | Final status |
| --- | --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | AC-01, AC-02, AC-05, AC-06, AC-25 | scrypt hash/compare, password length/content rules, mismatch, and new-hash behavior | Correct passwords compare; invalid boundaries fail; plaintext is never returned | `server/tests/lab-03/auth.unit.test.ts` | Planned |
| UNIT-02 | Unit | AC-04, AC-05, AC-07, AC-25 | Opaque session expiry/revocation, sibling-session revocation, and CSRF token hash/compare | Expired/revoked sessions, password-change sibling sessions, and invalid CSRF values are rejected | `server/tests/lab-03/auth.unit.test.ts` | Planned |
| UNIT-03 | Unit | AC-16 | Staff and Requester query parsing, defaults, enum validation, page limits, and deterministic sort selection | Valid queries normalize predictably; invalid queries produce safe validation details | `server/tests/lab-03/query.unit.test.ts` | Planned |
| UNIT-04 | Unit | AC-14, AC-21 | Comment/note trim, whitespace rejection, maximum length, and plain-text handling | Empty content fails; valid content is bounded and treated as text | `server/tests/lab-03/content.unit.test.ts` | Planned |
| UNIT-05 | Unit | AC-20 | Complete Ticket status transition matrix and confirmation requirements | Listed transitions pass only for IT Staff; unlisted/final transitions fail without confirmation | `server/tests/lab-03/status-transition.unit.test.ts` | Planned |
| UNIT-06 | Unit | AC-09, AC-10 | Development Requester-to-User mapping and repeat-safe migration decision logic | Same normalized email maps once; ownership conflicts stop safely | `server/tests/lab-03/migration.unit.test.ts` | Planned |

### 3.2 API and integration tests

| Test ID | Type | AC mapping | What it tests | Expected result | Planned file | Final status |
| --- | --- | --- | --- | --- | --- | --- |
| API-01 | API | AC-01, AC-02, AC-03 | Valid login, invalid credentials, inactive account, safe response body, and cookie creation | Active login returns public User/session; invalid and inactive paths create no normal access | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-02 | API | AC-04 | Current User, session expiration, logout, revoked-session reuse, and repeat logout | Current identity is safe; logout returns `204`; revoked session cannot access protected routes | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-03 | API | AC-05, AC-06, AC-25 | Initial-password login, normal-route blocking, valid change, invalid current/new/confirmation values, and sibling-session revocation | Limited session can change only through the allowed route; successful change clears the flag, revokes prior sessions, creates a fresh current session, and sets fresh cookies | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-04 | API/security | AC-07, AC-08 | Direct role-forbidden calls, missing session, limited session, CSRF, and inactive-session checks | Server returns safe `401`/`403` before protected data or mutation is exposed | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-05 | API/migration | AC-09, AC-10 | Lab 2 migration, Ticket/Attachment ownership preservation, counts, and repeat-safe rerun | All ownership remains reachable; no duplicate Users or records are created | `server/tests/lab-03/migration.api.test.ts` | Planned |
| API-06 | API/regression | AC-11, AC-12, AC-13 | Authenticated Requester create/list/detail and attempted requester identity spoofing | Session User controls scope; own Lab 2 behavior works; cross-owner access is non-disclosing | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-07 | API | AC-13, AC-14 | Requester Public Comment and Problem Appears Resolved indication | Own Ticket accepts append-only comment/indication; status remains unchanged | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-08 | API/regression | AC-12, AC-13 | Requester Attachment upload, metadata, download, soft removal, limits, and cross-owner rejection | Lab 2 Attachment contract remains intact under authenticated ownership | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-09 | API | AC-15, AC-16 | Staff Queue search, filters, sorting, pagination, empty/no-results, and invalid query | Shared Queue returns deterministic summaries and safe query errors | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-10 | API/security | AC-17, AC-18 | Claim, assign, reassign, owner target validation, and inactive target rejection | Unassigned claim succeeds; invalid/inactive targets preserve the current owner | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-11 | API | AC-19, AC-20 | IT Priority initialization/update by IT Staff or Administrator and every allowed/disallowed status transition | Requested priority is preserved; IT Staff or Administrator priority changes persist through their permitted endpoint; only IT Staff matrix transitions with required confirmation persist | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-12 | API/security | AC-21 | Public Comment and Internal Note visibility, Administrator Ticket Review, author identity, append-only behavior, and safe rendering data | Public comments and notes follow the visibility matrix; Administrators can read any existing Ticket through the detail endpoint and have no mutation access other than the separate IT Priority operation; Requesters never receive Internal Notes or mutation access | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-13 | API/security | AC-07, AC-22 | Administrator User list, name/email search, one role filter, forbidden non-Administrator calls | Administrator receives required list; other roles receive safe `403` | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-14 | API | AC-23, AC-24 | User create/edit, one-role validation, duplicate email, activation, owner-invariant validation, and safe response | Valid account changes persist with a password hash; invalid conflicts and ineligible-owner updates are rejected atomically without partial updates | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-15 | API/security | AC-25, AC-26 | Admin initial-password reset, sibling-session revocation, self-deactivation, last active Administrator, and deactivation instead of delete | Reset forces next-login change and revokes prior sessions; account-safety rules always hold | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-16 | API/error | AC-07, AC-12, AC-16, AC-18, AC-20, AC-27 | Error envelope, safe status codes, no stack/storage/credential leakage, no partial mutation | Every failure is stable, documented, and non-disclosing | `server/tests/lab-03/authorization.api.test.ts` | Planned |

### 3.3 Client UI and style tests

| Test ID | Type | AC mapping | What it tests | Expected result | Planned file | Final status |
| --- | --- | --- | --- | --- | --- | --- |
| UI-01 | UI component | AC-02, AC-03, AC-27 | Login labels, validation, busy state, invalid credentials, inactive account, retry | User can understand and recover from each login state without unsafe detail | `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-02 | UI component | AC-05, AC-06, AC-27 | Mandatory Change Password form, policy text, mismatch, busy, success, logout, and blocked navigation | Normal shell remains unavailable until a valid change succeeds | `client/tests/lab-03/ChangePassword.test.tsx` | Planned |
| UI-03 | UI component | AC-08, AC-27 | Authenticated shell User/role display, permitted navigation, Password, Logout, and mobile menu | Each role sees only the approved destinations and named actions | `client/tests/lab-03/ApplicationShell.test.tsx` | Planned |
| UI-04 | UI component/regression | AC-13, AC-14, AC-27 | Requester My Tickets/Create Ticket/Detail continuity, removed selector, Public Comments, resolution indication | Lab 2 flow uses authenticated identity and exposes only permitted Requester actions | `client/tests/lab-03/RequesterRegression.test.tsx` | Planned |
| UI-05 | UI component | AC-15, AC-16, AC-27 | Staff Queue controls, table/card representation, query states, owner/status/priority badges, and open detail | Queue remains readable and all query/state feedback is actionable | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-06 | UI component | AC-17, AC-18, AC-19, AC-20, AC-21, AC-27 | Staff Ticket Detail ownership, priority, status confirmation, comments/notes, attachments, and resolution signal | Editable/read-only boundaries and private/public communication are unambiguous | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-07 | UI component | AC-19, AC-21, AC-22, AC-23, AC-24, AC-25, AC-26, AC-27 | Administrator read-only Ticket Review and IT Priority, User list/search/filter, create/edit, password reset, validation, forbidden, and safety feedback | Administrator Ticket Review exposes read-only Ticket facts/comments/notes plus only IT Priority editing; minimalist User Management supports only the approved operations | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| UI-08 | UI style/responsive | AC-27, AC-28 | Zen Green tokens, shared component classes, desktop/tablet/mobile layouts, Queue cards, and no overflow | Required screens match the visual contract at target viewports | `client/tests/lab-03/zen-green.responsive.test.tsx` | Planned |
| UI-09 | UI accessibility | AC-08, AC-27, AC-29 | Labels, required indicators, focus order, live regions, dialog names, badges, and keyboard operation | Controls are targetable and state is not communicated by color alone | `client/tests/lab-03/accessibility.test.tsx` | Planned |

### 3.4 End-to-end tests

| Test ID | Type | AC mapping | What it tests | Expected result | Planned file | Final status |
| --- | --- | --- | --- | --- | --- | --- |
| E2E-01 | E2E | AC-01 through AC-08 | Valid/invalid login, inactive account, first-login password change, role shell, logout, and direct access after logout | Complete authentication journey works and protected routes remain blocked | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-02 | E2E/regression | AC-11 through AC-14 | Authenticated Requester create/list/detail, Attachment continuity, Public Comment, resolution indication, and ownership isolation | Lab 2 Requester behavior continues under real identity | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-03 | E2E | AC-15 through AC-21 | IT Staff Queue, query controls, claim/reassign, priority/status, Public Comments, Internal Notes, and safe failures | Staff can complete the approved operational flow without exposing private notes | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-04 | E2E/security | AC-19, AC-21 through AC-26 | Administrator read-only Ticket Review/IT Priority, list/search/filter/create/edit/reset, and account-safety rejection | Administrator can review any existing Ticket, change only IT Priority, and manage accounts; non-Administrators cannot use the screens or APIs | `e2e/lab-03/user-administration.spec.ts` | Planned |
| E2E-05 | E2E/visual | AC-27, AC-28, AC-29 | Login, Change Password, Requester, Queue, Ticket Detail, User Management at desktop/tablet/mobile | Screenshots and assertions show usable responsive and accessible states | `e2e/lab-03/responsive-and-accessibility.spec.ts` | Planned |
| E2E-06 | E2E/release | AC-30 | Integrated seeded workflow and final test/evidence hooks on `lab3-staging` | The final evidence package can link actual passing output to the contract | `e2e/lab-03/release-regression.spec.ts` | Planned |

## 4. Acceptance-criterion traceability

Every acceptance criterion in `specification.md` has at least one planned test. The mapping below is the minimum traceability; a later implementation may add tests but must not remove coverage without a reviewed contract change.

| Acceptance criterion | Planned test IDs |
| --- | --- |
| AC-01 | UNIT-01, API-01, E2E-01 |
| AC-02 | UNIT-01, API-01, UI-01, E2E-01 |
| AC-03 | API-01, UI-01, E2E-01 |
| AC-04 | UNIT-02, API-02, E2E-01 |
| AC-05 | UNIT-01, API-03, UI-02, E2E-01 |
| AC-06 | UNIT-01, API-03, UI-02, E2E-01 |
| AC-07 | UNIT-02, API-04, API-13, API-16, UI-03, E2E-01, E2E-04 |
| AC-08 | API-04, UI-03, E2E-01 |
| AC-09 | UNIT-06, API-05, E2E-02 |
| AC-10 | UNIT-06, API-05, E2E-06 |
| AC-11 | API-06, API-08, E2E-02 |
| AC-12 | API-06, API-08, API-16, E2E-02 |
| AC-13 | API-06, API-08, UI-04, E2E-02 |
| AC-14 | UNIT-04, API-07, UI-04, E2E-02 |
| AC-15 | API-09, UI-05, E2E-03 |
| AC-16 | UNIT-03, API-09, API-16, UI-05, E2E-03 |
| AC-17 | API-10, UI-06, E2E-03 |
| AC-18 | API-10, API-16, UI-06, E2E-03 |
| AC-19 | API-11, UI-06, UI-07, E2E-03, E2E-04 |
| AC-20 | UNIT-05, API-11, API-16, UI-06, E2E-03 |
| AC-21 | UNIT-04, API-12, UI-06, UI-07, E2E-03, E2E-04 |
| AC-22 | API-13, UI-07, E2E-04 |
| AC-23 | API-14, UI-07, E2E-04 |
| AC-24 | API-14, API-16, UI-07, E2E-04 |
| AC-25 | API-03, API-15, UI-02, UI-07, E2E-01, E2E-04 |
| AC-26 | API-15, API-16, UI-07, E2E-04 |
| AC-27 | API-16, UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, E2E-01, E2E-03, E2E-04 |
| AC-28 | UI-08, E2E-05 |
| AC-29 | UI-09, E2E-05 |
| AC-30 | API-05, E2E-06 |

## 5. Manual visual, responsive, and accessibility inspection

Automated tests do not replace inspection of the rendered interface. Capture and review screenshots under:

- `artifacts/lab-03/screenshots/authentication/`
- `artifacts/lab-03/screenshots/staff-queue/`
- `artifacts/lab-03/screenshots/staff-ticket-detail/`
- `artifacts/lab-03/screenshots/user-management/`

Use these target viewports:

| Viewport | Target |
| --- | --- |
| Desktop | `1280x900` or wider. |
| Tablet | `820x900` or equivalent within 768-991px. |
| Mobile | `390x844` or equivalent below 768px. |

Record the actual viewport, route, account role, data marker, commit, screenshot path, and result. Inspect:

- Zen Green tokens, typography, spacing, surfaces, borders, badges, and shared control consistency.
- Login and Change Password validation, busy, safe failure, and success states.
- Current User, role, permitted navigation, Password, and Logout.
- Requester regression with no Development Requester selector or Change Requester action.
- Queue search, filters, sort, page controls, ownership, status, both priorities, empty/no-results/failure, and mobile card readability.
- Ticket Detail read-only versus editable fields, claim/reassign, status confirmation, Public Comments, Internal Notes, Attachments, and resolution indication.
- Administrator Ticket Review read-only detail, Public Comments, Internal Notes, IT Priority-only edit, forbidden/not-found behavior, and no operational mutation controls.
- User Management required columns, search, one role filter, create/edit/reset, duplicate email, invalid role, self-deactivation, last-Administrator feedback, and ineligible-owner conflict.
- No clipping, overlap, hidden required control, unreadable text, keyboard trap, or horizontal overflow.
- Programmatic labels, visible focus, required indicators, live regions, button names, dialog names, and text alternatives.

## 6. Commands and result recording

Run the narrowest relevant command while implementing, then record the exact command and actual result here or in the linked evidence document. Use Bun as required by the repository instructions:

```text
bun run --cwd server test -- tests/lab-03
bun run --cwd client test -- tests/lab-03
bun run test:e2e -- e2e/lab-03
bun run typecheck
bun run build
bun run verify
```

Before full verification, prepare the test database using the repository workflow and never run `docker compose down -v` during normal development. A passing command is valid evidence only when its output, branch/commit, environment prerequisite, and test scope are recorded. A code review or generated test file is not a test result.

## 7. Completion rules

- Do not mark a test `Pass` from static inspection, a test discovery count, or a started process.
- Do not skip, disable, or weaken a required test to make the suite green.
- If a test reveals an implementation defect, fix the implementation or update the reviewed contract before changing the test expectation.
- Keep server tests under `server/tests/lab-03/`, client tests under `client/tests/lab-03/`, E2E tests under `e2e/lab-03/`, and screenshots under `artifacts/lab-03/screenshots/`.
- Every review comment on the implementation PR must receive an author response before the reviewer merges it.
- The final release evidence must come from the integrated final `main` branch, while the specification and test plan must show that they existed before the main implementation PRs were completed.
