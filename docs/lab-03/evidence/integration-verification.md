# Lab 3 release verification

Issue: [#77](https://github.com/ovenmakemeheat/toktickit/issues/77)

Feature branch: `feature/19-e2e-evidence-release`

Feature integration PR: [#83](https://github.com/ovenmakemeheat/toktickit/pull/83), merged into `lab3-staging` by `MadMax168` at `d345420782b2e14bbee7c7c70a586bc67d026434` on 2026-09-19.

Release PR: [#84](https://github.com/ovenmakemeheat/toktickit/pull/84), merged by `MadMax168` into `main` on 2026-09-23.

Final `main` revision: `eddafe67d6fd8d742b98d4673a731b25540cc57d`.

Closeout record: 2026-09-25.

## Release provenance and verified revision

The full pre-release verification was run against the integrated `lab3-staging`
revision `d345420782b2e14bbee7c7c70a586bc67d026434`. Release PR #84 merged that
revision to `main`. The staging and final-main commits have the same Git tree
(`87769bcadd3c1aec613529bed3e9cebd83e3a095`), so the released application,
tests, and committed evidence match the tree that passed the staging gates.

| Check on the integrated release tree | Result | Evidence |
| --- | --- | --- |
| `bun run verify` on `d345420` | Pass | Biome, Lefthook, Prisma validation, client/server type checks, 58 client tests, 143 server tests, and both builds passed. |
| `bun run test:e2e -- e2e/lab-03` on `d345420` | Pass | 12/12 Lab 3 Playwright tests passed, including the seeded release regression. |
| `bun run report:build:lab3` on `d345420` | Pass | XeLaTeX generated the six-page A4 submission PDF. |
| Release merge to `main` | Merged | PR #84, merged by `MadMax168`; main commit `eddafe67`. |

The original review-fix run at `32fc2b72c760fb08483349a29bed285ffe1cc939` is also
retained in the PR #83 history. It ran the seeded release regression against
the real API without intercepting business routes. The later `d345420` full
gate is the integrated release-tree result summarized above.

## Post-release local rerun

After PostgreSQL was made available, a fresh database-backed verification was
run on 2026-09-25 from `docs/lab3-complete-document`, based on final `main`
(`eddafe67`). Application and test files are unchanged from the released tree.
The repository test-database setup reset and seeded the isolated
`toktickit_test` database at `localhost:15434`; it did not reset the development
database.

| Command | Result | Evidence |
| --- | --- | --- |
| `bun run db:test:setup` | Pass | Isolated test database reset, migrations applied, and seed completed. |
| `bun run verify` | Pass | Biome (117 files), Lefthook, Prisma validation, both type checks, 15 client files/58 tests, 22 server files/143 tests, and both builds passed. |
| `bun run test:e2e -- e2e/lab-03` | Pass | 12/12 Lab 3 Playwright tests passed, including the unmocked seeded release regression. |
| `bun run report:build:lab3` | Pass | The updated A4 report PDF built successfully. |

Client and server Vitest terminal captures are retained at
`docs/lab-03/report/evidence/client-vitest-run-2026-09-25.png` and
`docs/lab-03/report/evidence/server-vitest-run-2026-09-25.png`. The seeded
Playwright run used the local development database and `LAB3_SEED_PASSWORD`
from ignored `server/.env`; no credential values are recorded here. The earlier
attempt that could not reach PostgreSQL is superseded by this successful rerun.

## Lab 3 E2E coverage

- `e2e/lab-03/authentication-and-requester.spec.ts`: valid login, invalid
  credentials, inactive account, mandatory initial-password change, logout,
  protected navigation, and authenticated Requester regression.
- `e2e/lab-03/staff-ticket-flow.spec.ts`: Queue filters, detail, claim,
  reassign, IT Priority, status, Public Comment, Internal Note, and Attachment
  metadata.
- `e2e/lab-03/user-administration.spec.ts`: Administrator User list/search/
  filter/create/edit/initial-password flow, read-only Ticket Review, IT Priority,
  and non-Administrator route protection.
- `e2e/lab-03/responsive-and-accessibility.spec.ts`: browser-level Queue
  representation, named controls/focus/no-overflow assertions, and Requester
  captures at desktop/tablet/mobile sizes.
- `e2e/lab-03/release-regression.spec.ts`: unmocked API health check, seeded
  authentication, role route smoke matrix, seeded Ticket/User data, and
  direct role-forbidden API/destination regression.

The release regression uses `LAB3_SEED_PASSWORD` from ignored `server/.env`
and a local seeded database. The other focused Playwright specs intentionally
use deterministic browser fixtures for isolated UI assertions. Neither fixture-
based UI evidence nor browser navigation replaces the real
Supertest/PostgreSQL evidence for authorization, migration, session
invalidation, or account-safety invariants.

## Evidence inventory

- Authentication captures: `artifacts/lab-03/screenshots/authentication/`
- Requester captures: `artifacts/lab-03/screenshots/requester/`
- Staff Queue captures: `artifacts/lab-03/screenshots/staff-queue/`
- Staff Ticket Detail captures: `artifacts/lab-03/screenshots/staff-ticket-detail/`
- Administrator captures: `artifacts/lab-03/screenshots/user-management/`
- GitHub captures (Lab 3 Project #3 Kanban board, final-main repository root, and commit history) and client/server Vitest run screenshots: `docs/lab-03/report/evidence/`; capture details are in that directory's `README.md`.
- Visual inspection record: `docs/lab-03/evidence/visual-inspection-checklist.md`
- Contract: `docs/lab-03/specification.md`, `api-spec.md`, `ui-spec.md`
- Test DD and traceability: `docs/lab-03/tests.md`
- Human review record: `docs/lab-03/reviewer.md`
- AI-use reflection: `docs/lab-03/ai-use.md`
- Submission source/PDF: `docs/lab-03/report/toktickit-lab3-report.tex` and
  `output/pdf/toktickit-lab3-report.pdf`

## Release boundary

Lab 3 is merged to `main`. PR #83 integrated the evidence package into
`lab3-staging`; PR #84 was the separate release integration and was merged by
peer reviewer `MadMax168`. GitHub returned an empty formal `reviewDecision` for
PR #84, so this record does not claim a formal `APPROVED` review. The final main
tree is identical to the tree that passed the full pre-release verification.
The fresh post-release database-backed rerun passed after PostgreSQL became
available; the earlier blocked attempt is superseded by the successful results
recorded above.
