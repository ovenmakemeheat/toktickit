# Lab 3 AI-use record

Scope: Lab 3 contract implementation, E2E evidence, review follow-up, and
final-main release documentation for Issues #72-#77.

Record date: 2026-09-25 (post-release closeout)

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
7. After the release PR merged, reconcile the report and evidence records with
   the final `main` revision; distinguish the previously verified release tree
   from any post-release checks blocked by local infrastructure.

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
The release is complete: PR #83 integrated into `lab3-staging`, then PR #84 was
merged into `main` by the peer reviewer. The final `main` Git tree matches the
staging tree that passed the full gate. A fresh local post-release rerun was
partially blocked because Docker Engine/PostgreSQL were unavailable; the report
records that limitation instead of presenting it as a passing run.

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
- keep the release history and formal GitHub review state distinct: PR #84 is
  recorded as merged by the peer reviewer.
- keep the GitHub project-board status accurate; this documentation update did
  not change or claim a board transition.
