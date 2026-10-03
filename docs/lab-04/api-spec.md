# Lab 4 REST API specification

- Status: contract draft; human review pending.
- Parent: [Issue #86](https://github.com/ovenmakemeheat/toktickit/issues/86) · Contract: [Issue #87](https://github.com/ovenmakemeheat/toktickit/issues/87)
- Related: [engineering specification](specification.md), [UI specification](ui-spec.md), [test plan](tests.md).

Base URL: `/api`. This contract extends the existing Lab 3 Express API and preserves all approved Labs 1–3 routes and response behavior unless explicitly extended below. Keep the app importable for Supertest; do not start a listener from API tests.

## 1. API conventions

### Authentication, roles, and CSRF

- Protected calls use the existing `toktickit_session` cookie and current-user/session middleware. A missing, expired, revoked, or inactive-user session returns the existing safe `401` behavior.
- State-changing `POST`/`PATCH` calls require the current `X-CSRF-Token` matching the session's readable CSRF cookie. A missing/invalid token returns `403 CSRF_TOKEN_INVALID` before any mutation.
- Requester calls derive `requesterUserId` from the authenticated session. Never accept a Requester ID or performer identity from the body as authority.
- Actions Taken read roles: `REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`. Requesters are scoped to owned Tickets; IT Staff and Administrators use the permitted operational Ticket access.
- Actions Taken write and Ticket status roles: `IT_STAFF`, `ADMINISTRATOR`. Dashboard roles are specified per endpoint.
- Administrator access expands to the approved Lab 4 operational Ticket behavior; existing User Management and Ticket Review/IT-Priority capabilities remain. Do not add an Administrator-specific dashboard endpoint.

### JSON, IDs, time, and safe failures

- JSON requests and responses use UTF-8 and `application/json`; all IDs are positive JSON integers.
- All timestamps are ISO 8601 UTC strings. Incoming timestamps require a valid ISO 8601 value with an explicit timezone and are normalized to UTC.
- The server trims the specified text fields and enforces the 2,000-character limits in `specification.md`.
- Errors use the repository envelope:

```json
{
  "error": {
    "code": "STABLE_ERROR_CODE",
    "message": "Safe human-readable message",
    "fields": [
      { "field": "actionDescription", "code": "INVALID_VALUE", "message": "Enter an Action Description." }
    ]
  }
}
```

`fields` is optional. Never return password/session material, hashes, storage keys, private Internal Notes through unauthorized routes, SQL details, or stack traces. Cross-Requester reads use non-disclosing `404` where existence would reveal another Requester's resource. A failed/conflicting write does not partially mutate either Action Taken or Ticket.

## 2. Data-transfer shapes

### Action Taken

```json
{
  "id": 47,
  "ticketId": 315,
  "actionAt": "2026-09-26T13:45:00.000Z",
  "actionDescription": "Reset the account lock and verified sign-in.",
  "result": "The Requester can sign in successfully.",
  "performedBy": { "id": 12, "name": "IT Staff A", "role": "IT_STAFF" },
  "followUpRequired": false,
  "followUpNote": null,
  "attachmentNotes": "See the existing screenshot named login-error.png.",
  "createdAt": "2026-09-26T13:46:05.000Z",
  "updatedAt": "2026-09-26T13:46:05.000Z",
  "updatedBy": null,
  "version": 1
}
```

- `performedBy` and `createdAt` are immutable; `updatedBy` is null until the first edit and then identifies the last authenticated editor.
- `version` is a positive integer used for optimistic concurrency. `followUpNote` is null whenever `followUpRequired` is false.
- The DTO does not expose `idempotencyKey`, internal migration fields, or `lastReopenedAt`.

### Bounded Ticket summary

Dashboard rows use a summary DTO, not complete Ticket details:

```json
{
  "id": 315,
  "ticketNumber": "TT-20260926-ABC123",
  "summary": "Unable to sign in to course email",
  "currentStatus": "IN_PROGRESS",
  "requestedPriority": "HIGH",
  "itPriority": "HIGH",
  "owner": { "id": 12, "name": "IT Staff A", "role": "IT_STAFF" },
  "updatedAt": "2026-09-26T13:46:05.000Z",
  "resolvedAt": null
}
```

Requester summaries are scoped to the session Requester and omit staff-only fields not needed by the Requester screen. Dashboard DTOs never contain Internal Notes, all Attachments, or a full Ticket collection.

## 3. Endpoint index

| Method | Path | Roles/scope | Success |
| --- | --- | --- | --- |
| GET | `/api/tickets/:ticketId/actions-taken` | Requester owns Ticket; IT Staff/Admin permitted Ticket access | `200 { "items": [...] }` |
| POST | `/api/tickets/:ticketId/actions-taken` | IT Staff/Admin permitted Ticket access; CSRF | `201` created DTO; idempotent replay `200` |
| PATCH | `/api/tickets/:ticketId/actions-taken/:actionId` | IT Staff/Admin permitted Ticket access; CSRF | `200` updated DTO |
| GET | `/api/requester/dashboard` | Requester | `200` Requester dashboard DTO |
| GET | `/api/staff/dashboard` | IT Staff/Admin | `200` operational dashboard DTO |
| GET | `/api/staff/tickets` | IT Staff/Admin | `200` Queue page |
| GET | `/api/staff/tickets/:ticketId` | IT Staff/Admin | `200` operational Ticket detail |
| POST | `/api/staff/tickets/:ticketId/claim` | IT Staff/Admin; CSRF | `200` updated Ticket detail |
| PATCH | `/api/staff/tickets/:ticketId/owner` | IT Staff/Admin; CSRF | `200` updated Ticket detail |
| PATCH | `/api/staff/tickets/:ticketId/priority` | IT Staff/Admin; CSRF | `200` updated Ticket detail |
| PATCH | `/api/staff/tickets/:ticketId/status` | IT Staff/Admin; CSRF | `200` updated Ticket detail |
| Existing Lab 1–3 routes | Existing paths | Existing scope; only the named Staff operational routes are extended to Administrator | Existing contract |

The three Actions Taken paths are Ticket-scoped. Do not add global Action Taken list, delete, or file-upload routes. The existing `/api/staff/tickets*` Queue/detail/claim/owner/priority/status route family is authorized for IT Staff and Administrator in Lab 4. Public Comment/Internal Note authoring permissions remain as in Lab 3; Administrator's new operational access does not silently grant communication-write permissions. The existing `/api/admin/tickets/:ticketId` Ticket Review and `/api/admin/tickets/:ticketId/priority` exception remain available.

## 4. Actions Taken endpoints

### GET `/api/tickets/:ticketId/actions-taken`

Returns chronological Actions Taken for one Ticket:

```json
{ "items": [/* Action Taken DTOs ordered by actionAt asc, then id asc */] }
```

- Requester: scope the Ticket query by both `id = ticketId` and `requesterUserId = session.userId`. A missing or non-owned Ticket returns `404 TICKET_NOT_FOUND` without disclosing ownership.
- IT Staff/Administrator: use the permitted Ticket Detail access rules. A missing Ticket returns `404 TICKET_NOT_FOUND`.
- An existing Ticket with no actions returns `200 { "items": [] }`.
- Invalid Ticket ID returns `400 TICKET_ID_INVALID`; unexpected failure returns a generic `500 ACTION_TAKEN_LIST_FAILED`.

### POST `/api/tickets/:ticketId/actions-taken`

Requires an `Idempotency-Key` header containing a UUID, a valid session, an allowed write role, and CSRF. Request body:

```json
{
  "actionAt": "2026-09-26T13:45:00.000Z",
  "actionDescription": "Reset the account lock and verified sign-in.",
  "result": "The Requester can sign in successfully.",
  "followUpRequired": false,
  "followUpNote": null,
  "attachmentNotes": "See the existing screenshot named login-error.png."
}
```

The body must not supply `performedBy`, `performedByUserId`, `ticketId`, `createdAt`, `updatedAt`, `updatedBy`, or `version`. Such caller-controlled/immutable fields are rejected as `400 ACTION_TAKEN_INPUT_INVALID`; the server derives actor and parent from session/path. Unknown fields are rejected.

Validation and behavior:

- `actionAt` is required and valid ISO 8601 with timezone; it is normalized to UTC.
- `actionDescription` and `result` are required, trimmed, non-empty, plain text, at most 2,000 characters each.
- `followUpRequired` is required Boolean. If true, trimmed `followUpNote` is required and at most 2,000 characters. If false, any submitted note is discarded and stored/returned as null.
- `attachmentNotes` may be omitted/null or trimmed plain text up to 2,000 characters. It creates no Attachment and grants no file permission.
- The server derives the performer from the session, inserts `version: 1`, captures immutable `createdAt`, and atomically advances the parent Ticket's `updatedAt`.
- New key and valid body returns `201` with the Action Taken DTO. Repeating the same key for the same Ticket, creator, and equivalent normalized payload returns `200` with the original DTO and creates no duplicate. Same key with a different Ticket, actor, or normalized payload returns `409 IDEMPOTENCY_KEY_REUSED`.
- A caller who is not authorized to write receives `403 ACTION_TAKEN_FORBIDDEN`; Requester writes are always denied even for owned Tickets. Inaccessible/missing Ticket returns safe `404` as applicable.

Errors: `400 ACTION_TAKEN_INPUT_INVALID`, `400 ACTION_TAKEN_IDEMPOTENCY_KEY_INVALID`, `401 SESSION_REQUIRED`, `403 ACTION_TAKEN_FORBIDDEN` or `CSRF_TOKEN_INVALID`, `404 TICKET_NOT_FOUND`, `409 IDEMPOTENCY_KEY_REUSED`, and generic `500 ACTION_TAKEN_CREATE_FAILED`.

### PATCH `/api/tickets/:ticketId/actions-taken/:actionId`

Requires IT Staff/Admin role, CSRF, positive path IDs, and the current Action Taken version. Request body:

```json
{
  "expectedVersion": 1,
  "actionAt": "2026-09-26T13:45:00.000Z",
  "actionDescription": "Reset the account lock and verified sign-in.",
  "result": "The Requester can sign in successfully.",
  "followUpRequired": true,
  "followUpNote": "Confirm access after the next class.",
  "attachmentNotes": null
}
```

- At least one editable field is required. Allowed fields are `actionAt`, `actionDescription`, `result`, `followUpRequired`, `followUpNote`, and `attachmentNotes`.
- `expectedVersion` is required and is not itself editable. `performedBy`, performer ID, Ticket ID, `createdAt`, idempotency key, and version are rejected if supplied.
- Apply all supplied fields and the parent Ticket activity timestamp atomically. Preserve omitted fields. Clearing `followUpRequired` also clears `followUpNote`; setting it true requires a non-empty note after the resulting update.
- Success returns `200` with the updated DTO and incremented version. If `expectedVersion` does not equal the stored version, return `409 ACTION_TAKEN_CONFLICT` with no field changed. Unknown/missing Action Taken on the Ticket returns `404 ACTION_TAKEN_NOT_FOUND` without revealing another Ticket's data.

Errors: `400 ACTION_TAKEN_INPUT_INVALID`, `400 ACTION_TAKEN_ID_INVALID`, `401 SESSION_REQUIRED`, `403 ACTION_TAKEN_FORBIDDEN` or `CSRF_TOKEN_INVALID`, `404 TICKET_NOT_FOUND`/`ACTION_TAKEN_NOT_FOUND`, `409 ACTION_TAKEN_CONFLICT`, and generic `500 ACTION_TAKEN_UPDATE_FAILED`.

## 5. Ticket status and resolution API

### PATCH `/api/staff/tickets/:ticketId/status`

This extends the existing status endpoint to Administrator as well as IT Staff. Request body:

```json
{
  "expectedStatus": "IN_PROGRESS",
  "status": "RESOLVED",
  "confirmation": true
}
```

- `expectedStatus` is the status visible to the client when it initiated the transition. It must equal the current stored status; otherwise return `409 TICKET_STATUS_CONFLICT`.
- `status` must be a valid target in the transition matrix in `specification.md`. The API does not infer a transition from a client-side control.
- `confirmation: true` is required for transitions to `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`; missing/false confirmation returns `400 STATUS_CONFIRMATION_REQUIRED`.
- For a new transition to `RESOLVED`, verify the Action Taken gate in the same transaction as the conditional status update. Before any reopen, require at least one Action Taken. After a reopen, require an Action Taken whose immutable `createdAt` is later than `lastReopenedAt`. Failure is `409 ACTION_TAKEN_REQUIRED`; it leaves status and timestamps unchanged.
- On `RESOLVED`, set `resolvedAt` using the server clock. On `CLOSED`, preserve it. On `REOPENED`, clear `resolvedAt` and set `lastReopenedAt` using the server clock. Preserve the reopen marker through subsequent active transitions.
- No other endpoint or Requester indication can set formal status or timestamps.
- Success returns `200` with updated Ticket detail including `resolvedAt` but not the internal `lastReopenedAt` marker.

Errors: `400 TICKET_STATUS_TRANSITION_INVALID`, `400 STATUS_CONFIRMATION_REQUIRED`, `400 TICKET_STATUS_INPUT_INVALID`, `401 SESSION_REQUIRED`, `403 STAFF_TICKET_FORBIDDEN`, `403 CSRF_TOKEN_INVALID`, `404 TICKET_NOT_FOUND`, `409 TICKET_STATUS_CONFLICT`, `409 ACTION_TAKEN_REQUIRED`, and generic `500 STAFF_TICKET_FAILED`.

Other status-transition rules are unchanged: only listed edges are allowed; same-status writes are rejected; failures are atomic. The Requester's existing `POST /api/tickets/:ticketId/resolution-indication` remains advisory and cannot modify these fields.

## 6. Dashboard API

### Shared calculation rules

- The API calculates all values from authoritative Ticket data in PostgreSQL and scopes Requester queries by session `requesterUserId`.
- Generate one `asOf` UTC timestamp per response. The recent window is inclusive: `updatedAt`/`resolvedAt >= asOf - 30 days` and `<= asOf`.
- Active statuses are `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, and `REOPENED`. Other statuses are not active.
- Recent arrays are capped at five and have deterministic ID tie-breakers. Counts are not truncated. Empty arrays are `[]`; zero counts are `0`.
- Response summaries omit descriptions, Attachments, Public Comments, Internal Notes, complete Ticket collections, and private data. The UI builds drill-down URLs from the documented destination keys/filters, not from untrusted HTML.

### GET `/api/requester/dashboard`

Requester only; identity is derived from session. Success:

```json
{
  "asOf": "2026-09-26T14:00:00.000Z",
  "metrics": {
    "openCount": 3,
    "waitingForRequesterCount": 1,
    "recentlyResolvedCount": 2
  },
  "recentlyUpdated": [/* up to 5 owned Ticket summaries */],
  "recentlyResolved": [/* up to 5 owned RESOLVED/CLOSED Ticket summaries */]
}
```

- `openCount`: all owned active Tickets.
- `waitingForRequesterCount`: owned active subset in `WAITING_FOR_REQUESTER`.
- `recentlyUpdated`: all owned Tickets updated in the inclusive window, ordered `updatedAt desc, id desc`.
- `recentlyResolvedCount` and `recentlyResolved`: owned Tickets currently `RESOLVED` or `CLOSED`, with `resolvedAt` in the inclusive window; list ordered `resolvedAt desc, id desc`.
- Every row opens the corresponding Requester Ticket Detail; any open/waiting metric links to My Tickets with the matching status filter. Do not return another Requester's IDs, summaries, or counts.

Errors: `401 SESSION_REQUIRED`, `403 REQUESTER_DASHBOARD_FORBIDDEN`, generic `500 REQUESTER_DASHBOARD_FAILED`.

### GET `/api/staff/dashboard`

IT Staff and Administrator. Same operational calculation for either role; no separate Admin metrics. Success:

```json
{
  "asOf": "2026-09-26T14:00:00.000Z",
  "metrics": {
    "unassignedActiveCount": 4,
    "myActiveCount": 2,
    "highPriorityActiveCount": 1,
    "statusBreakdown": {
      "NEW": 1,
      "OPEN": 2,
      "IN_PROGRESS": 2,
      "WAITING_FOR_REQUESTER": 1,
      "REOPENED": 0
    },
    "itPriorityBreakdown": { "LOW": 1, "MEDIUM": 3, "HIGH": 2 }
  },
  "recentlyUpdated": [/* up to 5 active Ticket summaries */]
}
```

- `unassignedActiveCount`: active Tickets with null primary owner.
- `myActiveCount`: active Tickets whose primary owner is the authenticated User.
- `highPriorityActiveCount`: active Tickets with IT Priority `HIGH`.
- `statusBreakdown`: include each active status, even at zero.
- `itPriorityBreakdown`: active Tickets by `LOW`, `MEDIUM`, `HIGH`, even at zero.
- `recentlyUpdated`: active Tickets updated in the inclusive window, ordered `updatedAt desc, id desc`.
- Every metric links to `/staff/tickets` with the matching status, IT Priority, owner or unassigned filter. Recent rows open `/staff/tickets/:ticketId`.

Errors: `401 SESSION_REQUIRED`, `403 STAFF_DASHBOARD_FORBIDDEN`, generic `500 STAFF_DASHBOARD_FAILED`.

## 7. Authorization and error matrix

| Request | Requester | IT Staff | Administrator |
| --- | --- | --- | --- |
| Read Actions Taken | Owned Ticket only | Permitted Ticket | Permitted Ticket |
| Create/update Actions Taken | `403` | Permitted Ticket | Permitted Ticket |
| Requester dashboard | Own data | `403` | `403` |
| Staff dashboard | `403` | Own operational metrics | Same operational metrics |
| Ticket status transition | `403` | Matrix + confirmation + resolution gate | Matrix + confirmation + resolution gate |
| Public Comment/Internal Note write | Own Public Comment only | Existing Lab 3 Staff write permissions | Existing Lab 3 Admin read permissions; write remains denied |
| Requester resolution indication | Owned Ticket, advisory only | Existing role behavior | Existing role behavior |

Use `400` for invalid IDs/body/enums/missing confirmation, `401` for no valid session, `403` for a valid session without role permission or invalid CSRF, `404` for missing/non-disclosing inaccessible resources, and `409` for idempotency/version/status/resolution precondition conflicts. Every error path is safe and mutation-free.

## 8. Test traceability

- UNIT-01 covers action fields, follow-up normalization, UUID idempotency shape, and validation.
- UNIT-02 covers transition graph, confirmation, resolvedAt/lastReopenedAt behavior, and resolution gate.
- API-01 through API-05 cover Action Taken writes/reads, actor/owner/role rules, idempotency, stale updates, status gate, direct authorization, atomicity, and safe errors.
- API-06/API-07 cover exact dashboard queries, authenticated scoping, bounds, date boundaries, stable ordering, zero/non-zero values, and drill-down destinations.
- API-08 covers migration, timestamp backfill, seed repeatability, and Labs 1–3 regression.
- UI-01/UI-02/UI-03 cover user-observable actions/dashboard/role/accessibility states.
- E2E-01 through E2E-04 cover seeded full-stack journeys; PERF-01 verifies bounded dashboard summaries and records local time.

Full file-level mapping and planned/not-yet-run state are in [tests.md](tests.md). Do not label any test passed until it has actually run and its command, revision, environment, and result are recorded.
