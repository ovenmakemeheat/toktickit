# Client workspace instructions

The repository rules in `../AGENTS.md` apply here. These instructions add client-specific guidance.

## Scope

- Preserve completed Lab 1–3 React behavior while implementing only the active Lab 4 issue authorized by the root instructions.
- For Lab 4, follow the approved UI contract in `../docs/lab-04/ui-spec.md` and keep excluded features out of the workspace.
- Keep existing Lab 3 tests in place; add Lab 4 client tests under `tests/lab-04/`.
- Keep API calls relative to `/api` so the Vite proxy is used in development.

## Architecture

- Use React, TypeScript, Vite, and Bootstrap.
- Keep user-observable behavior in components and client modules; do not hard-code API data that belongs to the server or database.
- Preserve accessible labels, headings, focus behavior, and explicit loading, success, empty, and error states.
- Keep the Vite development server on port `5173`; `/api` proxies to the server on port `3000`.

## Commands

Run commands from the repository root when possible:

```sh
bun run dev:client
bun run test:client
bun run typecheck:client
bun run build:client
```

For focused work inside this workspace, the equivalent package scripts are `bun run dev`, `bun run test`, `bun run typecheck`, and `bun run build`.

## Testing

- Use Vitest and Testing Library in the `jsdom` environment.
- Test at the user-observable boundary, including authentication, role navigation, Requester regression, and the required loading, success, and failure states.
- Prefer accessible queries and user interactions over implementation details.
- Keep Lab 3 client tests under `tests/lab-03/` and Lab 4 client tests under `tests/lab-04/`, shared client test setup in `tests/setup.ts`, and avoid starting a real API listener in unit tests.

## Handoff

- Run the narrowest client test while iterating, then run `bun run verify` from the repository root before handoff.
- Do not commit `.env` files, credentials, `node_modules`, or build output.
