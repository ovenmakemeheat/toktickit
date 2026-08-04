# ADR 0001: Scope the current work to Lab 1

- Status: Accepted
- Date: 2026-08-04

## Context

TokTickIT is intended to grow across Labs 1–4, but the current requirements define a complete Lab 1 vertical slice and explicitly defer authentication, ticket creation, image upload, and later product behavior.

## Decision

The current design and implementation will target Lab 1 only:

- React + TypeScript + Vite + Bootstrap client
- Node.js + Express + TypeScript server
- Prisma + PostgreSQL persistence
- `GET /api/health` and `GET /api/categories`
- the required automated tests, GitHub workflow, and submission evidence

The final Labs 1–4 ticket model and role-specific features remain context for future work, not implementation scope for this session.

## Consequences

- The design can stay small enough to prove the full stack end to end.
- The four required Lab 1 Issues remain the unit of delivery.
- Future entities and permissions must not leak into the Lab 1 database or API unless the requirements explicitly require them.
