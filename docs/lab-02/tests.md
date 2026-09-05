# Lab 2 test plan

Status: final-main validation, browser-use evidence, and Lab 2 Kanban board capture recorded; human visual review pending (2026-09-05)

Origin issue: #51 - Lab 2 - Sprint specification and test plan
Applies to: Issues #51-#57 and the integrated Lab 2 result

This plan is the test contract for `specification.md`, `ui-spec.md`, and
`api-spec.md`. The `Final result` column records only executed results; a
database or environment block is recorded explicitly rather than treated as a
pass.

## Current Lab 2 state

This record covers the complete Lab 2 increment, not only the report branch.
Issues #51-#57 are closed and PRs #58-#64 are merged into `lab2-staging`.
Follow-up Issue #68 and PR #69 isolated the shared test fixtures, and release
PR #70 merged the integrated result into final `main` at `538b5da`. The current
documentation branch `docs/lab2-docs` points to that final-main commit. The
full repository gate and the two-test E2E flow passed on this baseline. The
regenerated final-main-aligned screenshot inventory and final-main repository,
contract, release, and client/server test-output captures are recorded below.

## 1. Test strategy

| Level | Boundary | Required evidence |
| --- | --- | --- |
| Unit | Pure ticket-number, normalization, validation, query, and attachment-policy functions | Deterministic examples, boundaries, and collision/rejection behavior. |
| API/integration | Supertest against exported `server/src/app.ts` with the isolated test database | Request/response status, body, persistence, ownership, and safe-error behavior. No real listener. |
| UI component | Vitest, Testing Library, and user-event at the user-observable boundary | Labels, field states, navigation, loading, validation, success, failure, and action behavior. |
| UI style/responsive | Client style assertions and Playwright viewport checks | Zen Green tokens, layout breakpoints, focus, no overflow, and state presentation. |
| Visual inspection | Playwright screenshots compared with `ui-spec.md` | Desktop, tablet, mobile, normal, loading, empty, failure, validation, and attachment states. |
| E2E | Playwright through the running client and API | Select Requester, create, upload, list, switch context, detail, download, and soft removal. |

Tests use seeded active Requesters A, B, C, and D plus one inactive Requester, the four required Categories, at least six Related Systems, and isolated test Tickets/Attachments. Attachment tests use generated temporary files and clean them up without using user-controlled filenames as paths.

## 2. TDD and execution rules

1. Select one test row and its linked FR, BR, and AC before implementation.
2. Write a failing test for the expected behavior or boundary.
3. Implement the smallest behavior needed to make that test pass.
4. Refactor without weakening the assertion, then run the narrowest relevant test.
5. Update the `Final result` column and evidence only after the actual test passes.
6. Do not skip, disable, quarantine, or mark flaky a required test. A failure is work to resolve, not evidence to omit.
7. API tests use Supertest against the exported app and do not start a listener. UI tests use accessible roles, labels, and visible behavior rather than implementation details.
8. Run the full repository gate before the feature PR is ready.

## 3. Planned-test matrix

### 3.1 Unit tests

| Test ID | Requirement / AC | What it tests | Expected result | Automated test file | Final result |
| --- | --- | --- | --- | --- | --- |
| UNIT-01 | BR-01, AC-05 | Ticket Number format and uniqueness retry | Generates `TT-YYYYMMDD-XXXXXX` and retries a collision without returning a duplicate. | `server/tests/lab-02/ticket-number.unit.test.ts` | Passed; 31 unit tests passed across the four unit files, including deterministic collision-retry coverage. |
| UNIT-02 | BR-09, BR-10, AC-06, AC-07 | Text normalization and field validation | Trims fields, accepts inclusive boundaries, and rejects empty, too short, too long, and invalid enum values. | `server/tests/lab-02/ticket-validation.unit.test.ts` | Passed; 31 unit tests passed across the four unit files. |
| UNIT-03 | BR-14, BR-16, BR-17, AC-12 | Ticket query parser and deterministic ordering | Accepts documented parameters, applies defaults, and rejects invalid page, page size, filter, and sort values. | `server/tests/lab-02/ticket-query.unit.test.ts` | Passed; 31 unit tests passed across the four unit files. |
| UNIT-04 | BR-18, BR-19, BR-20, BR-24, AC-18, AC-20 | Attachment policy | Accepts only permitted type/size/count combinations, generates safe storage keys, and validates removal reasons. | `server/tests/lab-02/attachment-policy.unit.test.ts` | Passed; 31 unit tests passed across the four unit files. |

