# ADR 0002: Use a Bun-managed client/server monorepo

- Status: Accepted
- Date: 2026-08-04

## Context

Lab 1 requires a repository containing separate `client/` and `server/` areas, while the empty repository needs a reproducible setup for installing dependencies, running both applications, and executing the required tests.

## Decision

Use Bun as the package manager and script runner for one monorepo:

- `client/` is the React + TypeScript + Vite + Bootstrap workspace.
- `server/` is the Node.js-compatible Express + TypeScript workspace.
- Prisma schema and migrations live under `server/prisma/`.
- Lab 1 server tests live under `server/tests/lab-01/` and use Supertest.
- Client tests use Vitest.

The server remains compatible with the required Node.js + Express stack even though Bun manages and runs the workspace commands.

## Consequences

- A single clone and `bun install` can set up both application layers.
- Root scripts can coordinate client, server, Prisma, and test commands.
- The README must document Bun as the prerequisite and show the exact local workflow.
- Runtime-specific Bun APIs should not replace the required Express/Node-compatible application contract.
