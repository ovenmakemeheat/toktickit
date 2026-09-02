# Lab 2 AI-use record

Issue: #57 - Lab 2 - E2E tests, evidence, and release integration
Feature branch: `feature/11-e2e-evidence`

## LLM used

OpenAI Codex (GPT-5) was used as an implementation assistant. The student
retains responsibility for checking the Lab 2 PDF-derived contracts, reviewing
the generated changes, running the tests, and responding to peer-review
comments.

## Key prompts used

1. Read the current Lab 2 issue and implementation plan before implementing the
   E2E/evidence scope.
2. Verify that the feature branch is based on the latest `lab2-staging` commit.
3. Inspect the current requester selection, ticket creation, My Tickets, detail,
   and attachment interfaces for stable user-observable selectors.
4. Implement the Playwright requester flow required by E2E-01 and E2E-02.
5. Add desktop, tablet, and mobile overflow assertions and the required
   screenshot directories.
6. Add the Playwright runner configuration without changing the Lab 2 product
   scope or adding later-lab controls.
7. Update README, test traceability, reviewer notes, and this AI-use record with
   truthful prerequisites and pending human-review fields.
8. Run targeted formatting, test listing, type checks, integration tests, and
   inspect the final diff before handoff.

## Review decisions made during implementation

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

## Reflection

The main value of AI assistance was translating the existing Lab 2 contracts and
accessible UI vocabulary into a repeatable browser flow. The important manual
responsibilities are confirming that the test follows the approved requester
context, checking the screenshot states against `ui-spec.md`, validating the
environment prerequisites, and recording human review responses in
`reviewer.md` rather than treating generated code as approval.