### 3.2 API and integration tests

| Test ID | Requirement / AC | What it tests | Expected result | Automated test file | Final result |
| --- | --- | --- | --- | --- | --- |
| API-01 | FR-02, FR-16, BR-04, AC-02, AC-04 | Active reference and requester context | Active Categories, Related Systems, and Requesters are returned; inactive Requesters are absent; context failures are safe. | `server/tests/lab-02/create-ticket.api.test.ts` | Passed in the full server run. |
| API-02 | FR-07, BR-01, BR-02, BR-08, BR-11, AC-05 | Valid Ticket creation | Returns `201`, saves one Ticket, generates unique number/date, assigns the header Requester, and sets `NEW`. | `server/tests/lab-02/create-ticket.api.test.ts` | Passed in the full server run. |
| API-03 | BR-08, BR-09, BR-10, AC-07 | Create validation and inactive references | Invalid body, inactive Category/System, invalid context, and invalid priority return documented `400`/`404` with no Ticket. | `server/tests/lab-02/create-ticket.api.test.ts` | Passed in the full server run. |
| API-04 | BR-12, AC-08 | Idempotent create retry | Equivalent retry returns `200` for the original Ticket; changed payload with the same ID returns `409`; count remains one. | `server/tests/lab-02/create-ticket.api.test.ts` | Passed in the full server run. |
| API-05 | BR-18, BR-19, BR-20, BR-21, AC-09, AC-10, AC-18 | Attachment upload after creation | Valid upload returns `201`; invalid file and storage failure are safe; a failed upload does not delete the Ticket. | `server/tests/lab-02/attachments.api.test.ts` | Passed in the full server run. |
| API-06 | FR-09, BR-07, AC-11 | Owned Ticket list | Requester A receives only A Tickets and cannot see B records through the list. | `server/tests/lab-02/my-tickets.api.test.ts` | Passed in the full server run. |
| API-07 | BR-14, BR-15, BR-16, BR-17, AC-12 | Search, filters, sorting, and pagination | Query parameters produce deterministic items and correct page metadata; invalid parameters return `400`. | `server/tests/lab-02/my-tickets.api.test.ts` | Passed in the full server run. |
| API-08 | BR-26, AC-13, AC-14 | List empty, no-results, and failure behavior | Empty ownership scope and valid no-match query return distinct metadata shapes usable by the UI; database failure returns a safe error. | `server/tests/lab-02/my-tickets.api.test.ts` | Passed in the full server run. |
| API-09 | FR-11, AC-15 | Owned Ticket Detail | Owned detail returns read-only fields and all attachment metadata. | `server/tests/lab-02/ticket-detail.api.test.ts` | Passed in the full server run. |
| API-10 | BR-07, BR-23, AC-16, AC-21 | Detail ownership protection | Missing and cross-Requester Ticket requests both return non-disclosing `404`. | `server/tests/lab-02/ticket-detail.api.test.ts` | Passed in the full server run. |
| API-11 | FR-12, BR-22, AC-17 | Attachment metadata | Active and removed metadata are returned; removed records have no download URL. | `server/tests/lab-02/attachments.api.test.ts` | Passed in the full server run. |
| API-12 | BR-18, BR-19, BR-20, AC-18 | Attachment constraints | Unsupported type, over-5-MB file, and sixth active file return documented errors and do not create invalid active rows. | `server/tests/lab-02/attachments.api.test.ts` | Passed in the full server run. |
| API-13 | FR-14, BR-23, AC-19, AC-21 | Active download | Owned active file returns bytes and safe content headers; missing, removed, and cross-owner cases are rejected. | `server/tests/lab-02/attachments.api.test.ts` | Passed; all active-download cases, including the Unicode display-name header assertion, passed. |
| API-14 | FR-15, BR-22, BR-24, AC-20 | Soft removal | Valid reason returns `204`, sets removal metadata, retains the row, and removes active download access. | `server/tests/lab-02/attachments.api.test.ts` | Passed in the full server run. |
| API-15 | BR-23, BR-24, AC-21 | Attachment ownership and repeat removal | Cross-owner mutation is `404`; removed mutation is `409`; invalid reason is `400`. | `server/tests/lab-02/attachments.api.test.ts` | Passed in the full server run. |
| API-16 | FR-17, AC-24 | Safe error contract | Validation, missing-resource, ownership, upload, conflict, storage, and unexpected failures use stable safe bodies with no stack/path leakage. | `server/tests/lab-02/create-ticket.api.test.ts` and `server/tests/lab-02/attachments.api.test.ts` | Passed in the full server run. |

