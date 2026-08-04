# ADR 0017: Make the five required tests rubric-traceable

- Status: Accepted
- Date: 2026-08-04

## Decision

Implement and name the minimum Lab 1 contract tests as follows:

| ID | Layer | Behavior |
| --- | --- | --- |
| API-01 | Supertest | `GET /api/health` returns HTTP 200 and the required JSON. |
| API-02 | Supertest | `GET /api/categories` returns the four seeded categories in order. |
| UI-01 | Vitest | The TokTickIT heading renders. |
| UI-02 | Vitest | The check transitions from loading to the returned category list. |
| UI-03 | Vitest | An API failure renders the useful error state. |

Keep API tests in `server/tests/lab-01/` and client tests in a clearly named Lab 1 test area under `client/`. Create `docs/lab-01/tests.md` to map each ID to its file, command, and passing evidence.

## Consequences

- The grading rubric can be checked without guessing which test proves which requirement.
- Additional tests may improve implementation quality, but they do not replace or obscure these five named checks.
