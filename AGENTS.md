# Repository instructions

## Scope

Lab 1 and Lab 2 are the released foundation for this repository. Lab 3 Issues #72-#77 are historical delivery scope; Lab 3 release PR #84 is merged to `main`. Lab 4 is authorized and is being delivered through parent Issue #86 and sub-issues #87-#90. Keep each change bounded to its active Lab 4 issue and the approved contract in `docs/lab-04/`; do not implement work outside that contract. Issue #87 covers contract/review; implementation in #88 remains gated on contract review.

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

In PowerShell, use `Copy-Item server/.env.example server/.env`. Before `bun run db:seed`, set the local-only `LAB3_SEED_PASSWORD` in `server/.env` to a valid development password. Keep `server/.env` local. Start the application with `bun dev`; stop only the database with `bun run db:down`.

### GitHub project board

- Use the [TokTickIT Lab 4 project board](https://github.com/users/ovenmakemeheat/projects/4/views/1) as the canonical delivery view for Lab 4, and retain the [Lab 3 board](https://github.com/users/ovenmakemeheat/projects/3/views/1) for historical Lab 3 tracking.
- Keep Lab 4 parent #86 on board #4. Native sub-issues #87-#90 stay attached to the parent and are not added as separate board items.
- Keep Lab 3 issues #72-#77 on the Lab 3 board as historical delivery records; they are not the only active scope.
- Use the workflow statuses `Backlog`, `Specified`, `Started`, `PR Review`, `Fixing`, and `Done`.
- Keep each board synchronized with issue and pull request state. Mark a Lab 3 issue `Done` only after its acceptance criteria, tests, peer review, and merge into `lab3-staging` are complete. For Lab 4, use the same completion criteria with merge into `lab4-staging`.

### GitHub state authority

- The agent may inspect issue checklists, acceptance criteria, notes, and evidence, and may check off completed checklist items.
- The agent may close a native sub-issue only after its checklist and acceptance criteria are complete.
- The agent must never close or reopen a pull request, merge or unmerge a pull request, or otherwise change pull request state.
- The agent must never close or reopen a main Lab 3 issue (#72-#77) or the Lab 4 parent issue #86.
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
- Keep each change bounded to that issue. Add or update the nearest client, API, database, or documentation test with the change. Lab 3 tests remain under `server/tests/lab-03/`, `client/tests/lab-03/`, and `e2e/lab-03/`; Lab 4 tests belong in the corresponding `lab-04/` directories.
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

- Work on the issue-specific feature branch and target the matching integration branch through a pull request: `lab3-staging` for Lab 3 and `lab4-staging` for Lab 4.
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
- Keep existing Lab 1/Lab 2 unit, API, and client tests in their current locations; add Lab 3 API tests under `server/tests/lab-03/`, client tests under `client/tests/lab-03/`, and E2E tests under `e2e/lab-03/`. Add Lab 4 tests under corresponding `server/tests/lab-04/`, `client/tests/lab-04/`, and `e2e/lab-04/` paths as applicable.
- Run `bun run test`, `bun run typecheck`, and `bun run build` before handing off implementation work.

## Git workflow

- Work on the Issue-specific feature branch.
- Lab 3 uses `feature/<issue-number>-<feature-name>` branches for issues #72-#77 and targets `lab3-staging`.
- Lab 4 uses `feature/<issue-number>-<feature-name>` branches for issues #86-#90, including the authorized `feature/20` through `feature/23` sequence, and targets `lab4-staging`.
- Do not commit directly to `main`, `lab3-staging`, or `lab4-staging`.
- Keep commits focused and do not include unrelated worktree changes.

## Secrets and generated files

- Never commit real `.env` files, credentials, dependency directories, build output, or local database state.
- Keep `.env.example` files free of real secrets.
- Do not add `CLAUDE.md`, `.claude/`, or Claude-specific configuration or artifacts to this repository.
