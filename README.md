# TokTickIT

TokTickIT is a full-stack IT service desk application built across Labs 1–4.
Lab 4 adds auditable Actions Taken, Ticket resolution controls, and role-scoped
dashboards while preserving the earlier Labs' workflows.

## Stack

- Bun workspaces
- React, TypeScript, Vite, and Bootstrap
- Node-compatible Express and TypeScript
- PostgreSQL 16 through Docker Compose
- Prisma ORM
- Biome formatter and linter
- Lefthook staged-file checks
- Vitest and Supertest
- Playwright E2E tests and visual evidence

## Prerequisites

- Bun 1.3 or newer
- Docker with Compose

## Setup

```sh
bun install
cp server/.env.example server/.env
bun run hooks:install
bun run db:up
bun run db:generate
bun run db:validate
bunx playwright install chromium
```

On Windows PowerShell, use `Copy-Item server/.env.example server/.env` instead of `cp`. Set `LAB3_SEED_PASSWORD` in the local `server/.env` to a 12-128 character development-only password containing a letter, number, and non-alphanumeric character before seeding. If port `5432` is already in use, set `POSTGRES_PORT`, `DATABASE_URL`, and `TEST_DATABASE_URL` to the same available host port in `server/.env`.

The database stack is owned by `server/`: Compose is defined in `server/docker-compose.yml`, PostgreSQL initialization is under `server/docker/`, and Prisma files remain under `server/prisma/`.

The optional `LAB3_TEST_PASSWORD` can set a separate password for isolated test fixtures; the seeded E2E helpers recognize it. Do not use real credentials.

```sh
bun run db:migrate
bun run db:seed
bun run db:test:setup
```

`db:migrate` and `db:migrate:deploy` apply the current additive Prisma migrations and then run the Lab 3 ownership migration. Existing Lab 2 Development Requesters are backfilled to Users, Ticket ownership is enforced, and any generated initial credentials are written to the ignored local path `.local/lab3-credentials.json`. Set `LAB3_MIGRATION_HANDOFF_PATH` to choose another ignored local handoff path. `db:migrate:lab3` remains available for a separately managed handoff path.

`db:seed` is repeat-safe, backfills seeded Tickets to their authenticated Requester Users, verifies the database-level ownership constraint, and includes deterministic Lab 4 Action Taken examples. Seed identities use `.test` addresses.

`db:test:setup` resets, migrates, and seeds the isolated `toktickit_test` database using `TEST_DATABASE_URL`. The test database is created by `server/docker/postgres/init/01-create-test-database.sql` on a new Compose volume. Keep `TEST_DATABASE_URL` on the same host port as `DATABASE_URL`, but point it at a different database.

## Run the application

```sh
bun run dev
```

- Client: http://localhost:5173
- API: http://localhost:3000
- PostgreSQL: localhost:5432

The Vite client proxies relative `/api` requests to the API on port 3000.

## Test and verify

```sh
bun run verify
```

`verify` runs Biome checks, Lefthook configuration validation, Prisma schema validation, TypeScript checks, tests, and both workspace builds.
API tests use the exported Express application and do not start a listener. `verify` does not run Playwright; use `bun run test:e2e` separately for the isolated seeded browser suite.

### Local demo

Run the seeded application against the development database:

```sh
bun run db:up
bun run db:migrate
bun run db:seed
bun dev
```

Use local seeded `.test` accounts and the development-only password configured in `server/.env`. Keep this database separate from the E2E database.

### Seeded E2E and release regression

Playwright loads `server/.env` and requires `TEST_DATABASE_URL` to name a database ending in `_test`, distinct from the configured development database. The root E2E command resets and reseeds that test database before every run; never point it at development or production data.

```sh
bun run test:e2e -- e2e/lab-04
# or run the full earlier-lab and Lab 4 browser regression suite
bun run test:e2e
```

The seeded Lab 4 journeys use the real API and PostgreSQL without intercepting business routes. Chromium must be installed. Playwright starts isolated API/UI servers on ports 3001/5174 and never reuses existing servers; set `E2E_API_PORT` or `E2E_UI_PORT` to alternate free ports if needed. The migration and seed integration test uses a temporary schema in `TEST_DATABASE_URL`. `bun run verify` runs the local static, Prisma, type-check, unit/API/client-test, and build gate; run E2E separately with `bun run test:e2e`.

## Scope

Lab 1 proves the client, API, Prisma, PostgreSQL, and test tooling as one
vertical slice. Lab 2 adds the temporary Development Requester context, ticket
creation/list/detail, and permitted attachment lifecycle. Lab 3 replaces that
temporary identity with authenticated Users and adds role-based workflows under
`docs/lab-03/`. Lab 4 adds the approved work-log, Ticket workflow, and dashboard
scope under `docs/lab-04/`; unapproved later-lab features remain out of scope.
