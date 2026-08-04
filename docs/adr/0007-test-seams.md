# ADR 0007: Keep API and UI tests isolated at their application seams

- Status: Accepted
- Date: 2026-08-04

## Context

Lab 1 requires Supertest evidence for API behavior and Vitest evidence for UI behavior. Tests should verify the real application boundaries without requiring a listening HTTP server or a browser-connected backend for every UI test.

## Decision

- Export the configured Express application from a module separate from the process entry point.
- Keep `server.listen()` in the runtime entry module only.
- Use Supertest against the exported app for API-01 and API-02.
- Mock the client `fetch` boundary in Vitest for UI-01, UI-02, and UI-03.
- Exercise real server routing, validation/error handling, Prisma access, and seeded data in the API tests; do not replace the server with mocks there.

## Consequences

- Supertest runs without port conflicts or manual server cleanup.
- UI tests deterministically cover idle/loading/success/error behavior.
- The test suite remains fast and its responsibility boundaries are easy to explain.
- API database lifecycle and isolation must be defined separately.
