# ADR 0003: Provision PostgreSQL with Docker Compose

- Status: Accepted
- Date: 2026-08-04

## Context

Lab 1 requires PostgreSQL to be reachable, Prisma to be initialized, migrations to run, and the category seed to be repeatable. The repository must work across student machines without relying on an undocumented local database installation.

## Decision

Provide PostgreSQL through a repository-owned Docker Compose service:

- pin the PostgreSQL image tag rather than using `latest`;
- persist data with a named development volume;
- keep connection settings in environment variables;
- commit `.env.example`, never real credentials;
- run Prisma migrations and the idempotent category seed through documented Bun scripts.

Use the pinned `postgres:16` image for the development service.

## Consequences

- Setup is consistent and easy to reset for a lab submission.
- The README must document starting and stopping the database, applying migrations, and seeding.
- Database credentials and local state stay outside Git-tracked source files.
