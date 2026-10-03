# Lab 4 Test DD and traceability plan

- Status: pre-implementation test plan. Test rows are **Planned—not run** until their implementation and exact command/revision are recorded.
- Parent: [Issue #86](https://github.com/ovenmakemeheat/toktickit/issues/86) · Contract: [Issue #87](https://github.com/ovenmakemeheat/toktickit/issues/87)
- Requirements: [Lab 4 handout](requirements/UTF-8_SE+Lab+4.pdf) · [specification](specification.md) · [API contract](api-spec.md) · [UI contract](ui-spec.md).

This plan is written before the product feature code, as required by Spec DD, Test DD, and TDD. It uses existing test seams. A file listed below is a planned target, not evidence that the file exists or that a test passed.

## 1. Test strategy and quality bar

Use the highest existing user-observable seam for each rule:

- **Unit**: pure Action Taken field/follow-up validation, idempotency normalization, Ticket transition matrix, confirmation, and resolution-gate decisions. Do not start a server.
- **API/integration**: Supertest against the importable Express app with isolated PostgreSQL. Assert status/body, role/ownership, persisted values, timestamps, and unchanged state after rejected/conflicting writes.
- **Client UI**: Vitest and Testing Library at the existing fetch/user-observable boundary. Assert labels, available actions, feedback, route destinations, keyboard behavior, and role visibility—not component internals or CSS implementation details.
- **E2E**: Playwright journeys against the real seeded application and PostgreSQL. Do not intercept business API routes in final seeded regression journeys. Existing deterministic fixtures may remain for isolated UI-only interaction tests.
- **Performance smoke**: call the real dashboard API against a deterministic populated seed; assert summary bounds and record local response timing. This is a regression smoke, not a production SLO.
- **Manual UI style, responsive, visual, and accessibility**: inspect Zen Green consistency and dashboard/Ticket Detail layouts at desktop/tablet/mobile, including shared tokens and established component conventions. Record findings in VIS-01; screenshots are not proof of backend authorization.
- **Documentation check**: trace all ACs to test IDs, files, commands, and evidence; check consistency among the four contracts and the handout.

A good test asserts externally observable behavior: rendered content/actions, HTTP result, authorization, database effect, or preserved state after rejection. Do not assert private component state, Prisma call counts, exact query implementation, CSS class names, or database implementation details.

Use TDD: add/fail the nearest contract-level test first, implement only the vertical slice required by its issue, run its focused suite, then run the wider relevant regression. Do not weaken/skip a test to turn a failure green. Every result remains `Planned` until genuinely executed; the contract branch itself has no Lab 4 product tests to claim as passed.

## 2. Test data, database, and isolation

Use deterministic `.test` accounts and isolated database state. Never use real credentials, production data, or tests depending on file execution order.

| Fixture | Role/state | Purpose |
| --- | --- | --- |
| Requester A | Active Requester | Owned Ticket dashboard, read-only Actions Taken, and resolution indication. |
| Requester B | Active Requester | Prove cross-Requester isolation for Ticket/action/dashboard reads. |
| IT Staff A | Active IT Staff | Create/update actions, transition Tickets, and view operational dashboard. |
| IT Staff B | Active IT Staff | Distinct performer versus primary owner and concurrent edit scenario. |
| IT Staff inactive | Inactive IT Staff | Preserve owner/assignment eligibility regression and reject inactive targets. |
| Administrator | Active Administrator | Staff-equivalent operational work/dashboard plus retained User Management/Ticket Review. |

Seed/fixture data must include:

- Tickets in every status, every Requested/IT Priority, and assigned/unassigned ownership.
- Tickets with zero, one, and multiple Actions Taken; both follow-up values; and an action performer different from the Ticket Owner.
- Action times with equal timestamps (ID tie-break), out-of-order insertion, and an update that does not change `actionAt` unless explicitly edited.
- An Action Taken with follow-up required and a non-empty note; one with the flag cleared and a null note; Attachment Notes referencing a seeded existing Attachment without upload.
- Requester and Staff dashboard metrics with zero and non-zero results; exact inclusive lower-window and `asOf` boundaries; ties for `updatedAt`/`resolvedAt`; and resolved/closed/cancelled examples.
- Legacy Lab 3 database shapes with zero Actions Taken and current `RESOLVED`, `CLOSED`, and `REOPENED` Tickets for timestamp backfill/behavior checks.

Reset or isolate data using the existing test database setup. The migration test starts from a Lab 3-shaped database, records before/after row counts and ownership, and never uses/destroys the developer database volume.

## 3. Planned automated test catalog

The filenames below follow the Lab 4 handout's minimum structure and the repository's existing test boundaries. They may be adjusted only through a reviewed contract change; a renamed file must keep the same traceability.

### 3.1 Unit and API/integration

| Test ID | Type | AC mapping | Observable behavior covered | Planned test file(s) | Status |
| --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | AC-01, AC-04, AC-05, AC-08 | Required Action Taken fields, trimming/length bounds, follow-up note conditionality/clearing, UUID header validation, normalized idempotency payload | `server/tests/lab-04/actions-taken.unit.test.ts` | Planned—not run |
| UNIT-02 | Unit | AC-10, AC-11, AC-12 | Complete status matrix, required confirmations, new-resolution gate, reopen marker, legacy resolved/closed behavior, and stale-state decision | `server/tests/lab-04/ticket-workflow.unit.test.ts` | Planned—not run |
| API-01 | API | AC-01, AC-02, AC-04, AC-05 | Create persists under correct Ticket; session-derived performer; other staff may perform without changing owner; field validation; no upload from Attachment Notes; Ticket `updatedAt` changes | `server/tests/lab-04/actions-taken.api.test.ts` | Planned—not run |
| API-02 | API | AC-06 | GET returns stable action-time/ID ordering; Requester sees only owned Ticket; foreign/missing Ticket has non-disclosing result; empty list shape is stable | `server/tests/lab-04/actions-taken.api.test.ts` | Planned—not run |
| API-03 | API/concurrency | AC-03, AC-08, AC-09 | Idempotent replay versus conflicting key reuse; update metadata/version; immutable actor/parent/creation; stale version 409 preserves winning data; no partial Ticket timestamp mutation | `server/tests/lab-04/actions-taken.api.test.ts` | Planned—not run |
| API-04 | API/security | AC-02, AC-07, AC-17 | Requester write rejection; cross-owner access; missing role/CSRF; IT Staff/Admin Queue/detail/claim/owner/priority/status operations; Admin retains user-management/review boundaries; existing communication-write roles remain safe | `server/tests/lab-04/actions-taken.api.test.ts`, `server/tests/lab-04/ticket-workflow.api.test.ts`, existing Lab 3 authorization suites | Planned—not run |
| API-05 | API/concurrency | AC-10, AC-11, AC-12 | Full transition matrix; confirmations; no-action resolution rejection; success after new action; reopened Ticket requires post-reopen action; Requester advisory; expected-status race returns typed 409; atomicity | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned—not run |
| API-06 | API/database | AC-13, AC-14, AC-16 | Requester-only query scope; exact open/waiting/recently-resolved definitions; inclusive UTC boundaries; stable ties; zero/non-zero values; top-five bounds; no private fields | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned—not run |
| API-07 | API/database | AC-15, AC-16, AC-17 | Staff/Admin unassigned, `myActive`, status/priority/high metrics; active status set; recent top-five ordering; role equivalence; bounded DTO and drill-down filters | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned—not run |
| API-08 | Migration/seed/regression | AC-19, AC-20, AC-21 | Lab 3 migration preserves Users/Tickets/Attachments/comments/notes and IDs/ownership; `resolvedAt`/`lastReopenedAt` approximations; zero fabricated actions; repeat-safe migration/seed; required fixture distribution; `/api/health`, inactive-assignee rejection, and prior Lab 1–3 API behavior | `server/tests/lab-04/migration-seed.api.test.ts`, existing `server/tests/lab-02/` and `server/tests/lab-03/` suites | Planned—not run |

### 3.2 Client UI, E2E, performance, visual, and docs

| Test ID | Type | AC mapping | Observable behavior covered | Planned test file/evidence | Status |
| --- | --- | --- | --- | --- | --- |
| UI-01 | UI component | AC-01–09, AC-18 | Ordered list, Staff/Admin create/edit, Requester read-only, follow-up validation, action retries/conflict/input preservation, actor/owner distinction, no delete/upload control | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned—not run |
| UI-02 | UI component | AC-13–16, AC-18 | Requester/Staff dashboard loading, zero/non-zero, safe failure/retry, metrics, recent lists, labels, bounded rows, drill-down destinations | `client/tests/lab-04/RequesterDashboard.test.tsx`, `client/tests/lab-04/StaffDashboard.test.tsx` | Planned—not run |
| UI-03 | UI/style/responsive/accessibility | AC-17–19, AC-22 | Role navigation, Administrator operational access plus retained admin features, transition controls/confirmations, focus/labels/announcements, Zen Green visual consistency, responsive states, no regressions | `client/tests/lab-04/TicketWorkflow.test.tsx`, existing Lab 2/3 suites, `e2e/lab-04/prior-labs-regression.spec.ts`, VIS-01 checklist | Planned—not run |
| E2E-01 | Seeded full-stack | AC-01–09, AC-19 | Staff creates and edits actions on a real Ticket; owner remains distinct; Requester can read same history but cannot mutate; repeated request does not duplicate | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned—not run |
| E2E-02 | Seeded full-stack | AC-10–12 | Resolution is rejected with no Action Taken, allowed after required work, Requester advisory stays advisory, confirmation and concurrent conflict feedback work | `e2e/lab-04/ticket-resolution.spec.ts` | Planned—not run |
| E2E-03 | Seeded full-stack | AC-13–17, AC-21 | Requester/Staff/Admin metrics match seeded data and cards/rows open matching filters/details; zero/non-zero cases; Admin reuses Staff dashboard | `e2e/lab-04/dashboards.spec.ts` | Planned—not run |
| E2E-04 | Seeded role/regression | AC-07, AC-17, AC-19, AC-22 | Direct forbidden API/navigation matrix; Requester cross-owner denial; Staff/Admin access; prior authentication, Ticket, Attachment, comment/note, User Management, Ticket Review flows | `e2e/lab-04/prior-labs-regression.spec.ts`, existing release-regression suites | Planned—not run |
| PERF-01 | API performance smoke | AC-16, AC-23 | Populated database; dashboard responses are bounded summaries with correct list caps and no full Ticket/Note payload; record actual local response timing and environment | `server/tests/lab-04/dashboard-performance.api.test.ts` | Planned—not run |
| VIS-01 | Manual UI style/responsive/accessibility | AC-18, AC-22 | Compare Zen Green visual consistency with the approved Lab 3 UI; inspect Staff/Requester dashboards and Action Taken detail at desktop/tablet/mobile; keyboard/focus/labels/live states, validation placement, clipping/overlap/overflow, and non-color cues | `docs/lab-04/evidence/visual-inspection-checklist.md` and `artifacts/lab-04/screenshots/` | Planned—not run |
| DOC-01 | Contract/documentation review | AC-24 | All FR/BR/AC trace to tests/evidence; API/UI/schema/seed decisions agree; out-of-scope stays excluded; reviewer and AI-use/DoD records are complete; handout requirements are not lost | `specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`, `reviewer.md`, `ai-use.md` | Planned—not run |

## 4. Acceptance-criterion traceability

| Acceptance criterion | Planned test IDs |
| --- | --- |
| AC-01 | UNIT-01, API-01, E2E-01 |
| AC-02 | API-01, API-04, E2E-01 |
| AC-03 | API-03, UI-01 |
| AC-04 | UNIT-01, API-01, UI-01 |
| AC-05 | API-01, UI-01 |
| AC-06 | API-02, E2E-01 |
| AC-07 | API-04, E2E-04 |
| AC-08 | UNIT-01, API-03, E2E-01 |
| AC-09 | API-03, UI-01 |
| AC-10 | UNIT-02, API-05, E2E-02 |
| AC-11 | UNIT-02, API-05, E2E-02 |
| AC-12 | UNIT-02, API-05, E2E-02 |
| AC-13 | API-06, UI-02, E2E-03 |
| AC-14 | API-06, E2E-03 |
| AC-15 | API-07, UI-02, E2E-03 |
| AC-16 | API-06, API-07, UI-02, PERF-01 |
| AC-17 | API-04, API-07, UI-03, E2E-03, E2E-04 |
| AC-18 | UI-01, UI-02, UI-03, VIS-01 |
| AC-19 | API-08, UI-03, E2E-04 |
| AC-20 | API-08 |
| AC-21 | API-08, E2E-03 |
| AC-22 | UI-03, E2E-04, VIS-01 |
| AC-23 | PERF-01 |
| AC-24 | DOC-01 |

A check on a document or screenshot is not a replacement for automated API evidence. All ACs must retain at least one mapped test after any reviewed contract change.

## 5. Planned commands and evidence recording

Use Bun and the repository scripts. During implementation, run the narrowest relevant workspace/suite; before release, run the required full gate and seeded E2E. Exact commands and output are recorded only after execution.

```text
bun run --cwd server test
bun run --cwd client test
bun run test:e2e -- e2e/lab-04
bun run typecheck
bun run build
bun run verify
```

For DB-backed suites, use the isolated test database and the repository's approved setup. Never run `docker compose down -v` during normal development. Record the exact command, branch/commit, database prerequisite/port, test scope, result/count, and any failure/blocker. No result on this contract-only branch is to be marked Pass.

## 6. Manual review checklist

VIS-01 records the actual route, role, viewport, fixture marker, commit, evidence path, and outcome for:

- Zen Green visual consistency with Lab 3: shared design tokens, typography, spacing, cards, tables, badges, buttons, forms, feedback, and responsive navigation; remove only temporary/duplicate/obsolete/inconsistent UI elements without regressing prior capabilities.
- Requester, IT Staff, and Administrator navigation/role boundary.
- Requester Dashboard ownership scope, zero/non-zero metrics, recent lists, and drill-down.
- Staff/Admin Dashboard cards, status/IT-Priority counts, unassigned/my-owned/recent lists, and drill-down.
- Ticket Detail Actions Taken empty/list/create/edit/validation/conflict/success; performer versus owner; Requester read-only view; no delete or upload.
- Confirmation feedback, no-action resolution gate, post-reopen gate, and stale-status conflict.
- Desktop/tablet/mobile readability, keyboard operation, visible focus, labels, announcements, non-color cues, and no clipping/overlap/horizontal page scroll.
- Public Comment/Internal Note visibility, Attachments, User Management, Ticket Review, and all earlier role screens remain correct.

## 7. Completion rules

- Do not mark a planned test passed from static inspection, test discovery, or a started command.
- Do not mock business API routes in seeded release journeys; mock only the narrow UI-only boundary where deterministic fixtures are appropriate.
- Do not assert that screenshots prove authorization or persisted database behavior.
- Do not let tests depend on execution order or shared mutable seed state.
- If implementation exposes a specification gap, update the reviewed contract and affected traceability before changing a test expectation.
- `reviewer.md` records actual human comments/responses/merge evidence. Automated review, code generation, or green CI is not peer approval.
