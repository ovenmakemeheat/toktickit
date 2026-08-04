# ADR 0018: Deliver Lab 1 through four dependency-aware Issues

- Status: Accepted
- Date: 2026-08-04

## Decision

Create all four Issues and add them to the GitHub Project before implementation:

1. `feature/1-project-foundation`
2. `feature/2-health-check`
3. `feature/3-category-seed`
4. `feature/4-category-list`

Issues 1–3 branch from an up-to-date `main`. Issue 4 branches from `lab1-staging` after Issue 3 is available there because it consumes the category data path. Every feature Pull Request targets `lab1-staging`; after all four are complete, open one release Pull Request from `lab1-staging` to `main`.

Do not commit directly to `main` or `lab1-staging`. Peer review is mandatory in both directions, and a feature is complete only after its PR is approved, tests pass, and it is merged.

## Consequences

- The branch history demonstrates the required feature → staging → main flow.
- Issue 4 has the dependency it needs without merging unfinished work to `main`.
- The Project board and Pull Requests provide traceable delivery evidence.
