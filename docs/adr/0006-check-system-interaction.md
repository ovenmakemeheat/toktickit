# ADR 0006: Model Check System as an explicit request state

- Status: Accepted
- Date: 2026-08-04

## Context

Lab 1 needs a small client that proves the API health and category endpoints through a real interaction. The requirements explicitly call for a loading state, successful status/category output, and a useful failure message.

## Decision

The initial page is idle and performs no request. Clicking `[Check System]`:

1. enters a visible loading state immediately;
2. starts `GET /api/health` and `GET /api/categories` in parallel;
3. renders health and category values from the respective API responses;
4. treats any failed request as an overall `Offline` result, clears stale category data, and renders `Unable to connect to TokTickIT API`.

The client will use an explicit, typed request-state model rather than hard-coded category values or an additional state-management library. This avoids presenting a misleading mixture of a fresh health result and stale categories.

## Consequences

- UI-01, UI-02, and UI-03 can test observable state transitions.
- The demo visibly proves two real HTTP requests.
- Refreshing/rechecking has a clear lifecycle instead of stale implicit state.
- The client remains small and easy to explain in the required AI-use reflection.
