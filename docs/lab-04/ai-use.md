# Lab 4 AI-use record

- Status: ongoing; Issue #90 automated regression/evidence work is in progress. Human peer review and the remaining VIS-01 accessibility sign-off are still pending.
- Record date: 2026-09-27; updated: 2026-10-22.

## LLM used

The Issue #87 contract-authoring and Issue #90 implementation sessions used the OpenAI Codex coding agent, model `gpt-6-luna`, provider `openai-codex`. AI-assisted Issue #90 work added isolated seeded Playwright regression journeys, a Lab 3-shaped additive-migration/repeat-safe-seed integration test, and current setup/evidence documentation. Automated results are recorded in `tests.md`; they do not constitute peer review or a complete accessibility sign-off.

## Selected key prompts

These selected user prompts capture the main specification, planning, workflow, and current implementation directions (8 prompts, within the handout's required 6–10):

1. “on @docs/lab-04/requirements/UTF-8_SE+Lab+4.pdf”
2. “this should break down into tickets issues (use my issues format)”
3. “make sure you keep every requirement”
4. “create a project board for lab 4”
5. “using kanban as main”
6. “next let's create lab 4 staging branch”
7. “edit issue propose branch number to increment continuing with lab3 number branch name”
8. “now get into first branch and start implement”
9. “Implement Issue #90.”

## Issue #90 work and verification

AI-assisted changes added the real seeded Action Taken and resolution/reopen Playwright journeys, the role/API/navigation and browser-hardening report, a Lab 3-shaped migration/repeat-safe-seed integration test, safe E2E database/port isolation, and refreshed setup/release evidence. The verified working tree is based on `47d6487b638939835403ea0da7c0e3f011078b7b` and was uncommitted during testing.

- `bun run verify` — passed: client 19 files / 72 tests, server 29 files / 170 tests, lint/hooks, Prisma validation, type checks, and builds.
- `bun run test:e2e` — passed: 19 Chromium tests across Labs 2–4 against the isolated PostgreSQL test database.
- Targeted `migration-seed.api.test.ts` — passed: 1 test; built Express app import under Node also passed.
- E2E-04 machine-readable evidence: `artifacts/lab-04/e2e/e2e-04-hardening/run-report.json`.

These automated results are not peer approval or a complete accessibility sign-off. VIS-01, formal DOC-01 review, and release integration remain pending.

## My Reflection

> Drafted with AI assistance; the student must review and personalize this reflection before submission so it describes their own experience accurately.

The specification work starts from the UTF-8 Lab 4 handout and parent issue #86, then turns those requirements into four linked implementation issues. For Issue #87, the AI compared the handout and parent contract, mapped the Actions Taken, role, status, dashboard, migration, accessibility, regression, and evidence decisions into the specification/API/UI/test documents, and kept all test outcomes marked as planned rather than passed.

One technical choice made explicit in the contract is a separate `lastReopenedAt` marker. Ticket `updatedAt` also changes when an Action Taken is created or edited, so it is not a stable boundary for enforcing the requirement that a reopened Ticket needs newly recorded work before another resolution. This marker is internal and adds no user-facing history feature. The contract records this implementation choice for human review; it is separate from the explicit parent #86 role decision.

The coding-agent work on this branch is documentation only. The AI cannot approve its own specification, establish that a planned test passed, or act as peer reviewer. The student must read the source PDF, verify every rule and calculation, decide whether to accept or revise the proposed contract, review generated changes, run the tests on the actual implementation, and obtain human peer review.

## Human responsibility

The student remains responsible for:

- Comparing the contract package against the complete Lab 4 handout and parent issue #86.
- Reviewing exact role permissions, the complete status matrix, resolution and reopen gates, database migration/backfill, dashboard calculations, and all excluded features.
- Reviewing the `lastReopenedAt` implementation choice and ensuring the explicit parent #86 Administrator permission decision is followed: operational Dashboard/Queue/Ticket Detail/Action Taken/status access, retained User Management and Ticket Review/IT-Priority, but read-only Public Comments/Internal Notes; IT Staff write permissions and Requester-owned Public Comment authoring remain intact.
- Verifying that each acceptance criterion maps to a meaningful external-behavior test and that planned files actually exist before recording a test as executed.
- Running the real project verification and seeded E2E journeys, recording exact commands/revision/environment/results, and inspecting desktop/tablet/mobile evidence.
- Answering every review comment and ensuring the peer reviewer—not the PR author—merges feature work.
- Maintaining accurate issue, project-board, review, AI-use, and release evidence; the final release source of truth is `main`.
