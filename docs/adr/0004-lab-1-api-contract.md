# ADR 0004: Define a small, stable Lab 1 API contract

- Status: Accepted
- Date: 2026-08-04

## Context

The Lab 1 requirements specify exact success payloads for the health and category endpoints, but the failure shape is not specified. The client and Supertest checks need a contract that is stable without exposing infrastructure details.

## Decision

Provide these REST endpoints:

### `GET /api/health`

Return HTTP 200 with:

```json
{
  "status": "ok",
  "service": "TokTickIT API"
}
```

The endpoint's dependency behavior will be decided separately.

The endpoint is a liveness check: it verifies that the Express API process can answer and does not query PostgreSQL.

### `GET /api/categories`

Return HTTP 200 with the seeded categories in predictable order, including each category's `id` and `name`:

```json
[
  { "id": 1, "name": "Account and Access" },
  { "id": 2, "name": "Hardware" },
  { "id": 3, "name": "Software" },
  { "id": 4, "name": "Network" }
]
```

When a dependency prevents category retrieval, return HTTP 503 with a user-safe, consistent envelope:

```json
{
  "error": {
    "code": "CATEGORY_STORE_UNAVAILABLE",
    "message": "Unable to load categories"
  }
}
```

Unexpected failures use the same envelope with an appropriate server error code. Responses must not expose stack traces or database credentials.

## Consequences

- API-01 and API-02 can assert exact success behavior.
- The UI can distinguish a loading state from a failed category request.
- The server owns ordering and persistence; the client does not hard-code category values.
- API liveness is intentionally distinct from category-store readiness.
