# Lab 2 implementation plan

Status: Lab 2 implementation released to `main`; final evidence update in progress (2026-09-04)

Source: [Lab 2 requirements](../requirements/UTF-8_Lab_02_labsheet-1.pdf)

## Goal

Extend the Lab 1 TokTickIT foundation into a requester-facing ticketing MVP. A selected Development Requester must be able to create a ticket, find only their own tickets, open ticket detail, and manage permitted attachments through a responsive Zen Green UI.

The plan was created from the Lab 1 release on `main` and established the
contract-first Lab 2 workflow. The integrated result is now released to
`main`; the current documentation branch records final-main evidence without
changing the product baseline.

## Current Lab 2 state

As of 2026-09-04, the whole Lab 2 implementation is integrated on
`lab2-staging` at `f6d00cb`. Issues #51-#57 and the test-isolation follow-up
Issue #68 are implemented; PRs #58-#64 and #69 are merged by the human
reviewer `MadMax168`. Report Issue #65 was integrated by PR #66, and release
PR #70 merged the result into `main` at `538b5da`. The current branch is
`docs/lab2-docs`, based on final `main`, and contains the LaTeX update plus
final-main repository, contract, release, and test-output evidence. The
The authenticated `browser-use` CLI capture of Project 2 records the Lab 2
View 1 board with Issues #51-#57 in `Done`.

The recorded final-main-aligned validation passes: 8 client test files/32
tests, 13 server test files/70 tests, both builds, type checks, hooks/Prisma
validation, and `bun run verify`. Issue #57 records one non-skipped lifecycle
E2E flow and 36 responsive screenshots; the report branch adds one targeted
evidence test and eight desktop report captures. Seven final-main repository,
contract, and release captures were collected with the `browser-use` CLI, and
the final-main client/server test output was captured separately. The remaining
submission gap is human visual/approval evidence. The final-main-aligned E2E
flow has also been rerun successfully.

## Scope boundary

### Included

- Development Requester Selection as a temporary testing context.
- Create Ticket, My Tickets, and Requester Ticket Detail screens.
- Backend-generated unique Ticket Number and initial `New` status.
- Category, Related System, Requested Priority, Summary, Description, and Ticket Date data.
- Search, filtering, sorting, and pagination for the selected Requester's tickets.
- Attachment validation, upload, metadata, active download, and soft removal.
- Ownership checks, validation, loading, empty, no-results, failure, and responsive states.
- Reusable Zen Green form, list, badge, validation, loading, empty, error, and layout conventions.
- Traceable unit, API/integration, UI, style, responsive, visual, and E2E evidence.

### Explicitly excluded

- Real authentication, login, logout, passwords, sessions, tokens, or role-based authorization.
- IT Staff dashboards, queues, ownership controls, reassignment, or IT Priority changes.
- Public Comments, Internal Notes, Actions Taken, and event/work logs.
- Ticket status transitions after the initial `New` status.
- Administrator functions and reference-data management.

The supplied Ticket Detail illustration is a visual reference only. Its staff, comments, workflow, and later-lab controls must not be copied into Lab 2.

## Contract-first deliverables

These files were created as the contract-first input to implementation and are
now maintained as the current Lab 2 records:

| File                             | Required content                                                                                                             | Exit condition                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `docs/lab-02/specification.md` | Sprint goal, stakeholder interpretation, scope, FRs, BRs, UI summary, data changes, API summary, ACs, DoD, assumptions       | Every material ambiguity is resolved and every rule is numbered and testable.                             |
| `docs/lab-02/tests.md`         | Test strategy, planned-test table, AC-to-test traceability, test paths, responsive/visual checklist, commands, results       | Every AC maps to at least one planned test; no test is invented after implementation.                     |
| `docs/lab-02/ui-spec.md`       | Tokens, typography, spacing, field states, screen layouts, feedback states, accessibility, breakpoints, screenshot checklist | Create, list, detail, and attachment behavior is implementable without relying on the illustration alone. |
| `docs/lab-02/api-spec.md`      | Endpoints, parameters, request/response shapes, validation, ownership, pagination, errors, and status codes                  | Client and server can implement the same contract, including failure cases.                               |
| `docs/lab-02/reviewer.md`      | Reviewer identity, PR links, comments, responses, and approvals                                                              | Maintained during review rather than reconstructed at the end.                                            |
| `docs/lab-02/ai-use.md`        | LLM used, 6-10 key prompts, review decisions, and short reflection                                                           | Student review and responsibility are visible.                                                            |

## Implementation sequence

### 0. Baseline and delivery setup

- Confirm Lab 1 is clean and passing from `main`.
- Create `lab2-staging` from the completed Lab 1 `main` branch.
- Create one feature branch per approved Lab 2 issue. Do not develop directly on `main` or `lab2-staging`.
- Record the local database port and any manual setup detail in the issue notes.

