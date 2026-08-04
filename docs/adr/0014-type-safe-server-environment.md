# ADR 0014: Validate server configuration with T3 Env

- Status: Accepted
- Date: 2026-08-04

## Context

Lab 1 needs database URLs and a server port, while real credentials must remain outside Git. Plain `process.env` access would allow missing or malformed configuration to surface later as confusing runtime failures.

## Decision

Use T3 Env's framework-agnostic `@t3-oss/env-core` package with a server-only schema and a standard schema validator. Keep the environment module in the server workspace. The client has no environment variables for the Lab 1 API because it uses the Vite proxy.

Configure validation to treat empty strings as undefined, and expose typed values to the server configuration layer. `DATABASE_URL` and `TEST_DATABASE_URL` are required; `PORT` defaults to `3000` when omitted.

If a required variable is missing or invalid, validation fails before the Express listener starts.

## Consequences

- Server configuration is typed and validated at the boundary.
- Server-only variable names and schemas are not part of the client bundle.
- `.env.example` and the validation schema must stay synchronized.
- Configuration errors can be reported before the API starts handling requests.
- A broken local setup fails at startup instead of appearing as an unexplained request failure.
