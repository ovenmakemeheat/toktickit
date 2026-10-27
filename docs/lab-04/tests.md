# Lab 4 Test DD and traceability plan

- Status: The integrated automated test gate for Issues #88–#90 passed again on 2026-10-27 against committed PR #94 revision `851ee7301f6f0ebc677f8268b4c6c5ac3de7d7e4`. VIS-01 remains partial pending human assistive-technology review; DOC-01 and release/peer-review closeout remain pending. This is not a claim that parent #86 is done.
- Parent: [Issue #86](https://github.com/ovenmakemeheat/toktickit/issues/86) · Contract: [Issue #87](https://github.com/ovenmakemeheat/toktickit/issues/87)
- Requirements: [Lab 4 handout](requirements/UTF-8_SE+Lab+4.pdf) · [specification](specification.md) · [API contract](api-spec.md) · [UI contract](ui-spec.md).

This test plan was written before product feature code, as required by Spec DD, Test DD, and TDD. It uses existing test seams. The catalog below now names actual files and records only commands that were executed; `Planned—not run` is reserved for work that has not been tested.

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

Use TDD: add/fail the nearest contract-level test first, implement only the vertical slice required by its issue, run its focused suite, then run the wider relevant regression. Do not weaken/skip a test to turn a failure green. Keep status labels tied to the exact executed suite and retain partial/pending labels for unperformed manual or human-review work.

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
- Requester and Staff dashboard metrics with zero and non-zero results; exact inclusive lower-window and `asOf` boundaries; ties for `updatedAt`/`resolvedAt`/Action Taken `createdAt`; resolved/closed/cancelled examples; and current-user-performed actions on Tickets with a different owner across statuses.
- Legacy Lab 3 database shapes with zero Actions Taken and current `RESOLVED`, `CLOSED`, and `REOPENED` Tickets for timestamp backfill/behavior checks.

Reset or isolate data using the existing test database setup. The migration test starts from a Lab 3-shaped database, records before/after row counts and ownership, and never uses/destroys the developer database volume.

## 3. Automated test catalog

The files below follow the Lab 4 handout's minimum structure and the repository's existing test boundaries. Any reviewed file change must retain this traceability; each status reflects an executed command, not static inspection.

### 3.1 Unit and API/integration

| Test ID | Type | AC mapping | Observable behavior covered | Test file(s) | Status |
| --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | AC-01, AC-04, AC-05, AC-08 | Required Action Taken fields, trimming/length bounds, follow-up note conditionality/clearing, UUID header validation, canonical normalized create fingerprint (including actor/Ticket and UTC/follow-up normalization), and stable fingerprint across later edits | `server/tests/lab-04/actions-taken.unit.test.ts` | Passed (2026-10-22; `bun run verify`) |
| UNIT-02 | Unit | AC-10, AC-11, AC-12 | Complete status matrix, required confirmations, new-resolution gate, reopen marker, legacy resolved/closed behavior, and stale-state decision | `server/tests/lab-04/ticket-workflow.unit.test.ts` | Passed (2026-10-22; `bun run verify`) |
| API-01 | API | AC-01, AC-02, AC-04, AC-05 | Create persists under correct Ticket; session-derived performer; other staff may perform without changing owner; field validation; no upload from Attachment Notes; Ticket `updatedAt` changes | `server/tests/lab-04/actions-taken.api.test.ts` | Passed (2026-10-22; `bun run verify`) |
| API-02 | API | AC-06 | GET returns stable action-time/ID ordering; Requester sees only owned Ticket; foreign/missing Ticket has non-disclosing result; empty list shape is stable | `server/tests/lab-04/actions-taken.api.test.ts` | Passed (2026-10-22; `bun run verify`) |
| API-03 | API/concurrency | AC-03, AC-08, AC-09 | Create, edit one or more fingerprinted fields, then retry the same key with the original equivalent normalized request: return the edited existing resource without creating/overwriting a row or advancing Ticket activity. Verify persisted fingerprint remains unchanged and is absent from DTO/log output. Same key with changed normalized input, actor, or Ticket returns safe 409 without mutation; also cover update metadata/version and stale version 409 preserving winning data | `server/tests/lab-04/actions-taken.api.test.ts` | Passed (2026-10-22; `bun run verify`) |
| API-04 | API/security | AC-02, AC-07, AC-17, AC-19 | Requester write rejection; cross-owner access; missing role/CSRF; IT Staff/Admin Queue/detail/claim/owner/priority/status operations; Admin retains user-management/review boundaries; Admin is read-only for Public Comments/Internal Notes; IT Staff existing write permissions and Requester-owned Public Comment authoring remain intact | `server/tests/lab-04/actions-taken.api.test.ts`, `server/tests/lab-04/ticket-workflow.api.test.ts`, existing Lab 3 authorization suites | Passed (2026-10-22; `bun run verify`) |
| API-05 | API/concurrency | AC-10, AC-11, AC-12 | Full transition matrix; confirmations; no-action resolution rejection; success after new action; reopened Ticket requires post-reopen action; Requester advisory; expected-status race returns typed 409; atomicity | `server/tests/lab-04/ticket-workflow.api.test.ts` | Passed (2026-10-22; `bun run verify`) |
| API-06 | API/database | AC-13, AC-14, AC-16 | Requester-only query scope; exact open/waiting/recently-resolved definitions; inclusive UTC boundaries; stable ties; zero/non-zero values; top-five bounds; no private fields | `server/tests/lab-04/requester-dashboard.api.test.ts` | Passed (2026-10-22; `bun run verify`) |
| API-07 | API/database | AC-15, AC-16, AC-17, AC-25 | Staff/Admin unassigned, owner-based `myActive`, status/priority/high metrics; `myRecentActions` scopes by authenticated performer (distinct from Ticket owner), includes all Ticket statuses, applies inclusive UTC `createdAt` window, descending timestamp/ID ordering and five-item cap; role equivalence; safe bounded DTO and action drill-down destination | `server/tests/lab-04/staff-dashboard.api.test.ts` | Passed (2026-10-22; `bun run verify`) |
| API-08 | Migration/seed/regression | AC-19, AC-20, AC-21 | Lab 3 migration preserves Users/Tickets/Attachments/comments/notes and IDs/ownership; `resolvedAt`/`lastReopenedAt` approximations; zero fabricated actions; repeat-safe migration/seed; required fixture distribution; `/api/health`, inactive-assignee rejection, and prior Lab 1–3 API behavior | `server/tests/lab-04/migration-seed.api.test.ts`, existing `server/tests/lab-02/` and `server/tests/lab-03/` suites | Passed (2026-10-22; `bun run verify`; targeted migration test passed 1 test) |

### 3.2 Client UI, E2E, performance, visual, and docs

| Test ID | Type | AC mapping | Observable behavior covered | Test file/evidence | Status |
| --- | --- | --- | --- | --- | --- |
| UI-01 | UI component | AC-01–09, AC-18 | Ordered list, Staff/Admin create/edit, Requester read-only, follow-up validation, action retries/conflict/input preservation, actor/owner distinction, no delete/upload control | `client/tests/lab-04/ActionsTaken.test.tsx` | Passed (2026-10-22; included in 72-test client suite) |
| UI-02 | UI component | AC-13–16, AC-18, AC-25 | Requester/Staff dashboard loading, zero/non-zero, safe failure/retry, metrics, recent Ticket and `My Recent Actions` lists, labels, bounded rows, and Ticket/action drill-down destinations | `client/tests/lab-04/RequesterDashboard.test.tsx`, `client/tests/lab-04/StaffDashboard.test.tsx` | Passed (2026-10-22; included in 72-test client suite) |
| UI-03 | UI/style/responsive/accessibility | AC-17–19, AC-22 | Role navigation, Administrator operational access plus retained admin features, transition controls/confirmations, focus/labels/announcements, Zen Green visual consistency, responsive states, no regressions | `client/tests/lab-04/TicketWorkflow.test.tsx`, existing Lab 2/3 suites, `e2e/lab-04/prior-labs-regression.spec.ts`, VIS-01 checklist | Automated suites passed (2026-10-22; VIS-01 remains partial) |
| E2E-01 | Seeded full-stack | AC-01–09, AC-19 | Staff creates and edits actions on a real Ticket; owner remains distinct; Requester can read same history but cannot mutate; repeated request does not duplicate | `e2e/lab-04/actions-taken-flow.spec.ts` | Passed (2026-10-22; full 19-test `bun run test:e2e`) |
| E2E-02 | Seeded full-stack | AC-10–12 | Resolution is rejected with no Action Taken, allowed after required work, Requester advisory stays advisory, confirmation and concurrent conflict feedback work | `e2e/lab-04/ticket-resolution.spec.ts` | Passed (2026-10-22; full 19-test `bun run test:e2e`) |
| E2E-03 | Seeded full-stack | AC-13–17, AC-21, AC-25 | Requester/Staff/Admin metrics match seeded data; current-user `My Recent Actions` distinguishes performer from owner, scopes to the signed-in staff/admin, orders and bounds results across statuses/window, and rows focus the matching action; zero/non-zero cases; Admin reuses Staff dashboard | `e2e/lab-04/dashboards.spec.ts` | Passed (2026-10-22; full 19-test `bun run test:e2e`) |
| E2E-04 | Seeded role/regression/release hardening | AC-07, AC-17, AC-19, AC-22, AC-26 | Direct forbidden API/navigation matrix; Requester cross-owner denial; Staff/Admin access; prior authentication, Ticket, Attachment, comment/note, User Management, Ticket Review flows. Collect browser console/page errors; check visible control names, inert anchors, main role-navigation buttons, and placeholder/TODO text. The app uses buttons rather than internal anchors; the report records both checks. Save machine-readable route/role/API output and revision under `artifacts/lab-04/e2e/e2e-04-hardening/`. | `e2e/lab-04/prior-labs-regression.spec.ts`, existing Lab 2/3 release suites; `artifacts/lab-04/e2e/e2e-04-hardening/run-report.json` | Passed automated E2E-04 (2026-10-22; full 19-test `bun run test:e2e`); broader visual/accessibility review remains VIS-01 partial |
| PERF-01 | API performance smoke | AC-16, AC-23 | Populated database; dashboard responses are bounded summaries with correct list caps and no full Ticket/Note payload; record actual local response timing and environment | `server/tests/lab-04/dashboard-performance.api.test.ts` | Passed (2026-10-22; included in 170-test server suite; timings recorded in §5.1) |
| VIS-01 | Manual UI style/responsive/accessibility/release hardening | AC-18, AC-22, AC-26 | Compare Zen Green visual consistency with the approved Lab 3 UI; inspect Staff/Requester dashboards and Action Taken detail at desktop/tablet/mobile; keyboard/focus/labels/live states, validation placement, clipping/overlap/overflow, and non-color cues. For checks requiring manual inspection, navigate representative Lab 4/prior-lab routes and record browser console/page errors, internal-link resolution, placeholder/TODO text, and visibly unfinished/inert controls as pass/fail. Each record includes route, role, viewport, revision, evidence path, and result. Screenshots are visual evidence only, not authorization proof. | `docs/lab-04/evidence/visual-inspection-checklist.md` and `artifacts/lab-04/evidence/visual-inspection/` | Partial—not complete; authenticated responsive inspection recorded, broader keyboard, workflow, and release-hardening checks pending |
| DOC-01 | Contract/documentation review | AC-24 | All FR/BR/AC trace to tests/evidence; API/UI/schema/seed decisions agree; out-of-scope stays excluded; reviewer and AI-use/DoD records are complete; handout requirements are not lost | `specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md`, `reviewer.md`, `ai-use.md` | Partial: docs refreshed and internally cross-checked (2026-10-22); formal human contract/DOC-01 review remains pending |

## 4. Acceptance-criterion traceability

| Acceptance criterion | Mapped test IDs |
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
| AC-25 | API-07, UI-02, E2E-03, PERF-01 |
| AC-26 | E2E-04, VIS-01 |

A check on a document or screenshot is not a replacement for automated API evidence. All ACs must retain at least one mapped test after any reviewed contract change.

## 4.1 Functional requirement and business rule traceability

The following is the complete identifier inventory in the current `specification.md` (FR-01–FR-20 and BR-01–BR-25). Every requirement maps to at least one automated test ID or manual/documentation check. The catalog and verification record below indicate which mapped checks have actually passed.

| Specification ID | Mapped test ID(s) / manual check |
| --- | --- |
| FR-01 | API-01, API-04, E2E-01 |
| FR-02 | UNIT-01, API-01, UI-01 |
| FR-03 | API-02, API-04, UI-01, E2E-01 |
| FR-04 | API-01, API-03, UI-01 |
| FR-05 | UNIT-01, API-02, API-03, UI-01 |
| FR-06 | API-04, UI-01 |
| FR-07 | UNIT-02, API-05, API-04 |
| FR-08 | UNIT-02, API-05, E2E-02 |
| FR-09 | UNIT-02, API-05, API-08 |
| FR-10 | API-06, UI-02, E2E-03 |
| FR-11 | API-07, UI-02, E2E-03 |
| FR-12 | API-06, API-07, UI-02, PERF-01 |
| FR-13 | API-06, API-07, PERF-01 |
| FR-14 | API-08 |
| FR-15 | API-08, E2E-03 |
| FR-16 | API-08, API-04, E2E-04 |
| FR-17 | UI-03, VIS-01 |
| FR-18 | DOC-01 |
| FR-19 | API-07, UI-02, E2E-03 |
| FR-20 | E2E-04, VIS-01 |
| BR-01 | UNIT-01, API-01 |
| BR-02 | API-01, API-04, E2E-01 |
| BR-03 | UNIT-01, API-01, UI-01 |
| BR-04 | UNIT-01, API-01, UI-01 |
| BR-05 | UNIT-01, API-01, UI-01 |
| BR-06 | UNIT-01, API-01, UI-01 |
| BR-07 | API-01, API-03, API-04 |
| BR-08 | API-03, UI-01 |
| BR-09 | API-01, API-03, API-04 |
| BR-10 | API-02, UI-01 |
| BR-11 | UNIT-01, API-03, E2E-01 |
| BR-12 | API-03, UI-01 |
| BR-13 | API-02, API-04, E2E-01 |
| BR-14 | API-04, API-07, E2E-03 |
| BR-15 | API-01, API-03 |
| BR-16 | UNIT-02, API-05 |
| BR-17 | UNIT-02, API-04, API-05 |
| BR-18 | UNIT-02, API-05, E2E-02 |
| BR-19 | UNIT-02, API-05, E2E-02 |
| BR-20 | UNIT-02, API-05, API-08 |
| BR-21 | UNIT-02, API-05, API-08 |
| BR-22 | UNIT-02, API-05, E2E-02 |
| BR-23 | API-05, E2E-02 |
| BR-24 | API-05, API-08 |
| BR-25 | API-07, UI-02, E2E-03, PERF-01 |

DOC-01 additionally performs an explicit inventory comparison against `specification.md` to reject missing or unknown FR/BR identifiers; the table above contains FR-01–FR-20 and BR-01–BR-25 exactly, with no gaps.

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

For DB-backed suites, use the isolated test database and the repository's approved setup. Never run `docker compose down -v` during normal development. Record the exact command, branch/commit, database prerequisite/port, test scope, result/count, and any failure/blocker.

### 5.1 Issue #89 dashboard verification (2026-10-11)

- Branch: `feature/22-lab4-role-dashboards`.
- Tested tree: uncommitted implementation based on `8608a312d298ecfd480ea67b0fe9ffd5ccf5db5f`; this is the base commit, not a commit containing the tested changes.
- Database: local PostgreSQL on host port `15434`; the dashboard migration was applied with `bun run db:migrate`. API tests use the repository's test database setup. No credentials are included here.
- `bun run verify` — passed: Biome, Lefthook, Prisma validation, client/server type checks, all client tests (19 files / 72 tests), all server tests (28 files / 169 tests), and both builds.
- `bun run --cwd server test -- tests/lab-04/requester-dashboard.api.test.ts tests/lab-04/staff-dashboard.api.test.ts tests/lab-04/dashboard-performance.api.test.ts --reporter=verbose --silent=false` — passed: 3 files / 5 tests. PERF-01 with 30 fixture Tickets and 12 Actions Taken recorded Staff `20.5 ms / 3,167 B` and Requester `14.1 ms / 2,272 B`; local smoke measurements only, not a production SLO.
- `PORT=3001 bunx playwright test e2e/lab-04/dashboards.spec.ts --config=.tmp-lab4-playwright.config.ts` — passed: 1 E2E test. Used alternate API/UI ports `3001`/`5174` because the standard ports were occupied; temporary configs were removed after the run. The journey used the real app/API and database.
- VIS-01 preliminary unauthenticated `/login` inspection was performed headlessly at 1440×900, 768×1024, and 390×844. It found no horizontal overflow; axe-core 4.12.1 reported 0 violations and 0 incomplete checks at mobile size; labels, focus styling, password visibility toggle, and inline required-field errors were exercised.

### 5.2 VIS-01 authenticated responsive inspection (2026-10-11)

- Branch/revision: `feature/22-lab4-role-dashboards` / `dd5e5f4`; headless Chrome via `agent-browser 0.39.0`.
- Environment: UI `http://127.0.0.1:5175`, API port `3003`, with `APP_ORIGIN=http://127.0.0.1:5175` to match the alternate Vite origin.
- Created local Requester and IT Staff QA accounts through Admin User Management; generated passwords were rotated and kept in local `agent-browser` profiles only. The `.test` accounts are not real Gmail inboxes.
- Inspected Requester, IT Staff, and Administrator dashboards at 1440×900, 768×1024, and 390×844; also inspected My Tickets/Create Ticket, Staff Ticket Queue/Detail, Action Taken create/edit forms, Admin User Management, and Admin Ticket Review. All sampled route/viewports had `scrollWidth === viewportWidth`; empty Create Ticket validation rendered inline errors and no Ticket was submitted. Axe-core 4.12.1 reported 0 violations and 0 incomplete checks on the sampled mobile routes.
- Screenshots and route-by-route outcomes are recorded in [`evidence/visual-inspection-checklist.md`](evidence/visual-inspection-checklist.md), with full-frame images in `../../artifacts/lab-04/evidence/visual-inspection/`.
- Additional PR-readiness checks: keyboard traversal reached all dashboard actions in logical order at desktop (Staff) and mobile (Requester/Admin); visible focus was a green 3 px outline/4 px halo. Empty Create Ticket validation retained focus on Submit and associated all five errors through `aria-invalid`/`aria-describedby`; Action Taken required-field validation focused the missing field and sent no request. A status-change confirmation naming `Cancelled` was opened then canceled; the seeded Ticket remained `REOPENED`. These were UI-only checks; no seed Ticket fields or Actions Taken were changed.
- `agent-browser a11y` (axe-core 4.12.1, WCAG 2.1 A/AA tags) reported 0 violations and 0 incomplete checks on Requester/Staff/Admin dashboards, Requester Create Ticket validation, Staff Ticket Detail/Action Taken form, and Admin Ticket Review at 390 × 844. Browser page-error output was empty; console output contained only Vite/React development messages.
- The expanded E2E-03 verifies a Requester dashboard row opens an owned Ticket Detail with an empty, read-only Actions Taken section. Full multi-viewport visual captures of that owned detail and manual screen-reader/live-region confirmation remain pending; VIS-01 is therefore still partial. Full Action Taken/status conflict paths are covered by the automated client/API suites, not manually mutated in the development database.

### 5.3 PR-readiness verification (2026-10-11)

- Tested branch/head: `feature/22-lab4-role-dashboards` / `dd5e5f4`, with working-tree test/evidence updates. The branch targets `lab4-staging`; Issue #89 is the active scope.
- `bun run verify` — passed: Biome, Lefthook validation, Prisma schema validation, client/server type checks, all client tests (19 files / 72 tests), all server tests (28 files / 169 tests), and both production builds.
- `bun run test:e2e -- --config=tmp-pr-playwright.config.ts e2e/lab-04/dashboards.spec.ts e2e/lab-03/release-regression.spec.ts` — passed: 3 tests. Playwright used the isolated `toktickit_test` database on host port `15434`, API `3000`, and UI `5174`; the default UI port `5173` belonged to another local project. The temporary Playwright config was removed after execution.
- The E2E run also exercises the seeded Requester-owned Ticket Detail/read-only Actions Taken state; the Admin route regression now expects both Lab 4 operational `Ticket Queue` and retained `Ticket Review` navigation.
- The first full verify attempt exposed a 5-second timeout in the existing migration integration test, whose two subprocess migrations and API checks take about 5–7 seconds locally. A targeted run passed with a longer timeout; the test now has a local 30-second allowance, and the final full verify passed.

### 5.4 Issue #90 integrated verification (2026-10-22)

- Branch: `feature/23-lab4-regression-demo-readiness`; the tested tree is an uncommitted working tree based on `47d6487b638939835403ea0da7c0e3f011078b7b`. The E2E-04 machine report records this revision and `worktreeDirty: true`; do not treat the base revision as a commit containing these changes.
- Database: local PostgreSQL, isolated `toktickit_test` database on host port `15434`. No real credentials or production data were used. `bun run test:e2e` runs `bun run db:test:setup` first, rejects development/test database overlap, and starts non-reused API/UI servers on ports `3001`/`5174`.
- `bun run --cwd server test -- tests/lab-04/migration-seed.api.test.ts --reporter=verbose` — passed: 1 integration test. It deploys the pre-Lab-4 migration set into a unique schema, inserts a Lab 3-shaped baseline, applies current migrations, checks preservation/backfill/no fabricated actions, repeats migration deploy, and seeds twice without count drift.
- `bun run verify` — passed: Biome (141 files), Lefthook validation, Prisma schema validation, client/server type checks, client tests (19 files / 72 tests), server tests (29 files / 170 tests), and both production builds.
- `bun run test:e2e` — passed: 19 Chromium tests across Lab 2, Lab 3, and Lab 4, including all 5 Lab 4 tests. This full suite includes the real seeded API/PostgreSQL Action Taken, resolution/reopen, dashboard, role-boundary, and prior-Lab journeys; the new Lab 4 release journeys do not intercept business API routes.
- The `db:test:setup` fail-closed guard was exercised with a non-`_test` database name and with `DATABASE_URL` equal to a valid `_test` `TEST_DATABASE_URL`; both invocations were rejected before Prisma reset.
- `cd server && node --input-type=module -e "import('./dist/src/app.js').then(({ app }) => { if (!app) process.exit(1); console.log('Node.js app import passed'); })"` — passed; imports the built Express app under Node without opening a listener.
- E2E-04 route, role, navigation, API status, browser-console, and page-error results are in [`run-report.json`](../../artifacts/lab-04/e2e/e2e-04-hardening/run-report.json). It reports zero browser console/page errors and records the UI's button-based navigation separately from its zero internal anchors. It does not claim a manual screen-reader sign-off.
- `API-06`/`API-07` exercise the exact inclusive 30-day and `asOf` boundaries with deterministic test fixtures; the seed-verification test checks zero/one/multiple Actions Taken, both follow-up values, distinct performer/owner, Attachment Notes, status/priority/ownership distribution, and zero/non-zero dashboard metrics.

#### Migration snapshot and rollback decision

- Before applying the additive migration to a shared release database, take a timestamped database snapshot and verify that the snapshot can be restored. Record pre-migration row counts and ownership relationships as in API-08.
- The migration has no destructive down migration. If migration execution fails before any new Actions Taken are accepted, stop writes and restore the validated pre-migration snapshot rather than manually dropping Lab 4 tables/columns. Inspect migration state, resolve the cause, and retry only after recovery is verified.
- Once new Actions Taken data exists, do not restore the older snapshot or drop the work-log schema because that would discard accepted work. Back up the current database, then use a forward repair that preserves all Actions Taken and Ticket history.
- API-08 verifies repeat deployment after success and repeat-safe seed behavior in an isolated Lab 3-shaped schema. It does not simulate a production migration failure or execute a snapshot/restore; those remain release-operator steps, not completed evidence.

### 5.5 PR #94 feedback verification (2026-10-27)

- Fixed the Lab 2 requester-flow cleanup registration to use `test.afterEach(...)`, supported by the installed `@playwright/test` 1.62.1 API. The fix was committed and pushed as `851ee7301f6f0ebc677f8268b4c6c5ac3de7d7e4` before the final browser run.
- `bunx playwright test --list e2e/lab-02/requester-ticket-flow.spec.ts` — passed: Playwright discovered the seeded Requester Ticket/Attachment regression test.
- `bun run verify` — passed after commit `851ee73`: Biome (142 files, including the E2E-04 JSON report), Lefthook validation, Prisma validation, type checks, client tests (19 files / 72 tests), server tests (29 files / 170 tests), and both builds.
- `bun run test:e2e` — passed after commit `851ee73`: 19 Chromium tests across Labs 2–4, including the Lab 2 cleanup test and all 5 Lab 4 tests. The E2E-04 report now records the committed revision `851ee7301f6f0ebc677f8268b4c6c5ac3de7d7e4`.
- `worktreeDirty: true` in the report reflects screenshot outputs regenerated by the full E2E run and pre-existing local-only untracked files; the tested source revision is the committed PR revision above. Generated Lab 2/3 screenshots were restored after verification and are not part of this change.
- VIS-01 remains partial: no screen-reader/live-region sign-off or complete final visual checklist is claimed. DOC-01 formal human review also remains pending.

## 6. Manual review checklist

VIS-01 records the actual route, role, viewport, fixture marker, commit, evidence path, and outcome for:

- Zen Green visual consistency with Lab 3: shared design tokens, typography, spacing, cards, tables, badges, buttons, forms, feedback, and responsive navigation; remove only temporary/duplicate/obsolete/inconsistent UI elements without regressing prior capabilities.
- Final hardening on representative Lab 4/prior-lab navigation: capture unexpected browser console errors and uncaught page errors; resolve app-internal links; inspect rendered UI for placeholder/TODO text and visibly unfinished or inert controls. Record route, role, viewport, revision, evidence path, and pass/fail in VIS-01 when manual inspection is needed; retain E2E-04 run report. Screenshots alone do not establish authorization.
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
