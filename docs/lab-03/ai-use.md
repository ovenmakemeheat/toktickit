# Lab 3 AI-use record

Scope: Lab 3 contract implementation, E2E evidence, review follow-up, and
release-readiness documentation for Issues #72-#77.

Record date: 2026-09-18

## LLM used

OpenAI Codex coding agent (`gpt-5.6-luna`, provider `openai-codex`, maximum
reasoning) was used as an implementation assistant. The student retains
responsibility for reading the UTF-8 Lab 3 handout, confirming the approved
scope, reviewing generated changes, running the repository gates, inspecting
screenshots, and responding to every human review comment.

## Selected prompts used

1. Read the Lab 3 repository instructions, issues, Pull Requests, and the
   PDF-derived contract before starting the next issue branch.
2. Verify that the next feature branch inherits the latest merged
   `lab3-staging` commit rather than an earlier feature branch.
3. Implement only Issue #77: browser E2E coverage for authentication,
   Requester regression, IT Staff operations, Administrator management, and
   release smoke checks.
4. Add actual final evidence records for test outputs, screenshots, review
   conversations, AI use, and the single Answer Part 1-9 PDF.
5. Check accessible roles/labels, direct role-route boundaries, queue/detail
   operations, public/private communication, and Administrator read-only
   boundaries in Playwright.
6. Run the focused E2E suites and then the repository verification commands;
   record the exact branch, commit, prerequisites, and results without
   presenting a mocked browser test as proof of backend authorization.

## Specification-agent / coding-agent reflection

The specification work established a useful boundary: Issue #77 integrates
already-reviewed Lab 3 product slices instead of adding another product
feature. That led to separate E2E files for authentication/Requester,
IT Staff, Administrator, responsive/accessibility, and release smoke checks.
The existing unit, API, and client tests remain the stronger evidence for
server authorization, migration, session safety, and database invariants; the
Playwright fixtures verify the user-observable journeys and role-specific
controls.

The coding agent also found that the pre-existing test plan named several
planned files that were intentionally consolidated into the actual Lab 3 test
files. The final evidence therefore records both the exact executed commands
and the actual file locations instead of claiming that a missing file passed.
The final release boundary remains explicit: this branch targets
`lab3-staging`; only a human reviewer may merge the integration PR and prepare
or merge the later `lab3-staging` to `main` release PR.

## Human responsibility

The student must still:

- compare the implementation and evidence against the PDF and the approved
  `docs/lab-03/specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md`;
- review each generated diff and inspect the committed screenshots at
  desktop/tablet/mobile sizes;
- verify local database prerequisites, seeded fixture behavior, and the
  migration handoff cleanup without committing credentials;
- distinguish mocked Playwright API fixtures from real Supertest/PostgreSQL
  authorization and migration evidence;
- answer all review comments, obtain human peer review, and ensure the peer
  reviewer—not the PR author—merges the feature PR;
- verify the integrated `lab3-staging` branch before asking for a separately
  reviewed release PR to `main`.
