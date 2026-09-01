# TokTickIT

TokTickIT is the Lab 1 full-stack foundation and Lab 2 requester-facing MVP for
the IT service desk application.

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
If port `5432` is already in use, set `POSTGRES_PORT`, `DATABASE_URL`, and `TEST_DATABASE_URL` to the same available host port in `server/.env`.

The database stack is owned by `server/`: Compose is defined in `server/docker-compose.yml`, PostgreSQL initialization is under `server/docker/`, and Prisma files remain under `server/prisma/`.

The development database migration and seed commands are ready for the Category model delivered in Issue #15:

```sh
bun run db:migrate
bun run db:seed
bun run db:test:setup
```

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
API tests use the exported Express application and do not start a listener. The isolated test database workflow is completed with the API test setup in Issue #30.

The Lab 2 requester flow can be run against the seeded development database with
the client and API started by Playwright:

```sh
bun run db:up
bun run db:migrate
bun run db:seed
bun run test:e2e
```

The E2E test creates a uniquely named ticket, captures responsive screenshots
under `artifacts/lab-02/screenshots/`, and expects the local database and
Chromium browser to be available. It does not reset or remove the development
database.

## Scope

Lab 1 proves the client, API, Prisma, PostgreSQL, and test tooling as one
vertical slice. Lab 2 adds the temporary Development Requester context, ticket
creation/list/detail, and permitted attachment lifecycle. Authentication,
staff workflows, administration, comments, and other later-lab screens remain
out of scope.
