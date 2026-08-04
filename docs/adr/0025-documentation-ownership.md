# ADR 0025: Separate operational documentation from Lab 1 evidence

- Status: Accepted
- Date: 2026-08-04

## Decision

Use the root `README.md` as the single operational guide for:

- prerequisites and installation;
- environment setup;
- starting PostgreSQL;
- migrations and seeding;
- starting the client and server;
- running tests and verification;
- troubleshooting and the local port topology.

Use `docs/lab-01/` for concise submission evidence and reflection documents, including `tests.md`, `reviewer.md`, and `ai_use.md`. Do not duplicate the full setup guide in those evidence files.

## Consequences

- Setup instructions have one source of truth.
- Evidence documents stay short and gradeable.
- The final PDF can reference or render the relevant evidence without repeating the whole README.