### 3.3 Client UI tests

| Test ID | Requirement / AC | What it tests | Expected result | Automated test file | Final result |
| --- | --- | --- | --- | --- | --- |
| UI-01 | FR-01, FR-02, AC-01, AC-02 | Requester Selection initial and loading states | No requester-specific request occurs without selection; active options, loading, empty, failure, labels, and Continue behavior are visible. | `client/tests/lab-02/RequesterSelection.test.tsx` | Passed; six RequesterSelection tests are included in the 32-test client suite. |
| UI-02 | FR-03, FR-04, BR-06, AC-03 | Select and Change Requester | Shell shows selected name; changing context clears stale list/detail data and reloads the new context. | `client/tests/lab-02/RequesterSelection.test.tsx` | Passed; six RequesterSelection tests are included in the 32-test client suite. |
| UI-03 | FR-04, FR-06, FR-07, AC-04, AC-05 | Create Ticket valid form | Active reference controls load, valid fields submit once, success shows generated Ticket Number, and next action is visible. | `client/tests/lab-02/CreateTicket.test.tsx` | Passed; six CreateTicket tests passed. |
| UI-04 | BR-08, BR-09, BR-10, AC-06 | Create Ticket field validation | Required, trimming, length, priority, and reference errors appear near fields; invalid submit does not call the API. | `client/tests/lab-02/CreateTicket.test.tsx` | Passed; six CreateTicket tests passed. |
| UI-05 | BR-13, BR-21, AC-08, AC-10 | Busy, failure preservation, and partial upload | Submit disables while busy; API failure preserves values; partial upload keeps Ticket Number and exposes retry. | `client/tests/lab-02/CreateTicket.test.tsx` | Passed; six CreateTicket tests passed. |
| UI-06 | FR-09, FR-10, BR-14, BR-15, BR-16, BR-17, AC-11, AC-12, AC-13 | My Tickets controls and states | Search, filters, sort, pagination, empty-list, no-results, and failure states use the documented request and visible feedback. | `client/tests/lab-02/MyTickets.test.tsx` | Passed; five MyTickets tests passed. |
| UI-07 | BR-26, AC-14 | My Tickets loading and stale-data protection | Loading is announced and failure does not present old results as current. | `client/tests/lab-02/MyTickets.test.tsx` | Passed; five MyTickets tests passed. |
| UI-08 | FR-11, AC-15, AC-16 | Requester Ticket Detail | Owned detail renders read-only fields, separate Attachments section, and safe not-found state. | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Passed; three RequesterTicketDetail tests passed. |
| UI-09 | FR-12, BR-22, AC-17 | Attachment metadata presentation | Active and removed records are visible with correct labels; removed records have no preview/download action. | `client/tests/lab-02/AttachmentSection.test.tsx` | Passed; three AttachmentSection tests passed. |
| UI-10 | FR-13, BR-18, BR-19, AC-18 | Attachment validation and upload states | Type, size, count, uploading, success, and failure feedback is visible and actionable. | `client/tests/lab-02/AttachmentSection.test.tsx` | Passed; three AttachmentSection tests passed. |
| UI-11 | FR-14, FR-15, BR-24, AC-19, AC-20, AC-21 | Download, confirmation, reason, and removal | Active download is available; removal requires reason and confirmation; removed state blocks download. | `client/tests/lab-02/AttachmentSection.test.tsx` | Passed; three AttachmentSection tests passed. |
| UI-12 | FR-18, FR-19, AC-22, AC-23 | Shared labels, focus, live states, and controls | Required labels, accessible names, focus indicators, status text, disabled actions, and keyboard flow are observable. | `client/tests/lab-02/ZenGreenResponsive.test.tsx` | Passed; four Zen Green contract tests passed. |

### 3.4 Style, responsive, visual, and E2E tests