Baseline gate: `bun run verify` passes before Lab 2 changes begin.

### 1. Approve the engineering contract

- Write the four contract files listed above.
- Define FR, BR, and AC identifiers and keep them stable as implementation proceeds.
- Decide and document field ownership, required fields, trimming and length limits, allowed priority values, ticket-number format, date semantics, duplicate-submission behavior, and inactive Requester behavior.
- Define the temporary identity boundary clearly: `requesterId` or equivalent is a test context, not authorization.
- Define the attachment transaction or compensation strategy before API coding.

Gate: a human approves `specification.md`, `tests.md`, `ui-spec.md`, and `api-spec.md`; the coding agent receives these exact files as its contract.

### 2. Expand the database and seed safely

Proposed models, subject to the approved specification:

- `Category`: preserve the Lab 1 names and API shape while adding an active flag or documented equivalent for active-only reference-data responses.
- `RelatedSystem`: seeded service, application, device, or platform with an active flag.
- `DevelopmentRequester`: name, email, active flag, timestamps, and a stable unique seed key or email.
- `Ticket`: internal ID, unique official Ticket Number, server timestamp, requester/category/system foreign keys, summary, description, requested priority, current status defaulting to `New`, and timestamps.
- `Attachment`: ticket foreign key, generated storage key, safe display filename, MIME type, size, upload timestamp, nullable removal timestamp, removal reason, and any approved removal metadata.

Design and migration checks:

- Enforce foreign keys and the unique Ticket Number constraint in PostgreSQL.
- Add indexes justified by requester ownership, ticket ordering, search/filter fields, and active attachment counting.
- Represent soft removal without deleting attachment metadata.
- Keep the schema ready for Lab 3 to connect a real identity without pretending Lab 2 has authentication.
- Make seed operations repeat-safe.
- Seed the four required categories, at least six Related Systems, at least four active Development Requesters, and at least one inactive Development Requester. The inactive Requester must not appear in the selector.
- Add schema, migration, seed, and test-database coverage under the existing `server/prisma/` and `server/tests/` conventions.

Recommended attachment storage decision: keep database metadata separate from a storage adapter that uses generated non-user-controlled keys in an ignored local storage directory for development and tests. Never use the original filename as a path. Document cleanup and retry behavior, and leave the adapter boundary suitable for a later object-storage implementation.

Gate: migration, repeatable seed, active-reference queries, and isolated test database setup pass.

### 3. Implement the API contract and shared validation

Extend the importable Express app and keep listener startup in `server/src/index.ts`. Use Node-compatible dependencies and preserve relative `/api` access from the client.

The contract must cover at least:

| Capability            | Route family                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------- |
| Active reference data | `GET /api/categories`, `GET /api/related-systems`, `GET /api/development-requesters`    |
| Ticket creation       | `POST /api/tickets`                                                                         |
| Owned ticket list     | `GET /api/tickets` with requester context and documented search/filter/sort/page parameters |
| Owned ticket detail   | `GET /api/tickets/:ticketId`                                                                |
| Attachment lifecycle  | upload, metadata, active download, and soft removal routes under tickets/attachments          |

Before coding, finalize the exact requester-context transport, query parameter names, sortable/filterable fields, default and secondary sort, page numbering, permitted page sizes, response metadata, and invalid-parameter behavior in `api-spec.md`.

Validation and error requirements:

- Validate at the API boundary as well as in the client.
- Return documented safe errors without stack traces or storage paths.
- Choose and document statuses for success, invalid input, missing resources, ownership failures, conflicts, unsupported types, oversized files, and unexpected failures. Prefer a non-disclosing ownership response such as `404` if consistent with the approved contract.
- Reject inactive or unknown Requesters for new requester-context operations.
- Prevent duplicate ticket creation through a disabled/busy submit state and the approved backend or request-id policy.
- Keep validation and ticket-number generation in testable service functions rather than embedding all behavior in route handlers.

### 4. Build the Development Requester context and application shell

- Replace the Lab 1 system-check-only screen with a small shell that shows TokTickIT identity, active navigation, current Requester, My Tickets, Create Ticket, and Change Requester.
- Load only active Requesters from PostgreSQL.
- Implement selector loading, empty, API-failure, keyboard-accessible, and responsive states.
- Store the selected Requester using the approved client-side context mechanism and reload requester-specific data after switching.
- Label the screen and shell as a Lab 2 testing mechanism, not a login system.

Gate: switching between two Requesters changes all subsequent list/detail context; no inactive Requester is selectable.

### 5. Implement Create Ticket

The Create Ticket screen must include:

