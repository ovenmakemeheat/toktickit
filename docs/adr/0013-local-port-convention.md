# ADR 0013: Standardize the Lab 1 local ports

- Status: Accepted
- Date: 2026-08-04

## Decision

Use these development defaults:

| Process | Port |
| --- | ---: |
| Vite client | `5173` |
| Express API | `3000` |
| PostgreSQL | `5432` |

Vite proxies `/api` to `http://localhost:3000`.

## Consequences

- The README, Compose configuration, Vite configuration, and screenshots use one consistent local topology.
- Port overrides remain possible through documented environment configuration if a machine already uses one of the defaults.
