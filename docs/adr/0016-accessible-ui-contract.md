# ADR 0016: Make the Lab 1 system-check states accessible and user-observable

- Status: Accepted
- Date: 2026-08-04

## Decision

Use semantic HTML and accessible names for the heading, button, category list, and status/error output. Status, loading, and error changes are exposed through an appropriate live region. Vitest tests query by accessible role and visible text rather than CSS class names or component internals.

## Consequences

- The screen is usable and understandable beyond a screenshot.
- UI tests validate the behavior a user can observe.
- Bootstrap classes remain presentation details and can change without rewriting the test contract.