- Read-only Requester context and system-generated Ticket Number/Date behavior.
- Category and Related System selections loaded from the API.
- Requested Priority, required Summary, required Description, and Attachments.
- Field-level required, trimming, length, allowed-value, and attachment errors.
- Initial, loading, validation, submitting, success, API-failure, and invalid-attachment states.
- A disabled busy Submit button and a success state that displays the backend Ticket Number.
- Form-value preservation after API failure and a clear next action after success.

Implement the approved attachment strategy. If ticket creation and upload are separate operations, preserve a successfully created ticket when an upload fails, show the partial failure, and provide the documented retry/cleanup path.

Gate: a valid submission saves backend values and displays the backend Ticket Number; invalid submission does not call the API; failed submission preserves user input.

### 6. Implement My Tickets

- Use the selected Requester's ownership context for every list request.
- Implement the documented search, filters, sort controls, clear-filters action, and pagination metadata.
- Show enough information to identify and open a ticket, such as Ticket Number, date, Summary, Category, Requested Priority, Current Status, and Last Updated, subject to the approved UI spec.
- Provide loading, empty-list, no-results, and API-failure states.
- Use a readable desktop table and a usable mobile card or responsive-table representation.
- Reload and reset context-sensitive data after Requester switching.

Gate: Requester A cannot see Requester B tickets after switching; list queries produce deterministic results for search, filters, sorting, and pages.

### 7. Implement Requester Ticket Detail and attachments

- Retrieve only the selected Requester’s ticket and return a safe missing/ownership response for another Requester’s ticket.
- Render ticket fields as read-only and keep attachment actions visually separate.
- Show active attachment metadata and support permitted upload, metadata retrieval, and active download.
- Enforce JPG/JPEG, PNG, WEBP, and PDF types, a 5 MB per-file limit, and a maximum of five active attachments per ticket on the server and client.
- Soft-remove only an owned attachment, require the approved confirmation/reason behavior, retain metadata, and prevent preview/download after removal.
- Show uploading, invalid, active, removed, unavailable, success, and failure states.
- Do not add comments, internal notes, Actions Taken, staff controls, or status changes.

Gate: an owned active attachment can be downloaded, a removed attachment remains visible as metadata but cannot be downloaded or previewed, and cross-Requester ticket/attachment access is rejected.

### 8. Test, inspect, and collect evidence

Planned automated paths:

| Level                  | Planned path                                                                  | Coverage focus                                                                 |
| ---------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Server API/integration | `server/tests/lab-02/create-ticket.api.test.ts`                             | Creation, validation, defaults, duplicate prevention, safe errors              |
| Server API/integration | `server/tests/lab-02/my-tickets.api.test.ts`                                | Ownership, query behavior, empty/no-results, pagination                        |
| Server API/integration | `server/tests/lab-02/ticket-detail.api.test.ts`                             | Owned detail and cross-Requester rejection                                     |
| Server API/integration | `server/tests/lab-02/attachments.api.test.ts`                               | Type/size/count limits, upload, download, soft removal                         |
| Server unit            | `server/tests/lab-02/ticket-number.unit.test.ts` or the approved equivalent | Ticket Number format and uniqueness behavior                                   |
| Client UI              | `client/tests/lab-02/CreateTicket.test.tsx`                                  | Form states, validation, busy submit, success, failure preservation            |
| Client UI              | `client/tests/lab-02/MyTickets.test.tsx`                                     | Search, filters, sorting, pagination, empty/no-results/failure                 |
| Client UI              | `client/tests/lab-02/RequesterTicketDetail.test.tsx`                         | Read-only detail, ownership error, navigation                                  |
| Client UI              | `client/tests/lab-02/AttachmentSection.test.tsx`                             | Upload, invalid, active, removed, and blocked-download states                  |
| UI style/responsive    | Approved client style test path plus Playwright viewport assertions           | Zen Green tokens, labels, focus, breakpoints, no overflow                      |
| E2E                    | `e2e/lab-02/requester-ticket-flow.spec.ts`                                  | Select Requester, create, find, switch Requester, detail, attachment lifecycle |

Every test must identify its FR/BR/AC mapping in `tests.md`. Include happy paths, invalid input, boundaries, ownership, failures, loading/empty states, multi-Requester behavior, responsive behavior, and the complete attachment lifecycle. Do not skip or disable required tests.

Capture evidence under:

- `artifacts/lab-02/screenshots/create-ticket/`
- `artifacts/lab-02/screenshots/my-tickets/`
- `artifacts/lab-02/screenshots/ticket-detail/`

