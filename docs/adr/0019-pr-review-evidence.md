# ADR 0019: Treat Pull Request review as deliverable evidence

- Status: Accepted
- Date: 2026-08-04

## Decision

Each feature PR must include:

- a link to its GitHub Issue, using the required closing relation where appropriate;
- an acceptance-criteria checklist;
- the relevant passing test command/output;
- a peer reviewer assigned and recorded;
- at least one substantive review comment and the author's response;
- approval before merge.

The author fixes requested changes on the same feature branch and requests review again. The reviewer also reviews and approves the partner's PR, so both directions are evidenced in `docs/lab-01/reviewer.md`.

## Consequences

- Review is a real verification step rather than a ceremonial approval.
- The final submission can show who reviewed what and how feedback was handled.
- A PR cannot be marked Done merely because its code exists.
