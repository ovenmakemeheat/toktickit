# ADR 0011: Use relative API paths through the Vite development proxy

- Status: Accepted
- Date: 2026-08-04

## Context

The Vite client and Express server run as separate local processes. Hard-coding a machine-specific `localhost` URL in components would make the client harder to test and move, while Lab 1 only needs a local browser demo.

## Decision

Use a small client API module built on native `fetch` and call `/api/health` and `/api/categories` with relative paths. Configure the Vite development server to proxy `/api` to the Express server.

The API module owns HTTP status handling, JSON parsing, and conversion of the server error envelope into a client-safe error. React components consume typed results and do not construct URLs themselves.

## Consequences

- The client has no hard-coded developer machine URL.
- Browser development avoids a separate CORS dependency because requests use the Vite proxy.
- The README must document the proxy and the two process ports.
- A later deployment topology can add an environment-specific base URL without changing components.
