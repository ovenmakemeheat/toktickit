# Repository instructions

## Scope

This repository currently implements Lab 1 only. Keep authentication, ticket workflows, uploads, role management, and later-lab screens out of the Lab 1 codebase.

## Tooling

- Use Bun for package installation, scripts, and workspace commands.
- Keep `client/` and `server/` as the two application workspaces.
- Use the root scripts in `package.json` for development, database, testing, type checking, and builds.
- Use Biome through the root `format`, `format:check`, `lint`, and `check` scripts.
- Install the Lefthook staged-file hook with `bun run hooks:install` and validate it with `bun run hooks:validate`.
- Use `bun run verify` as the final local gate for Biome, hooks, Prisma, type checks, tests, and builds.
- Keep the server compatible with Node.js even though Bun runs the local scripts.

## Architecture

- The client uses React, TypeScript, Vite, and Bootstrap.
- The server uses Express, TypeScript, T3 Env, Prisma, and PostgreSQL.
- Keep `server/src/app.ts` importable without starting a listener; keep `listen()` in `server/src/index.ts`.
- Keep Prisma schema and migrations under `server/prisma/`.
- Use relative `/api` requests through the Vite proxy.

## Testing

- API tests use Supertest against the exported Express app and must not start a real listener.
- Client tests use Vitest and Testing Library at the user-observable boundary.
- Keep API tests under `server/tests/lab-01/` and client tests in the client workspace.
- Run `bun run test`, `bun run typecheck`, and `bun run build` before handing off implementation work.

## Git workflow

- Work on the Issue-specific feature branch.
- Issue #13 uses `feature/1-project-foundation` and targets `lab1-staging`.
- Do not commit directly to `main` or `lab1-staging`.
- Keep commits focused and do not include unrelated worktree changes.

## Secrets and generated files

- Never commit real `.env` files, credentials, dependency directories, build output, or local database state.
- Keep `.env.example` files free of real secrets.
- Do not add `CLAUDE.md`, `.claude/`, or Claude-specific configuration or artifacts to this repository.