| Test ID | Requirement / AC | What it tests | Expected result | Automated test file or evidence | Final result |
| --- | --- | --- | --- | --- | --- |
| STYLE-01 | FR-18, AC-22, AC-23 | Zen Green tokens and reusable component states | Required colors, field states, badges, focus, messages, and button behavior match `ui-spec.md`. | `client/tests/lab-02/ZenGreenResponsive.test.tsx` | Passed; four Zen Green contract tests passed. |
| RESP-01 | FR-18, AC-22 | Desktop, tablet, and mobile layout | No clipping, overlap, hidden action, or horizontal scrolling at >=992px, 768-991px, and <768px. | `e2e/lab-02/requester-ticket-flow.spec.ts` | Passed; the E2E flow checked 1280px, 820px, and 390px viewports. |
| VIS-01 | FR-18, FR-19, AC-22, AC-23 | Visual checklist and screenshots | Required states and screen representations are captured under the three Lab 2 screenshot directories and reviewed against `ui-spec.md`. | `artifacts/lab-02/screenshots/` and `docs/lab-02/report/evidence/` | 36 lifecycle screenshots across 12 states and three viewports plus eight controlled desktop report-state captures are available and inspected. Seven final-main `browser-use` captures, the six-column Lab 2 Kanban board capture, and one final-main client/server test-output capture are recorded; human peer visual review remains pending. |
| E2E-01 | AC-01, AC-02, AC-03, AC-04, AC-05, AC-11, AC-12, AC-15 | Full requester flow | Select active Requester, load references, create Ticket, see Ticket Number, find it, switch Requester, and open owned detail. | `e2e/lab-02/requester-ticket-flow.spec.ts` | Passed; one Playwright test completed the requester flow. |
| E2E-02 | AC-09, AC-10, AC-17, AC-18, AC-19, AC-20, AC-21 | Full Attachment lifecycle | Upload permitted file, observe metadata, download active file, soft-remove with reason, and verify blocked removed download. | `e2e/lab-02/requester-ticket-flow.spec.ts` | Passed; upload, download, soft removal, and `410 ATTACHMENT_REMOVED` checks completed. |

## 4. Acceptance-criteria coverage

| Acceptance Criteria | Planned test IDs |
| --- | --- |
| AC-01 | UI-01, E2E-01 |
| AC-02 | API-01, UI-01, E2E-01 |
| AC-03 | UI-02, E2E-01 |
| AC-04 | API-01, UI-03, E2E-01 |
| AC-05 | UNIT-01, API-02, UI-03, E2E-01 |
| AC-06 | UNIT-02, UI-04 |
| AC-07 | UNIT-02, API-03 |
| AC-08 | API-04, UI-05 |
| AC-09 | API-05, E2E-02 |
| AC-10 | API-05, UI-05, E2E-02 |
| AC-11 | API-06, UI-06, E2E-01 |
| AC-12 | UNIT-03, API-07, UI-06, E2E-01 |
| AC-13 | API-08, UI-06 |
| AC-14 | API-08, UI-07 |
| AC-15 | API-09, UI-08, E2E-01 |
| AC-16 | API-10, UI-08 |
| AC-17 | API-11, UI-09, E2E-02 |
| AC-18 | UNIT-04, API-05, API-12, UI-10, E2E-02 |
| AC-19 | API-13, UI-11, E2E-02 |
| AC-20 | UNIT-04, API-14, UI-11, E2E-02 |
| AC-21 | API-10, API-13, API-15, UI-11, E2E-02 |
| AC-22 | STYLE-01, RESP-01, VIS-01, E2E-01, E2E-02 |
| AC-23 | UI-12, STYLE-01, VIS-01 |
| AC-24 | API-16 |

No acceptance criterion is complete until its mapped tests pass and its required evidence is reviewable.

## 5. Required paths and evidence

The Lab 2 increment must contain these required automated paths:

```text
server/tests/lab-02/
├── create-ticket.api.test.ts
├── my-tickets.api.test.ts
├── ticket-detail.api.test.ts
└── attachments.api.test.ts

client/tests/lab-02/
├── CreateTicket.test.tsx
├── MyTickets.test.tsx
├── RequesterTicketDetail.test.tsx
└── AttachmentSection.test.tsx

e2e/lab-02/
├── requester-ticket-flow.spec.ts
└── report-evidence.spec.ts
```

Additional unit, requester-selection, and responsive test files listed in the matrix are allowed and expected where they keep the contract boundaries clear.

