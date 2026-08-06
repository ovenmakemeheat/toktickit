# Lab 1 test traceability

The required Lab 1 checks map directly to the public API and user-observable client behavior.

| ID | Tool | Test location | Status |
| --- | --- | --- | --- |
| API-01 | Supertest | `server/tests/lab-01/health.test.ts` | Passing |
| API-02 | Supertest | `server/tests/lab-01/categories.test.ts` | Passing |
| UI-01 | Vitest | `client/src/App.test.tsx` | Passing |
| UI-02 | Vitest | `client/src/App.test.tsx` | Passing |
| UI-03 | Vitest | `client/src/App.test.tsx` | Passing |

The foundation smoke test is in `server/tests/lab-01/foundation.test.ts` and verifies the exported Express app and typed environment configuration.

Run the complete gate with `bun run verify`. It covers Biome, Lefthook, Prisma validation, type checks, both workspace test suites, and both builds.
