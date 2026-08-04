# ADR 0008: Run API tests against an isolated database

- Status: Accepted
- Date: 2026-08-04

## Context

API-02 must verify that categories travel through Express, Prisma, and PostgreSQL. Using the developer database would make the result depend on a user's local state and could let tests alter work data as the suite grows.

## Decision

Use a separate `toktickit_test` database on the same Docker Compose PostgreSQL service. The documented test setup will:

1. ensure the test database exists;
2. apply Prisma migrations to it;
3. run the idempotent category seed;
4. run Supertest with its `DATABASE_URL` pointed at that database.

The normal development database remains `toktickit`.

## Consequences

- API tests are repeatable and do not depend on developer data.
- The repository needs explicit Bun scripts and documentation for test-database setup.
- The database setup must be safe to run repeatedly and must not commit credentials.
