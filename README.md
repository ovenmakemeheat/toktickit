# TokTickIT

TokTickIT is the Lab 1 full-stack foundation for the IT service desk application.

## Stack

- Bun workspaces
- React, TypeScript, Vite, and Bootstrap
- Node-compatible Express and TypeScript
- PostgreSQL 16 through Docker Compose
- Prisma ORM
- Biome formatter and linter
- Vitest and Supertest

## Prerequisites

- Bun 1.3 or newer
- Docker with Compose

## Setup

```sh
bun install
cp server/.env.example server/.env
bun run db:up
bun run db:generate
```

On Windows PowerShell, use `Copy-Item server/.env.example server/.env` instead of `cp`.

The development database migration and seed commands are ready for the Category model delivered in Issue #15:

```sh
bun run db:migrate
bun run db:seed
bun run db:test:setup
```

`db:test:setup` applies the current migrations and seed to the isolated `toktickit_test` database. The test database is created by the PostgreSQL initialization script on a new Compose volume.

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
bun run format:check
bun run lint
bun run test
bun run typecheck
bun run build
```

API tests use the exported Express application and do not start a listener. The isolated test database workflow is completed with the API test setup in Issue #30.

## Scope

Lab 1 proves the client, API, Prisma, PostgreSQL, and test tooling as one vertical slice. Authentication, tickets, uploads, and later-lab screens are intentionally out of scope.
