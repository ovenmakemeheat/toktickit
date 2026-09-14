# TokTickIT

TokTickIT is the Lab 1/Lab 2 full-stack foundation for the IT service desk
application, with Lab 3 authentication and role-based workflows being delivered
incrementally.

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

On Windows PowerShell, use `Copy-Item server/.env.example server/.env` instead of `cp`.
Before `db:seed`, set `LAB3_SEED_PASSWORD` in the local `server/.env` to a 12-128 character development-only password containing a letter, number, and non-alphanumeric character. If port `5432` is already in use, set `POSTGRES_PORT`, `DATABASE_URL`, and `TEST_DATABASE_URL` to the same available host port in `server/.env`.

The database stack is owned by `server/`: Compose is defined in `server/docker-compose.yml`, PostgreSQL initialization is under `server/docker/`, and Prisma files remain under `server/prisma/`.

The database migration and repeat-safe Lab 3 seed commands are:

```sh
bun run db:migrate
bun run db:seed
bun run db:test:setup
```

`db:migrate` and `db:migrate:deploy` run the Prisma migration and the Lab 3 ownership migration before returning. Existing Lab 2 Development Requesters are backfilled to Users, Ticket ownership is enforced, and generated initial credentials are written to the ignored local path `.local/lab3-credentials.json`. Set `LAB3_MIGRATION_HANDOFF_PATH` to choose another ignored local handoff path. `db:migrate:lab3` remains available for a separately managed handoff path.

`db:seed` backfills every seeded Ticket to its authenticated Requester User and verifies the database-level ownership constraint before completing.

`db:test:setup` applies the current migrations and seed to the isolated `toktickit_test` database. The test database is created by `server/docker/postgres/init/01-create-test-database.sql` on a new Compose volume.

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
API tests use the exported Express application and do not start a listener. The isolated test database workflow is completed by the server test setup and the authenticated Lab 3 fixtures.

The authenticated Lab 3 Requester flow can be run against the seeded development database with
the client and API started by Playwright:

```sh
bun run db:up
bun run db:migrate
bun run db:seed
bun run test:e2e
```

The E2E tests cover authentication, mandatory password change, authenticated
Requester navigation, ticket continuity, and responsive overflow checks. They
expect the local client/API and Chromium browser to be available.

## Scope

Lab 1 proves the client, API, Prisma, PostgreSQL, and test tooling as one
vertical slice. Lab 2 adds the temporary Development Requester context, ticket
creation/list/detail, and permitted attachment lifecycle. Lab 3 replaces that
temporary identity with authenticated Users and adds role-based workflows under
the approved contracts in `docs/lab-03/`; later-lab features remain out of scope.
