# Server workspace instructions

The repository rules in `../AGENTS.md` apply here. These instructions add server-specific guidance.

## Scope

- Keep this workspace limited to the Lab 1 health and category vertical slice.
- Do not add authentication, ticket workflows, uploads, role management, or later-lab APIs.
- Keep the server compatible with Node.js even when scripts are run with Bun.

## Architecture

- Use Express, TypeScript, T3 Env, Prisma, and PostgreSQL.
- Keep importable API behavior in `src/app.ts`; keep process startup and `listen()` in `src/index.ts`.
- Keep Prisma schema, migrations, and seed code under `prisma/`.
- Keep Docker Compose, PostgreSQL initialization, environment templates, and database scripts under this workspace.
- Validate request and response behavior at the REST API boundary.

## Environment and database

- Copy `.env.example` to `.env` locally; never commit `.env` or credentials.
- T3 Env requires `DATABASE_URL` and `TEST_DATABASE_URL`.
- Keep `POSTGRES_PORT`, `DATABASE_URL`, and `TEST_DATABASE_URL` on the same host port. Use an alternate port when `5432` is occupied.
- Use the root `db:*` aliases for normal work: `bun run db:up`, `bun run db:generate`, `bun run db:validate`, `bun run db:migrate`, `bun run db:seed`, and `bun run db:test:setup`.
- Never use `docker compose down -v` during normal development because it removes the local database volume.
- Keep seed operations repeat-safe and verify schema changes with `bun run db:validate`.

## Commands

Run commands from the repository root when possible:

```sh
bun run dev:server
bun run test:server
bun run typecheck:server
bun run build:server
```

For focused work inside this workspace, use `bun run dev`, `bun run test`, `bun run typecheck`, and `bun run build`.

## Testing

- Use Vitest in the Node environment with the setup in `tests/setup.ts`.
- Use Supertest against the exported Express app; tests must not start a real listener.
- Keep Lab 1 API tests under `tests/lab-01/` and isolate test database setup from development data.
- Add or update the nearest API, database, or seed test with each server change.

## Handoff

- Run the narrowest server test while iterating, then run `bun run verify` from the repository root before handoff.
- Review `git diff --check` and confirm no credentials, dependency directories, build output, or local database state are staged.
