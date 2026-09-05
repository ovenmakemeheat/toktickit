# Lab 2 AI-use record

Scope: Whole Lab 2 implementation, evidence, review, and report preparation

Record date: 2026-09-05

## LLM used

OpenAI Codex (GPT-5.6 Luna max) was used as an implementation assistant across the Lab 2
contract, database/API work, requester UI, tests, E2E evidence, review fixes,
and report preparation. The student retains responsibility for checking the
Lab 2 PDF-derived contracts, reviewing generated changes, running the tests,
and responding to peer-review comments.

## Key prompts used

1. Read the Lab 2 PDF and convert its requester workflows, boundaries, and
   submission parts into a numbered engineering contract.
2. Create the Issues/branch plan and verify that each feature branch starts from
   the Lab 2 staging baseline.
3. Implement the database, seed data, requester test context, API contract, and
   ownership/error boundaries without adding authentication or later-lab scope.
4. Implement Create Ticket, My Tickets, Ticket Detail, and attachment lifecycle
   behavior against the approved contracts.
5. Add unit, API/integration, client UI, responsive, and E2E tests with explicit
   FR/BR/AC traceability.
6. Inspect the requester flow at desktop, tablet, and mobile sizes and generate
   the required screenshot evidence.
7. Review the complete Lab 2 PR sequence, address reviewer comments, and update
   the reviewer, test, visual, and AI-use records with verified current state.
8. Check report readiness against Answer Parts 1-9, capture final-main evidence
   with the `browser-use` CLI, and distinguish verified evidence from the
   human-review items that remain open.

## Review decisions made during implementation

- The temporary requester selector is documented as a testing context, not
  authentication or authorization.
- The E2E test uses accessible roles and labels for the user flow; CSS selectors
  are limited to choosing the visible table/card representation and removed
  attachment state for responsive assertions.
- The ticket summary is unique per run so the test can search the created ticket
  without resetting the development database.
- The test verifies the active download through both the browser download event
  and the successful API response, then verifies the removed download returns
  the documented `410 ATTACHMENT_REMOVED` response.
- Retries remain disabled so a flaky or failed required test cannot be hidden.
- The test runner starts or reuses the local client/API process but does not
  perform destructive database resets.
- Review records separate automated Codex suggestions from human reviewer
  decisions and do not treat a bot comment as peer approval.
- The shared test-fixture isolation fix was kept as a separate Issue/branch
  (#68, `feature/13-test-isolation`) and released through PR #69 before the
  staging-to-main release PR #70.
- The final-main browser-use captures cover the repository tree, README,
  `.gitignore`, history, rendered specification/UI specification, release PR,
  and the Lab 2 Kanban Project 2 board; the board shows the six Lab 1-aligned
  workflow columns and Issues #51-#57 in `Done`.

## Reflection

The main value of AI assistance was translating the PDF into traceable contracts
and then keeping implementation, tests, evidence, and review records aligned.
The important manual responsibilities are confirming the scope, checking the
requester context and ownership behavior, inspecting screenshots against
`ui-spec.md`, validating environment prerequisites, reviewing every generated
change, and recording human review responses in `reviewer.md` rather than
treating generated code or automated review as approval.
