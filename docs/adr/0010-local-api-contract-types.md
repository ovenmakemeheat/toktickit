# ADR 0010: Keep Lab 1 API types local to each workspace

- Status: Accepted
- Date: 2026-08-04

## Context

The monorepo contains a client and server, but Lab 1 exposes only two small read-only payloads. A shared package would add another workspace and build boundary to the required repository without solving a substantial type-sharing problem.

## Decision

Define the server response shapes where the server produces them and define corresponding client DTO types where the client consumes them. Keep the canonical behavior in the API ADR and enforce it with Supertest and Vitest tests.

Do not add a third shared workspace for Lab 1.

## Consequences

- The required `client/` and `server/` structure stays clear.
- There is minimal setup and no cross-workspace build dependency.
- If later labs introduce substantial shared contracts, that decision can be revisited with new evidence.