Capture desktop at `>= 992 px`, tablet at `768-991 px`, and mobile below `768 px`. Include the states required for the nine submission parts: requester selection, reference-data loading, invalid form, submitting, success with backend Ticket Number, API failure with preserved values, invalid attachment, ownership isolation, search/filter/sort/page, empty/no-results, active download, soft removal, blocked removed download, and responsive visual checks. The current 36-file inventory covers 12 state prefixes. The report branch adds dedicated requester-selection, initial-form, submitting, mixed-attachment, and query-control captures under `docs/lab-02/report/evidence/`. Use `browser-use` CLI captures for the final-main repository tree/README, `.gitignore`, history, rendered specification/UI specification, and release PR; do not claim staging captures as final-`main` evidence.

### 9. Review, integration, and submission

- Keep each feature branch focused on one approved issue and merge it into `lab2-staging` only through a peer-reviewed PR.
- Run integration tests against the isolated test database after each merge.
- Open one release PR from `lab2-staging` to `main`; the reviewer must merge it after approval. Do not change PR or main-issue state without human action.
- Update `reviewer.md`, `ai-use.md`, README setup/usage instructions, and the final evidence links.
- Produce exactly one concise submission PDF with headings `Answer Part 1` through `Answer Part 9` in order. Keep the repository and final `main` branch as the source of truth.

## Branch plan

Branch numbering continues from the previous Lab 1 branch `feature/4-category-list`. Lab 2 uses the format `feature/<number>-<feature-name>`. Each Issue has one independent feature branch, created from `lab2-staging`; do not stack one Lab 2 feature branch on another.

### Branch tree

```text
main (538b5da, Lab 2 release; PR #70)
├── lab2-staging (f6d00cb, integrated Lab 2 baseline)
    ├── feature/5-sprint-specification   (#51)
    ├── feature/6-requester-context     (#52)
    ├── feature/7-create-ticket         (#53)
    ├── feature/8-my-tickets            (#54)
    ├── feature/9-ticket-detail         (#55)
    ├── feature/10-zen-green            (#56)
    ├── feature/11-e2e-evidence          (#57)
    ├── feature/12-report-compliance     (#65)
    └── feature/13-test-isolation        (#68)

└── docs/lab2-docs (current evidence branch, based on main)

Each feature branch ── peer-reviewed PR ──> lab2-staging
lab2-staging ── release PR after integration ──> main
```

The dependency order in the table below controls implementation readiness; it does not change the branch base. Every feature branch remains based on `lab2-staging`.

| Issue | Feature branch | Depends on |
| ----- | -------------- | ---------- |
| #51 | `feature/5-sprint-specification` | Lab 1 complete; `lab2-staging` |
| #52 | `feature/6-requester-context` | #51 |
| #53 | `feature/7-create-ticket` | #51, #52 |
| #54 | `feature/8-my-tickets` | #51, #52, #53 |
| #55 | `feature/9-ticket-detail` | #51, #52, #53 |
| #56 | `feature/10-zen-green` | #51, #53, #54, #55 |
| #57 | `feature/11-e2e-evidence` | #51, #52, #53, #54, #55, #56 |
| #65 | `feature/12-report-compliance` | #57 |

Branch workflow:

- The seven implementation branches above were created from `lab2-staging`; the report branch `feature/12-report-compliance` was integrated by PR #66. The test-isolation branch `feature/13-test-isolation` was integrated by PR #69. The current evidence branch is `docs/lab2-docs`, created from final `main` after release PR #70.
- Each feature branch targets `lab2-staging` through its own peer-reviewed Pull Request linked to the corresponding Issue.
- The PR author does not merge their own PR. The reviewer merges only after review comments have been answered.
- Run integration testing on `lab2-staging` after the feature PRs are integrated. The current recorded run passes.
- Open one release Pull Request from `lab2-staging` to `main` after integration testing. Release PR #70 is merged.
- Do not commit directly to `main` or `lab2-staging`.
- Continue the numbering with `feature/12-<feature-name>` for any newly approved Lab 2 feature.

## Final verification gate

From the repository root, run the narrowest relevant commands while iterating, then run the full gate:

```sh
bun run db:generate
bun run db:validate
bun run db:migrate
bun run db:seed
bun run db:test:setup
bun run test
bun run typecheck
bun run build
bun run verify
```

Before handoff, also review `git status`, `git diff --check`, changed dependencies, migrations, generated files, screenshot readability, and the final contract-to-test traceability. Do not use `docker compose down -v` during normal development.

The 2026-09-04 elevated local run of `bun run verify` passed on the
final-main-aligned `docs/lab2-docs` branch at `538b5da`. A normal sandbox
invocation stopped at Prisma dependency access with `EPERM` before schema
validation; that failed invocation is not counted as a pass.

## Immediate next actions

1. Record the human visual review and approval evidence in `reviewer.md`.
2. Complete the single submission PDF update on `docs/lab2-docs` and open its
   linked PR according to the Lab 2 review rules.
