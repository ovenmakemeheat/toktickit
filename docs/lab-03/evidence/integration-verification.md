# Lab 3 integration verification

Issue: [#77](https://github.com/ovenmakemeheat/toktickit/issues/77)

Feature branch: `feature/19-e2e-evidence-release`

Integration target: `lab3-staging`

Baseline inherited before Issue #77 changes: `4cb1049` (merged PR #82)

Verification record: 2026-09-18

The clean verification run was completed on the Issue #77 working tree with
base `HEAD 4cb1049` plus the uncommitted Issue #77 changes shown by `git
status`. The implementation commit and PR identity will be added when the
branch is committed and handed to the reviewer.

## Executed checks

The following checks were run with Bun from the repository root. Results below
refer to the Issue #77 working tree and are preserved here with their exact
scope; the evidence commit is recorded in the final handoff.

| Command | Result | Evidence |
| --- | --- | --- |
| `bun run check` | Pass | Biome checked 117 files with no errors after formatting the new E2E specs. |
| `bun run typecheck` | Pass | Client and server TypeScript projects completed without diagnostics. |
| `bun run test` | Pass | 15 client test files / 58 tests and 22 server test files / 143 tests passed. |
| `bun run test:e2e -- e2e/lab-03/staff-ticket-flow.spec.ts` | Pass | The new IT Staff queue/detail workflow passed 1/1 test after the accessible-label selector correction. |
| `bun run test:e2e -- e2e/lab-03` | Pass | 12/12 Lab 3 tests passed across authentication/Requester, Staff, Administrator, responsive/accessibility, and release regression flows. |
| `bun run build` | Pass | Client Vite build and server TypeScript build completed successfully. |
| `bun run verify` | Pass | Biome, Lefthook, Prisma validation, type checks, 58 client tests, 143 server tests, and both builds completed successfully. |
| `bun run report:build:lab3` | Pass | XeLaTeX produced `output/pdf/toktickit-lab3-report.pdf` with six A4 pages. |

## E2E coverage added for Issue #77

- `e2e/lab-03/authentication-and-requester.spec.ts`: valid login, invalid
  credentials, inactive account, mandatory initial-password change, logout,
  protected navigation, and authenticated Requester regression.
- `e2e/lab-03/staff-ticket-flow.spec.ts`: Queue filters, detail, claim,
  reassign, IT Priority, status, Public Comment, Internal Note, and attachment
  metadata.
- `e2e/lab-03/user-administration.spec.ts`: Administrator User list/search/
  filter/create/edit/initial-password flow, read-only Ticket Review, IT Priority,
  and non-Administrator route protection.
- `e2e/lab-03/responsive-and-accessibility.spec.ts`: browser-level queue
  representation, named controls/focus/no-overflow assertions, and Requester
  captures at desktop/tablet/mobile sizes.
- `e2e/lab-03/release-regression.spec.ts`: API health check, role route smoke
  matrix, and direct role-forbidden destination regression.

All 12 Lab 3 Playwright tests passed in the clean rerun. Playwright route
fixtures intentionally verify browser behavior and control
boundaries. They do not replace the real PostgreSQL/Supertest evidence for
authorization, migration, session invalidation, or account-safety invariants.

## Evidence inventory

- Authentication captures: `artifacts/lab-03/screenshots/authentication/`
- Requester captures: `artifacts/lab-03/screenshots/requester/`
- Staff Queue captures: `artifacts/lab-03/screenshots/staff-queue/`
- Staff Ticket Detail captures: `artifacts/lab-03/screenshots/staff-ticket-detail/`
- Administrator captures: `artifacts/lab-03/screenshots/user-management/`
- Visual inspection record: `docs/lab-03/evidence/visual-inspection-checklist.md`
- Contract: `docs/lab-03/specification.md`, `api-spec.md`, `ui-spec.md`
- Test DD and traceability: `docs/lab-03/tests.md`
- Human review record: `docs/lab-03/reviewer.md`
- AI-use reflection: `docs/lab-03/ai-use.md`
- Submission source/PDF: `docs/lab-03/report/toktickit-lab3-report.tex` and
  `output/pdf/toktickit-lab3-report.pdf`

## Release boundary

This evidence is prepared on the feature branch before the Issue #77 PR is
merged. It must not be reported as final-main evidence. After human review and
merge into `lab3-staging`, rerun the documented checks on the integrated branch;
then prepare a separate `lab3-staging` to `main` release PR for human review.
Do not close Issue #77 or change the release PR state automatically.
