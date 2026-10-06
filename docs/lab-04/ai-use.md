# Lab 4 AI-use record

- Status: ongoing; record updated as Lab 4 work proceeds.
- Record date: 2026-09-27.

## LLM used

The current contract-authoring session used the OpenAI Codex coding agent, model `gpt-6-luna`, provider `openai-codex`. The AI-assisted work created the Lab 4 engineering-contract and test-plan documents for Issue #87. No Lab 4 product implementation or test result is claimed by this record.

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