Visual evidence is stored under `artifacts/lab-02/screenshots/create-ticket/`, `artifacts/lab-02/screenshots/my-tickets/`, and `artifacts/lab-02/screenshots/ticket-detail/`. The evidence prefixes are `create-ticket-reference-loading`, `create-ticket-validation`, `create-ticket-api-failure`, `create-ticket-success`, `my-tickets-empty`, `my-tickets-api-failure`, `my-tickets-filtered`, `my-tickets-ownership-isolation`, `ticket-detail-invalid-attachment`, `ticket-detail-active`, `ticket-detail-blocked-download`, and `ticket-detail-removed`; each has desktop, tablet, and mobile captures. Review notes and AI-use evidence are stored in `docs/lab-02/reviewer.md` and `docs/lab-02/ai-use.md` during later Issues.

## 6. Planned commands and results

| Phase | Command | Current validation result |
| --- | --- | --- |
| Client iteration | `bun run test:client` | Passed; 8 files and 32 tests. |
| Server iteration | `bun run test:server` | Passed; 13 files and 70 tests. |
| Type checking | `bun run typecheck` | Passed; client and server TypeScript checks. |
| Full test suite | `bun run test` | Passed; 21 files and 102 tests across the client and server suites. |
| Browser E2E and evidence | `bun run test:e2e` and targeted report capture | Passed on the final-main-aligned branch; 2 tests produced 36 responsive screenshots and 8 additional desktop captures. Seven final-main repository/contract/release captures were collected separately with the `browser-use` CLI, plus the final-main test-output screenshot. |
| Full repository gate | `bun run verify` | Passed on 2026-09-04 from `docs/lab2-docs` at final `main` `538b5da` with elevated local access; Biome checked 70 files, Lefthook, Prisma validation, client/server type checks, 21 test files with 102 tests, and both workspace builds completed successfully. |

The E2E and visual rows were rerun with Docker PostgreSQL available. The
handoff must still state the commands run, environment prerequisites, and any
manual visual checks.

## 7. Integrated Lab 2 execution record

- `bun run test:client`: passed, 8 files and 32 tests.
- `bun run --cwd server test -- tests/lab-02/ticket-number.unit.test.ts tests/lab-02/ticket-validation.unit.test.ts tests/lab-02/ticket-query.unit.test.ts tests/lab-02/attachment-policy.unit.test.ts`: passed, 4 files and 31 tests, including the deterministic Ticket Number collision-retry test.
- `bun run typecheck`: passed for client and server.
- `bun run build:client` and `bun run build:server`: passed.
- `bun run hooks:validate` and `bun run db:validate`: passed.
- `bun run db:up`, `bun run db:migrate`, `bun run db:seed`, and `bun run db:test:setup`: passed with PostgreSQL at `localhost:15434`.
- `bun run test:server`: passed 13 files and 70 tests, including the Unicode display-name header assertion and deterministic collision-retry test.
- `bun run test:e2e`: passed two tests on the final-main-aligned branch after validating ticket creation, ownership isolation, detail, upload, download, soft removal, removed-download rejection, all required loading/empty/failure/validation/invalid-attachment/blocked-download states, and all responsive viewports; 36 screenshots were generated under `artifacts/lab-02/screenshots/` and eight desktop captures under `docs/lab-02/report/evidence/`.
- `browser-use` CLI captures recorded the final `main` repository tree/README, `.gitignore`, commit history, rendered `specification.md` and `ui-spec.md`, release PR #70, and the Lab 2 Kanban Project board under `docs/lab-02/report/evidence/`. The board capture shows the six Lab 1-aligned workflow columns and Issues #51-#57 in `Done`.
- `bunx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --types node e2e/lab-02/report-evidence.spec.ts e2e/lab-02/requester-ticket-flow.spec.ts playwright.config.ts`: passed.
- `bunx playwright test --list`: passed and listed two tests in two files: the lifecycle flow and the targeted report-evidence capture.
- `bun run verify`: passed on 2026-09-04 with elevated local access from the final-main-aligned `docs/lab2-docs` branch. A preceding sandbox run stopped at Prisma config dependency access with `EPERM`/exit code 126 before schema validation; it is not counted as a test pass.

The lifecycle E2E run and its 36 screenshots were regenerated from the
final-main-aligned branch after release PR #70. The eight additional report
captures are UI-state evidence, and the final-main update adds the renamed
test-output screenshot plus seven browser-use captures for the released
repository, contract, history, and PR state.

## 8. Remaining evidence

- Record the human visual review and final approval evidence in `reviewer.md`.
