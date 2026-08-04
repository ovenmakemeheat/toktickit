# ADR 0020: Use the required Kanban statuses as a delivery state machine

- Status: Accepted
- Date: 2026-08-04

## Decision

Create the GitHub Project board with these statuses in this exact order:

```text
Backlog -> Specified -> Started -> PR Review -> Fixing -> Done
```

- `Backlog`: the Issue exists but has not been reviewed and understood.
- `Specified`: requirements and acceptance criteria are understood.
- `Started`: the active feature branch is being implemented.
- `PR Review`: a Pull Request is open and under peer review.
- `Fixing`: review feedback or failed tests require changes on the same branch.
- `Done`: the PR is approved, tests pass, it is merged into `lab1-staging`, and acceptance criteria are satisfied.

Only the Issue currently being implemented moves to `Started`. Issues return from `Fixing` to `PR Review` after corrections; completed Issues do not bypass review.

## Consequences

- Board state communicates both understanding and delivery state.
- The final board can serve as submission evidence.
- Workflow status cannot be used to hide missing tests, review, or acceptance evidence.
