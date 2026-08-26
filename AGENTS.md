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

## Development flow

### Setup

Run these commands from the repository root on a clean checkout:

```sh
bun install
cp server/.env.example server/.env
bun run hooks:install
bun run db:up
bun run db:generate
bun run db:validate
bun run db:migrate
bun run db:seed
bun run db:test:setup
```

In PowerShell, use `Copy-Item server/.env.example server/.env`. Keep `server/.env` local. Start the application with `bun dev`; stop only the database with `bun run db:down`.

### GitHub project board

- Use the [TokTickIT Lab 1 project board](https://github.com/users/ovenmakemeheat/projects/1/views/2) as the canonical delivery view.
- Keep exactly the four main Lab 1 issues (#13, #14, #15, and #16) on the board. Native sub-issues stay attached to their parent issues and are not added as separate board items.
- Use the workflow statuses `Backlog`, `Specified`, `Started`, `PR Review`, `Fixing`, and `Done`.
- Keep the board synchronized with issue and pull request state. Mark an issue `Done` only after its acceptance criteria, tests, peer review, and merge into `lab1-staging` are complete.

### GitHub state authority

- The agent may inspect issue checklists, acceptance criteria, notes, and evidence, and may check off completed checklist items.
- The agent may close a native sub-issue only after its checklist and acceptance criteria are complete.
- The agent must never close or reopen a pull request, merge or unmerge a pull request, or otherwise change pull request state.
- The agent must never close or reopen a main Lab 1 issue (#13, #14, #15, or #16).
- A human must perform all pull request state changes and all main-issue closures or reopenings.

### Pull request and review rules from Lab 2 onward

- These rules apply from Lab 2 onward. Lab 1 is exempt.
- The Pull Request author must not merge their own Pull Request. After approval, the reviewer who performed the review must click `Merge pull request`.
- Reply to every review comment before merging. State that the comment was fixed, or explain why the requested change is not being made.
- Link every Pull Request to its corresponding Issue. Linking a branch is only a convenience and does not replace the Pull Request-to-Issue link used for backlog traceability.
- Treat review as a conversation: do not merge silently after receiving approval while leaving review comments unanswered.

### Database workflow

- Treat `server/docker-compose.yml`, `server/docker/`, `server/prisma/`, `server/.env.example`, and the server database scripts as one owned stack.
- Root `db:*` commands are aliases for the corresponding server commands; use them for the normal workflow.
- Keep `POSTGRES_PORT`, `DATABASE_URL`, and `TEST_DATABASE_URL` on the same host port. Use an alternate port when `5432` is occupied.
- Do not use `docker compose down -v` during normal development; it removes the local database volume.

### Work cycle

- Select one parent issue or native sub-issue and read its scope, checklist, acceptance criteria, and notes before editing.
- Keep each change bounded to that issue. Add or update the nearest client, API, database, or documentation test with the change.
- Use `server/src/app.ts` for importable API behavior and keep process startup in `server/src/index.ts`.
- Run the narrowest relevant command while iterating, then run `bun run verify` before handoff.
- Record any environment-specific port, database, or manual verification detail in the issue notes or evidence document.

### Verification and handoff

The final gate is:

```sh
bun run verify
```

It checks Biome, Lefthook configuration, Prisma schema validity, type checking, both workspace test suites, and both workspace builds. A handoff should also state the changed issue, acceptance evidence, commands run, and any known local prerequisite.

### Git flow

- Work on the issue-specific feature branch and target `lab1-staging` through a pull request.
- Keep commits small and focused. Use messages such as `feat(#29): add ...` or `fix(#30): ...`, and include `Refs #29` or the relevant sub-issue reference in the body.
- Let Lefthook run on commit; fix staged-file failures rather than bypassing the hook.
- Review `git status` and `git diff --check` before committing. Never include unrelated worktree changes.

## Architecture

- The client uses React, TypeScript, Vite, and Bootstrap.
- The server uses Express, TypeScript, T3 Env, Prisma, and PostgreSQL.
- Keep `server/src/app.ts` importable without starting a listener; keep `listen()` in `server/src/index.ts`.
- Keep Prisma schema and migrations under `server/prisma/`.
- Keep Docker Compose, PostgreSQL initialization, environment templates, and database scripts under `server/`.
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
