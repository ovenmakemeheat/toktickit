# ADR 0009: Keep the Lab 1 server thin and layered

- Status: Accepted
- Date: 2026-08-04

## Context

The Lab 1 server has only two endpoints, but it must demonstrate a complete Express-to-Prisma path and return a stable error contract. Putting database calls directly in route handlers would make HTTP concerns and persistence concerns difficult to test and evolve.

## Decision

Use a small layered flow:

```text
HTTP route -> category service -> Prisma data access
```

- The application module composes middleware and routes.
- Route handlers translate HTTP input/output and delegate work.
- The category service owns the category use case and maps dependency failures to safe application errors.
- Prisma access stays behind the service boundary.
- Health is a direct liveness route because it has no database use case.

Do not introduce a general-purpose domain framework or abstractions that Lab 1 does not need.

## Consequences

- Supertest can verify routes while service behavior remains unit-testable if needed.
- Database details do not leak into HTTP handlers.
- The structure remains small enough for a student to explain and maintain.
