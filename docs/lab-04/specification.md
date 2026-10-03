# Lab 4 engineering specification

Status: contract draft for Issue #87; human review is pending before dependent feature implementation is treated as unblocked.

- Parent issue: [#86 — Lab 4: Actions Taken, dashboards, and final regression](https://github.com/ovenmakemeheat/toktickit/issues/86)
- Contract issue: [#87 — Lab 4: Contract and test plan](https://github.com/ovenmakemeheat/toktickit/issues/87)
- Source: [UTF-8 Lab 4 requirements](requirements/UTF-8_SE+Lab+4.pdf)
- Related contracts: [API](api-spec.md), [UI](ui-spec.md), [test plan](tests.md), [review record](reviewer.md), [AI-use record](ai-use.md).

This contract translates the Lab 4 handout and approved parent issue into implementable behavior. It is intentionally narrower than the handout's optional examples, preserves Labs 1–3, and does not authorize features outside this specification. The handout remains the source requirement; this document resolves its implementation choices.

## 1. Sprint goal

Add an auditable, Ticket-owned Actions Taken work log; enforce the final Ticket status and resolution rules on the server; give Requesters and operational staff concise, data-backed dashboards; and complete regression, accessibility, responsive, security, and demonstration readiness for the application built in Labs 1–3.

## 2. Stakeholder request

The service desk can receive Tickets and communicate with Requesters, but it cannot record what work was performed, its result, follow-up needs, or who performed it. Add ordered Actions Taken without changing the Ticket's primary coordinator. Requesters may see the work on their own Tickets but cannot author or edit it. Keep the Requester resolution indication advisory; staff must record work and formally transition the Ticket. Provide concise dashboards that link to existing detailed screens, and harden the whole application without regressing earlier capabilities.

## 3. Scope and domain vocabulary

### 3.1 Domain vocabulary and roles

Use these terms consistently: **Requester**, **IT Staff**, **Administrator**, **Ticket**, **Ticket Owner** (the Ticket's primary coordinator), **Requested Priority**, **IT Priority**, **Public Comment**, **Internal Note**, and **Action Taken** (plural **Actions Taken**).

An Action Taken is a child record of exactly one Ticket. A Ticket can have zero or many Actions Taken. The performer of an Action Taken is the authenticated IT Staff member or Administrator who created it; the performer may differ from the primary Ticket Owner. The owner field remains the single primary coordinator and is not changed by recording work.

Authorization is always enforced by the API. Hiding a screen or control is not an authorization decision.

| Capability | Requester | IT Staff | Administrator |
| --- | --- | --- | --- |
| View Actions Taken | Only on an owned Ticket | On a Ticket the role is permitted to access | On a Ticket the role is permitted to access |
| Create or update Actions Taken | No | Yes | Yes |
| Delete Actions Taken | No | No | No |
| Requester dashboard | Own Ticket data only | No | No separate Requester dashboard |
| Operational dashboard | No | Yes | Reuse the IT Staff dashboard and calculations |
| Queue, Ticket Detail, owner, Action Taken, status workflow | No | Yes | Yes, as required by Lab 4 |
| User Management and existing Ticket Review/IT-Priority capability | No | No | Retain the Lab 3 capabilities |
| Formal status transition | No | Yes | Yes |
| Public Comment/Internal Note write | Requester may add Public Comments to owned Tickets | Existing Lab 3 Staff write permissions remain | Existing Lab 3 Administrator read permissions remain; no new comment/note authoring permission is inferred |
| “Problem Appears Resolved” indication | Own Ticket only; advisory | Read only where shown | Read only where shown |

Administrators receive the Lab 4 operational Ticket capabilities while retaining User Management and Ticket Review. Do not add a separate Administrator dashboard or account metrics. The Requester’s “Problem Appears Resolved” action never performs a staff transition.

### 3.2 Scope

#### Included

- Ticket-scoped Actions Taken persistence, read, create, and update behavior; server-derived performer; stable ordering; idempotent create; stale-edit protection; and no delete operation.
- Backend-enforced role and Ticket-ownership access, including Administrator operational behavior.
- The complete existing Ticket status matrix, required confirmations, resolution gate, reopening behavior, and `resolvedAt` tracking.
- Requester and IT Staff dashboards with precisely defined server calculations, bounded recent summaries, empty states, and drill-downs; Administrators reuse the IT Staff view.
- Additive PostgreSQL/Prisma migration, preservation of all existing Lab 3 data, historical timestamp treatment, indexes, and repeat-safe seed behavior.
- Zen Green UI extension, role navigation, useful feedback, responsive and accessible behavior, regression coverage, performance smoke, visual evidence, and current setup/demo documentation.

#### Explicitly excluded

- SLA clocks, escalation engines, on-call scheduling, breach notifications, or external notification delivery (email, SMS, LINE, push, or similar).
- Inventory consumption, spare parts, purchasing, service cost accounting, timesheet billing, payroll, or labor-cost calculation.
- Multi-level approvals, electronic signatures, Action Taken deletion/history screens, or a follow-up scheduling/completion workflow.
- New file upload/storage for an Action Taken. Attachment Notes refer to existing Ticket files only and do not replace Ticket Attachments.
- Business-intelligence suites, custom report builders, data warehouses, or bulk export.
- Multi-tenant organizations, production-scale cloud changes, a separate Administrator dashboard/account metrics, or any feature not approved by the Sprint 4 contract.

## 4. Functional Requirements

| ID | Requirement |
| --- | --- |
| FR-01 | IT Staff and Administrators can create an Action Taken on an accessible Ticket; the API derives the performer from the session. |
| FR-02 | An Action Taken has action date/time, Action Description, Result, performer, Follow-Up Required, conditional Follow-up Note, and optional plain-text Attachment Notes. |
| FR-03 | Requesters can view all Actions Taken only on their own Tickets. They cannot create, update, or delete Actions Taken. |
| FR-04 | IT Staff and Administrators can update allowed fields without changing the original performer, parent Ticket, or creation metadata. Each update records updater/time and increments a version. |
| FR-05 | Action lists use deterministic chronological ordering. Create retries are idempotent; stale edits return a typed conflict. |
| FR-06 | Actions Taken cannot be deleted in Lab 4; corrections use update. |
| FR-07 | The backend enforces every permitted Ticket status transition and required confirmation for every role allowed to operate the workflow. |
| FR-08 | A new transition to `RESOLVED` requires real Actions Taken. A Requester indication is advisory. A reopened Ticket needs a new Action Taken before it can be resolved again. |
| FR-09 | The system sets, retains, clears, and historically backfills `resolvedAt` as defined below. Reopening is tracked well enough to enforce the new-work gate. |
| FR-10 | The Requester dashboard returns only the authenticated Requester's open, waiting, recently updated, and recently resolved Ticket metrics/summaries. |
| FR-11 | The operational dashboard returns authoritative unassigned, owned, status, IT-Priority, high-priority, and recent-work information for IT Staff; Administrators reuse it. |
| FR-12 | Dashboard responses are concise, bounded summaries with deterministic calculations and usable Queue/Ticket Detail destinations; they do not replace detailed screens. |
| FR-13 | Dashboard metrics are calculated server-side from PostgreSQL and use the documented UTC window, status sets, filters, and ordering. |
| FR-14 | Migration preserves existing Users, Tickets, Attachments, Public Comments, and Internal Notes and creates no fabricated Actions Taken. |
| FR-15 | Seed is repeat-safe and supports zero/one/multiple Actions Taken, both follow-up states, distinct owners/performers, every major status/priority, and zero/non-zero dashboard results. |
| FR-16 | Lab 1–3 authentication, authorization, Requester ownership, Ticket workflows, Attachments, comments, notes, User Management, Ticket Review, and Zen Green behavior continue to work. |
| FR-17 | Role navigation, work history, dashboards, status controls, and feedback remain readable and operable at desktop, tablet, and mobile sizes with keyboard and assistive technology. |
| FR-18 | Tests/evidence trace each acceptance criterion to actual observable behavior, executed tests, commands, and manual inspection where applicable. |

## 5. Business Rules

### Actions Taken data and auditability

| ID | Rule |
| --- | --- |
| BR-01 | Each Action Taken belongs to exactly one Ticket; each Ticket has zero or many Actions Taken. |
| BR-02 | The primary Ticket Owner coordinates the Ticket. A different authorized IT Staff member or Administrator may perform an action; recording an action never changes the owner. |
| BR-03 | `actionAt` is required and stored as a UTC timestamp. The API returns ISO 8601 UTC. It represents when the work occurred, not when the record was created. |
| BR-04 | `actionDescription` and `result` are required, trimmed, non-empty plain text. Each is limited to 2,000 characters. |
| BR-05 | `followUpRequired` is required. When true, `followUpNote` must be non-empty after trimming. When false, the stored/returned note is null. The note is limited to 2,000 characters. This flag alone does not block resolution. |
| BR-06 | `attachmentNotes` is optional trimmed plain text, limited to 2,000 characters. It identifies an existing Ticket Attachment for the reader to inspect; it does not upload, create, or grant access to a file. |
| BR-07 | The server derives `performedByUserId` from the authenticated session and does not accept caller-selected performer identity. The original performer, parent Ticket, idempotency key, and creation timestamp are immutable. |
| BR-08 | IT Staff and Administrators may update `actionAt`, `actionDescription`, `result`, `followUpRequired`, `followUpNote`, and `attachmentNotes`. Each update records `updatedAt`, `updatedByUserId`, and an incremented `version`. |
| BR-09 | Actions Taken cannot be deleted. Create/update operations are atomic. A rejected request leaves both the action and parent Ticket unchanged. |
| BR-10 | Reads order by `actionAt` ascending, then Action Taken `id` ascending. The ID is the stable tie-breaker. |
| BR-11 | Create requires a client-generated UUID idempotency key. Repeating the same key with the same Ticket, authenticated creator, and equivalent normalized payload returns the existing Action Taken. Reusing it for different content, actor, or Ticket returns safe `409 IDEMPOTENCY_KEY_REUSED`; it never creates a second row. |
| BR-12 | Update requires the record's expected `version`. If the stored version differs, return `409 ACTION_TAKEN_CONFLICT` and preserve the latest value. A successful update increments the version exactly once. |
| BR-13 | Requesters can read Actions Taken only through a Ticket whose authenticated `requesterUserId` matches the session. Non-owned Ticket reads use a non-disclosing `404`. Requesters cannot create or update. |
| BR-14 | IT Staff and Administrators can read/write Actions Taken on Tickets they are permitted to access, independent of Ticket ownership. Administrator gains the Lab 4 IT Staff operational Ticket workflow while retaining existing User Management and Ticket Review/IT-Priority behavior. |
| BR-15 | Action create/update advances the parent Ticket's `updatedAt` in the same transaction so dashboard recent activity reflects work-log changes. |

### Ticket status and resolution

| ID | Rule |
| --- | --- |
| BR-16 | The persisted statuses remain `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`. |
| BR-17 | Only IT Staff and Administrators perform status transitions. Only the listed transitions are allowed; a direct API call cannot bypass the matrix. |
| BR-18 | A transition to `RESOLVED`, `CLOSED`, `REOPENED`, or `CANCELLED` requires explicit `confirmation: true`. Other listed transitions do not require it. |
| BR-19 | A transition newly entering `RESOLVED` requires at least one Action Taken. For a Ticket never reopened in Lab 4, any real Action Taken satisfies this gate. After a reopen, at least one Action Taken record must have been created after the latest reopen timestamp. |
| BR-20 | `resolvedAt` is set from the server clock when entering `RESOLVED`, retained when moving from `RESOLVED` to `CLOSED`, and cleared when moving to `REOPENED`. Existing `RESOLVED`/`CLOSED` Tickets remain valid and receive `updatedAt` as an approximate `resolvedAt` during migration. |
| BR-21 | `lastReopenedAt` is set from the server clock whenever a Ticket enters `REOPENED`. It remains the gate marker through subsequent active states until another reopen replaces it. For a legacy Ticket already in `REOPENED`, migration backfills `updatedAt` as an approximation. The new Action Taken gate uses record `createdAt`, not editable `actionAt`, to distinguish new work from historical work. This internal marker adds no user-facing workflow. |
| BR-22 | A Requester's “Problem Appears Resolved” indication is advisory and never changes `currentStatus`, `resolvedAt`, or authorization. |
| BR-23 | Status updates compare the client-observed expected status and the current database status atomically. A stale/concurrent winner yields typed `409 TICKET_STATUS_CONFLICT`; there is no partial update. |
| BR-24 | Legacy Tickets without Actions Taken remain valid. Migration does not fabricate work. A legacy resolved/closed Ticket may remain as-is; after it is reopened, it needs newly recorded work before it can be resolved again. |

### Complete status transition matrix

All transitions are available only to IT Staff and Administrators. Confirmation is `true` only for rows marked required. All unlisted transitions are rejected.

| From | Permitted target | Confirmation required |
| --- | --- | --- |
| `NEW` | `OPEN`, `CANCELLED` | `CANCELLED` |
| `OPEN` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | `RESOLVED`, `CANCELLED` |
| `IN_PROGRESS` | `OPEN`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | `RESOLVED`, `CANCELLED` |
| `WAITING_FOR_REQUESTER` | `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CANCELLED` | `RESOLVED`, `CANCELLED` |
| `RESOLVED` | `CLOSED`, `REOPENED` | Both |
| `CLOSED` | `REOPENED` | `REOPENED` |
| `REOPENED` | `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | `RESOLVED`, `CANCELLED` |
| `CANCELLED` | `REOPENED` | `REOPENED` |

### Dashboard calculation contract

For each response, compute one server-side `asOf` UTC timestamp. The rolling window is `[asOf - 30 days, asOf]`, inclusive at both ends. “Active” means `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`; `RESOLVED`, `CLOSED`, and `CANCELLED` are not active. Counts are calculated from authoritative Ticket rows and scoped by authenticated identity where indicated.

| Dashboard value | Exact calculation and output |
| --- | --- |
| Requester `openCount` | Count of this Requester's active Tickets, across all active statuses. |
| Requester `waitingForRequesterCount` | Count of this Requester's active Tickets in `WAITING_FOR_REQUESTER`. |
| Requester `recentlyUpdated` | Up to five owned Tickets with `updatedAt` in the rolling window; `updatedAt` descending, then `id` descending. |
| Requester `recentlyResolvedCount` | Count of owned Tickets currently `RESOLVED` or `CLOSED` with `resolvedAt` in the rolling window. |
| Requester `recentlyResolved` | Up to five of those same Tickets, `resolvedAt` descending, then `id` descending. |
| Staff/Admin `unassignedActiveCount` | Count of active Tickets whose primary owner is null. |
| Staff/Admin `myActiveCount` | Count of active Tickets whose primary owner is the authenticated User. For an Administrator this means that Administrator's own assigned Tickets, not all Tickets. |
| Staff/Admin `statusBreakdown` | Counts for each of the five active statuses; include zero-valued keys. |
| Staff/Admin `itPriorityBreakdown` | Counts for `LOW`, `MEDIUM`, and `HIGH` among active Tickets; include zero-valued keys. |
| Staff/Admin `highPriorityActiveCount` | Count of active Tickets with `HIGH` IT Priority. |
| Staff/Admin `recentlyUpdated` | Up to five active Tickets with `updatedAt` in the rolling window; `updatedAt` descending, then `id` descending. |

Dashboard responses contain `asOf`, these counts/breakdowns, and bounded recent Ticket summaries only (maximum five per recent list). They do not return all Tickets or Internal Note content. Each card/list row links to a matching existing Queue filter or Ticket Detail. A zero count is represented as `0`; an empty list as `[]`; neither is treated as an error. Dashboard queries use indexes appropriate to ownership/status/priority/time filters. Administrators reuse the Staff response; no separate account metric is introduced.

## 6. UI Specification Summary

The full screen, control, state, responsive, accessibility, and visual contract is in [ui-spec.md](ui-spec.md). Add role-appropriate Dashboard navigation and the Actions Taken area to existing Ticket Detail. IT Staff and Administrators create/edit; Requesters see read-only work history on owned Tickets. Show performer, record creation/update metadata, and action date/time clearly; distinguish mutable fields from immutable performer/parent data. Keep Public Comments and Internal Notes distinct and preserve earlier cards, tables, badges, feedback, mobile navigation, and workflows. Loading/saving, validation, success, empty/no-results, forbidden, not-found, conflict, and safe retryable failures are designed states; recoverable form input is preserved.

## 7. Data Changes

### Proposed data model

The contract adds an `ActionTaken` record with:

| Field | Type/constraint | Meaning |
| --- | --- | --- |
| `id` | Positive integer primary key | Stable ordering tie-breaker and resource ID. |
| `ticketId` | Required Ticket foreign key | Exactly one parent Ticket. |
| `actionAt` | Required UTC timestamp | When the action occurred; editable by permitted staff. |
| `actionDescription` | Required trimmed text, max 2,000 characters | Work performed. |
| `result` | Required trimmed text, max 2,000 characters | Outcome/result. |
| `performedByUserId` | Required User foreign key | Session-derived original performer; immutable. |
| `followUpRequired` | Required Boolean | Whether follow-up is needed. |
| `followUpNote` | Nullable text, max 2,000 characters | Required when flag true; null when false. |
| `attachmentNotes` | Nullable text, max 2,000 characters | Plain-text pointer to existing Ticket evidence. |
| `idempotencyKey` | Required globally unique UUID | Create retry protection. |
| `version` | Required integer, starts at 1 | Optimistic edit conflict control. |
| `createdAt` | Required UTC timestamp | Immutable record creation; used for post-reopen work gate. |
| `updatedAt` | Required UTC timestamp | Last record update. |
| `updatedByUserId` | Nullable User foreign key | Last editor; null until the record is edited. |

Ticket gains nullable UTC `resolvedAt` and nullable UTC `lastReopenedAt`. User gains the reverse relations for Action Taken performance/update. Existing Ticket status, owner, Requester, attachments, comments, and notes remain intact.

### Indexes and data-design rationale

- Index Actions Taken by `(ticketId, actionAt, id)` for stable history reads and by `(ticketId, createdAt)` for the post-reopen resolution gate. Enforce UUID idempotency-key uniqueness in the database.
- Index dashboard filters to support Requester ownership/status/`resolvedAt`/`updatedAt` and operational owner/status/IT-Priority/`updatedAt`; retain current useful Lab 3 indexes and add only those needed by observed queries.
- Keep `actionAt` separate from `createdAt`: editing a description must not rewrite when work happened, and the reopened-work rule needs immutable creation time.
- Use a monotonically increasing `version` and conditional update rather than last-write-wins; this makes stale edits observable and prevents silent overwrite.
- Keep `resolvedAt` separate from `updatedAt`: ordinary comments/actions can refresh activity without changing when the Ticket was resolved.
- Add `lastReopenedAt` as an internal marker because `updatedAt` is also advanced by Action Taken edits; it gives the server an immutable-enough boundary for enforcing post-reopen work without adding a user-facing history feature.

### Migration, legacy behavior, and recovery

1. Take and record a database snapshot; record baseline counts and ownership for Users, Tickets, Attachments, Public Comments, and Internal Notes.
2. Apply an additive migration for Actions Taken, required relations/indexes, nullable `resolvedAt`, and nullable `lastReopenedAt`. Preserve existing row IDs and relationships; do not create placeholder/fabricated Actions Taken.
3. For legacy Tickets currently `RESOLVED` or `CLOSED`, backfill `resolvedAt` from `updatedAt` and document it as an approximation because previous status history is unavailable. For legacy Tickets currently `REOPENED`, backfill `lastReopenedAt` from `updatedAt` as the reopen approximation. Other Tickets begin with null markers.
4. Validate before/after counts, Ticket/Attachment ownership, comment/note relationships, enum values, and absence of orphaned Actions Taken. Run migration from a Lab 3-shaped test database, recovery verification, and repeat-safe seed checks.
5. Seed with upserts/stable identities. Include zero, one, and multiple actions; both follow-up states; different action performers from Ticket owners; safe Attachment Notes; assigned and unassigned Tickets across all major statuses/priorities; Requester/Staff dashboards with zero and non-zero metrics; and dates on both sides of the inclusive 30-day window boundaries. Use local `.test` identities and no real credentials.
6. Document snapshot/restore and the pre-release rollback decision. Before new Actions Taken data exists, rollback follows the recorded migration plan. After new data exists, prefer a forward repair; do not silently drop work-log data in a destructive down migration.

## 8. API Contract Summary

The full route, DTO, validation, permission, status, and error contract is in [api-spec.md](api-spec.md). Use the existing `/api` conventions, session cookies, CSRF protection for writes, safe error envelope, positive integer IDs, and ISO 8601 UTC serialization.

| Capability | Contract route |
| --- | --- |
| Read Ticket Actions Taken | `GET /api/tickets/:ticketId/actions-taken` |
| Create Action Taken | `POST /api/tickets/:ticketId/actions-taken` |
| Update Action Taken | `PATCH /api/tickets/:ticketId/actions-taken/:actionId` |
| Requester dashboard | `GET /api/requester/dashboard` |
| IT Staff/Admin operational dashboard | `GET /api/staff/dashboard` |
| Status update (existing route, Admin role added) | `PATCH /api/staff/tickets/:ticketId/status` |

All approved Lab 2/3 APIs remain supported. Do not return password/session material, storage keys, private Internal Notes outside authorized note reads, SQL details, or stack traces. Failed/conflicting mutations are atomic.

## 9. Acceptance Criteria

Each criterion maps to one or more test IDs in [tests.md](tests.md). The mapping is normative and remains traceable through final release evidence.

| ID | Acceptance criterion |
| --- | --- |
| AC-01 | A valid Action Taken is saved under exactly one Ticket with the authenticated performer, action time, Action Description, and Result. |
| AC-02 | A permitted IT Staff member or Administrator can create an Action Taken when another eligible User owns the Ticket; Ticket ownership remains unchanged. |
| AC-03 | Updating an Action Taken preserves its original performer, parent Ticket, and creation metadata and records update metadata/version. |
| AC-04 | Follow-up-required actions require a non-empty Follow-up Note; clearing the flag clears the note. |
| AC-05 | Attachment Notes are safe plain text and do not create or upload files. |
| AC-06 | Actions Taken are returned in stable action-time/ID order; Requesters read only actions on owned Tickets. |
| AC-07 | Requesters cannot create/update Actions Taken; unauthorized direct API calls fail without mutation or private-data disclosure. |
| AC-08 | Replaying a create with the same idempotency key and equivalent payload does not create a duplicate; conflicting reuse safely returns 409. |
| AC-09 | A stale Action Taken update returns a conflict and preserves the winning version. |
| AC-10 | Only the listed status transitions are accepted, and required transitions require explicit confirmation. |
| AC-11 | A newly resolved Ticket has required real Actions Taken; a Requester indication alone never resolves it. |
| AC-12 | Concurrent/stale status changes return a typed conflict without overwriting the winner. |
| AC-13 | Requester dashboard counts, lists, and drill-downs contain only Tickets owned by the authenticated Requester. |
| AC-14 | Requester open/waiting/recently-resolved metrics follow documented status and 30-day UTC rules, including boundaries. |
| AC-15 | IT Staff and Administrator dashboard metrics/lists follow documented active-status, priority, owner, and date filters. |
| AC-16 | Dashboard responses are bounded summaries with `asOf`, deterministic ordering, zero/empty behavior, and valid drill-down destinations. |
| AC-17 | Administrators use the Lab 4 IT Staff operational dashboard/workflow and retain User Management and prior Ticket Review/IT-Priority behavior. |
| AC-18 | Applicable dashboards and Actions Taken screens expose loading, validation, success, empty, forbidden, conflict, not-found, and safe-failure states. |
| AC-19 | Prior Lab 1–3 authentication, Requester ownership, Tickets, Attachments, comments, notes, Queue, User Management, and Zen Green behavior remains passing. |
| AC-20 | Migration preserves Lab 3 data, backfills documented timestamps, creates no fabricated Actions Taken, and is repeat-safe/recoverable. |
| AC-21 | Seed data demonstrates zero, one, and multiple Actions Taken plus zero and non-zero dashboard metrics. |
| AC-22 | Dashboards and Actions Taken are keyboard/assistive-technology usable and work at desktop/tablet/mobile sizes without clipping or horizontal overflow. |
| AC-23 | Populated-seed dashboard performance smoke verifies bounded summaries and records local response timing. |
| AC-24 | Engineering contracts, test matrix, review/AI-use evidence, and Product Definition of Done are complete and human-reviewed before dependent feature implementation is treated as unblocked. |

## 10. Product Definition of Done

- [ ] `specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md` are internally consistent and have human review recorded before dependent implementation is marked ready.
- [ ] Every FR, BR, and AC has a stable identifier and at least one planned external-behavior test or manual check.
- [ ] At least two database design decisions and their rationale are documented; migration preserves Lab 3 data and IDs, backfills timestamps only as stated, creates no fake work, and has repeat/recovery evidence.
- [ ] Every Action Taken field, actor/owner rule, idempotency condition, edit version, ordering tie-breaker, authorization rule, and safe error is specified and tested.
- [ ] The complete Ticket transition matrix, confirmation behavior, Action Taken resolution gate, reopen marker, `resolvedAt`, stale-status conflict, and Requester advisory are server-enforced and tested.
- [ ] Requester and Staff/Admin dashboard calculations match the defined query, authenticated scope, UTC boundaries, bounded response, zero behavior, and drill-downs; seeded tests demonstrate zero/non-zero cases.
- [ ] All earlier Lab 1–3 authentication, ownership, Ticket assignment, Attachments, Public Comments, Internal Notes, User Management, Ticket Review, and Zen Green behavior remains passing; no prior approved capability is removed.
- [ ] Loading, validation, success, empty/no-results, forbidden, not-found, conflict, safe failure, and recoverable input behavior is implemented where applicable.
- [ ] Keyboard, visible focus, semantic names, announcements, non-color state cues, desktop/tablet/mobile layout, and visual consistency are tested/inspected; required role screenshots and visual checklist are captured.
- [ ] Unit, API/integration, UI, authorization, workflow, migration/seed/regression, performance-smoke, E2E, responsive, and accessibility tests pass on the integrated Lab 4 tree. Final evidence records exact test files, commands, commit, and results; screenshots alone do not prove authorization.
- [ ] Setup, migration, seed, test, and local demonstration instructions, including the README instructions required by the handout, are current before final release.
- [ ] `reviewer.md` identifies actual human review, linked PRs, comments, author responses, approvals, and merger; no automated output is represented as peer approval.
- [ ] `ai-use.md` names the model used, records 6–10 selected key prompts and a reflection, and states the student's responsibility.
- [ ] Use the Lab 4 GitHub project Kanban statuses Backlog, Specified, Started, PR Review, Fixing, and Done. A Lab 4 issue moves to Done only after acceptance, tests, peer review, and required integration/release merge; final board evidence shows all completed Lab 4 parent issues in Done.
- [ ] Feature PRs link their issues, target `lab4-staging`, and have every review comment answered; the peer reviewer—not the PR author—merges them. Release integration is separately reviewed and ends on `main`, the final source of truth.
- [ ] Final submission is one concise PDF with exactly the handout's headings “Answer Part 1” through “Answer Part 9” in order, working links, and readable screenshots.
  - **Answer Part 1:** Merged-branch/Kanban/reviewer/repository-tree evidence plus the README and `.gitignore` evidence required by the handout.
  - **Answer Part 2:** Rendered specification with numbered requirements, business rules, workflows, dashboard calculations, acceptance criteria, migration choices, Product DoD, and evidence it predated completion of implementation PRs.
  - **Answer Part 3:** Test plan, AC traceability, actual test-file paths, final status, and complete passing test output from `main`.
  - **Answer Part 4:** AI-use record naming the LLM, 6–10 selected prompts, and “My Reflection.”
  - **Answer Part 5:** Staff metrics matched to database queries, recent/urgent Tickets, drill-downs, loading/empty/forbidden/safe-failure states, and responsive behavior.
  - **Answer Part 6:** Ticket list/create/assignment; Actions Taken create/edit; status transition, resolve, and cancel; validation; inactive-assignee rejection; role restrictions; safe failures; responsiveness; and multiple actions on one Ticket.
  - **Answer Part 7:** Permitted transitions, stable Action Taken ordering, append-only/no-delete behavior with audit-preserving edits, and role visibility.
  - **Answer Part 8:** Requester-owned metrics, attention/recent Tickets, drill-downs, ownership protection, and regression for authentication, My Tickets, Ticket Detail, Attachments, Public Comments, Staff functions, Internal Notes, and Administrator User Management.
  - **Answer Part 9:** Rendered `ui-spec.md`, desktop/tablet/mobile screenshots for all major Lab 4 screens, and the completed visual/accessibility checklist for design consistency, dashboards, Actions Taken, editable/read-only fields, validation placement, keyboard focus, clipping, overlap, and horizontal overflow.

## 11. Assumptions and Decisions

- The handout allows an optional Administrator dashboard/account counts. This contract chooses no separate Administrator dashboard/metrics: Administrators reuse the IT Staff operational dashboard, as approved in parent issue #86.
- The handout's Administrator “perform IT Staff behavior” statement is interpreted using the explicit parent decision: Lab 4 expands operational Queue, Ticket Detail, ownership/priority/status, and Actions Taken access; it does not silently change the Lab 3 Public Comment/Internal Note authoring matrix. Administrators retain their existing read visibility. Human review must resolve this interpretation before implementation.
- “Different staff may take action” does not mean reassignment. The existing primary owner remains the coordinator; the authenticated action performer is separately recorded. Existing owner assignment still accepts only active IT Staff or Administrator Users and rejects inactive/invalid targets.
- `actionAt` can be corrected by authorized staff; immutable `createdAt` is used for idempotency and post-reopen gating. The UI displays both the action time and performer/creation attribution needed to understand the work record.
- Legacy `resolvedAt` and `lastReopenedAt` use `updatedAt` only as documented approximations; earlier status history cannot be reconstructed. No Action Taken is inferred from historic Ticket activity.
- The 30-day window is UTC and includes both its calculated lower boundary and response `asOf` upper boundary. All displayed counts derive from the same `asOf` instant.
- Follow-up is a flag and note only. No follow-up assignment, scheduling, reminder, completion state, or resolution block is introduced.
- Human review is still pending for this draft. Do not mark DOC-01 approved, record reviewer approval, or treat implementation branches as unblocked until the human contract review is complete.
