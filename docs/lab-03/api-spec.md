# Lab 3 REST API specification

Status: draft implementation contract for Issue #72; human review is required before Lab 3 implementation Pull Requests are completed
Origin issue: #72 - Lab 3 - Sprint specification and test plan
Related contract: [specification.md](specification.md)
UI contract: [ui-spec.md](ui-spec.md)

Base URL: `/api`

This document defines the Lab 3 wire contract. The implementation must preserve the Lab 2 API behavior where it remains in scope, remove the Development Requester identity boundary, and use authenticated server-side identity for all Requester ownership decisions.

## 1. API conventions

### 1.1 Content and serialization

- JSON requests use `Content-Type: application/json` and UTF-8.
- Attachment upload uses `multipart/form-data` with exactly one `file` part.
- JSON timestamps are ISO 8601 UTC strings.
- IDs are positive JSON integers.
- Enum values on the wire are uppercase: `REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`, `LOW`, `MEDIUM`, `HIGH`, `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`.
- Successful JSON responses contain a resource, list, or metadata object. `204` responses have no body.
- No response contains a stack trace, password, password hash, session token, CSRF secret other than the intended CSRF token, local storage path, or private note content outside an authorized Internal Note response.

### 1.2 Authentication and session cookies

The server uses an opaque database-backed session.

- `POST /api/auth/login` accepts email/password without an existing session. On success it creates a cryptographically random opaque session value and sets `toktickit_session`.
- The browser sends `toktickit_session` automatically. The cookie is `HttpOnly`, `Path=/`, `SameSite=Lax`, and has an 8-hour maximum age. `Secure` is enabled in production and can be disabled for local HTTP development only.
- The raw session value is never stored in the database. The server stores a SHA-256 hash, User ID, creation time, expiration time, and optional revocation time in `Session`.
- Every protected request loads the session, rejects expired or revoked sessions, and loads the current User. The User must still be active.
- `mustChangePassword = true` creates a limited authenticated session. It permits `GET /api/auth/me`, `PATCH /api/auth/password`, and logout, but normal application endpoints return `403 PASSWORD_CHANGE_REQUIRED`.
- `POST /api/auth/logout` revokes the current session and clears both session cookies. Logout is safe to repeat and returns `204` when no usable session remains.

### 1.3 CSRF protection

Because authentication uses a cookie, state-changing browser requests require CSRF protection.

- On successful login, the server sets a readable `toktickit_csrf` cookie containing a random token. It is `Path=/`, `SameSite=Lax`, `Secure` in production, and not `HttpOnly` so the client can copy it into a header.
- The server stores only a hash of the CSRF token with the session. The raw token is not logged or persisted as application data.
- Every `POST`, `PATCH`, and `DELETE` after login, except the public login request, must include `X-CSRF-Token` equal to the current CSRF cookie. The server hashes that raw header/cookie value and compares the digest, using a timing-safe comparison, with the session's stored CSRF-token hash. It is not compared with the session-token hash.
- The server also validates a supplied `Origin` against the configured application origin when the header is present. A missing Origin is allowed for server-side tests and non-browser clients only when the CSRF token and session are valid.
- A missing or invalid token returns `403 CSRF_TOKEN_INVALID` without performing the mutation.
- `GET`, `HEAD`, and `OPTIONS` do not mutate application state and do not require the CSRF header.

### 1.4 Common error shape

```json
{
  "error": {
    "code": "STABLE_ERROR_CODE",
    "message": "Safe human-readable message",
    "fields": [
      {
        "field": "email",
        "code": "EMAIL_INVALID",
        "message": "Enter a valid email address."
      }
    ]
  }
}
```

`fields` is optional and is used for input validation. Messages do not reveal credentials, hashes, storage paths, another Requester's data, or database implementation details. Unexpected errors use a stable generic code and message.

## 2. Resource shapes

### 2.1 Public User

```json
{
  "id": 1,
  "name": "Requester A",
  "email": "requester-a@toktickit.test",
  "role": "REQUESTER",
  "active": true,
  "mustChangePassword": false
}
```

`passwordHash`, raw passwords, session identifiers, and CSRF token hashes are never returned. The Administrator list may additionally return `status` as `ACTIVE` or `INACTIVE`; it does not return credential data.

### 2.2 Reference resource

```json
{ "id": 1, "name": "Email" }
```

Only active Categories and Related Systems are returned to an authorized client.

### 2.3 Requester Ticket summary

```json
{
  "id": 1,
  "ticketNumber": "TT-20260910-ABC123",
  "ticketDate": "2026-09-10T10:30:00.000Z",
  "category": { "id": 1, "name": "Software" },
  "relatedSystem": { "id": 1, "name": "Email" },
  "requestedPriority": "HIGH",
  "summary": "Cannot access course email",
  "currentStatus": "OPEN",
  "lastUpdated": "2026-09-10T10:35:00.000Z"
}
```

The requester endpoint derives the User from the session and does not return a client-selected requester identity.

### 2.4 Staff Ticket summary

```json
{
  "id": 1,
  "ticketNumber": "TT-20260910-ABC123",
  "ticketDate": "2026-09-10T10:30:00.000Z",
  "requester": { "id": 10, "name": "Requester A" },
  "category": { "id": 1, "name": "Software" },
  "relatedSystem": { "id": 1, "name": "Email" },
  "requestedPriority": "HIGH",
  "itPriority": "HIGH",
  "summary": "Cannot access course email",
  "currentStatus": "OPEN",
  "owner": { "id": 20, "name": "IT Staff A", "role": "IT_STAFF" },
  "lastUpdated": "2026-09-10T10:35:00.000Z"
}
```

`owner` is `null` when the Ticket is unassigned.

### 2.5 Ticket detail

```json
{
  "id": 1,
  "ticketNumber": "TT-20260910-ABC123",
  "ticketDate": "2026-09-10T10:30:00.000Z",
  "requester": { "id": 10, "name": "Requester A" },
  "category": { "id": 1, "name": "Software" },
  "relatedSystem": { "id": 1, "name": "Email" },
  "requestedPriority": "HIGH",
  "itPriority": "HIGH",
  "summary": "Cannot access course email",
  "description": "The browser shows an authentication error after sign-in.",
  "currentStatus": "OPEN",
  "owner": { "id": 20, "name": "IT Staff A", "role": "IT_STAFF" },
  "requesterResolutionIndicatedAt": null,
  "createdAt": "2026-09-10T10:30:00.000Z",
  "updatedAt": "2026-09-10T10:35:00.000Z",
  "attachments": [],
  "publicComments": []
}
```

Requester responses omit `itPriority`, `owner`, and `internalNotes` when those fields are not needed by the Requester UI. Staff responses include the operational fields. Administrator read-only communication responses may include the fields required for the visibility contract but never expose mutation permissions.

### 2.6 Comment and note shapes

```json
{
  "id": 1,
  "author": { "id": 20, "name": "IT Staff A", "role": "IT_STAFF" },
  "content": "Please try the documented browser sign-in again.",
  "createdAt": "2026-09-10T10:40:00.000Z"
}
```

The same shape is used for Public Comments and Internal Notes. The endpoint and authorization determine visibility. Entries are append-only and are ordered by `createdAt` ascending, then `id` ascending.

### 2.7 Attachment metadata

Lab 2 Attachment metadata and soft-removal behavior remain valid:

```json
{
  "id": 1,
  "displayName": "error.png",
  "mimeType": "image/png",
  "sizeBytes": 2048,
  "uploadedAt": "2026-09-10T10:45:00.000Z",
  "removedAt": null,
  "removalReason": null,
  "isActive": true,
  "downloadUrl": "/api/tickets/1/attachments/1/download"
}
```

Removed metadata remains visible to the owning Requester and permitted staff roles with `isActive: false` and a null `downloadUrl`.

### 2.8 User list item

```json
{
  "id": 1,
  "name": "Requester A",
  "email": "requester-a@toktickit.test",
  "role": "REQUESTER",
  "status": "ACTIVE"
}
```

## 3. Endpoint index

| Method | Path | Required role/state | Success |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Public | `200` session and public User |
| GET | `/api/auth/me` | Any valid session, including limited | `200` current User and CSRF token |
| PATCH | `/api/auth/password` | Any valid session with current password | `200` updated User |
| POST | `/api/auth/logout` | Valid session or repeat-safe no session | `204` |
| GET | `/api/categories` | Authenticated normal User | `200` active Category list |
| GET | `/api/related-systems` | Authenticated normal User | `200` active Related System list |
| POST | `/api/tickets` | Requester, normal session | `201` created Ticket |
| GET | `/api/tickets` | Requester, normal session | `200` paginated owned Tickets |
| GET | `/api/tickets/:ticketId` | Requester, own Ticket | `200` owned Ticket detail |
| POST | `/api/tickets/:ticketId/attachments` | Requester, own Ticket | `201` Attachment metadata |
| GET | `/api/tickets/:ticketId/attachments` | Requester, own Ticket | `200` Attachment metadata list |
| GET | `/api/tickets/:ticketId/attachments/:attachmentId/download` | Requester, own active Attachment | `200` file bytes |
| DELETE | `/api/tickets/:ticketId/attachments/:attachmentId` | Requester, own active Attachment | `204` soft removal |
| GET | `/api/tickets/:ticketId/comments` | Own Requester Ticket, IT Staff, or Administrator | `200` Public Comments |
| POST | `/api/tickets/:ticketId/comments` | Own Requester Ticket or IT Staff | `201` Public Comment |
| POST | `/api/tickets/:ticketId/resolution-indication` | Requester, own Ticket | `200` updated indication |
| GET | `/api/tickets/:ticketId/internal-notes` | IT Staff or Administrator | `200` Internal Notes |
| POST | `/api/tickets/:ticketId/internal-notes` | IT Staff | `201` Internal Note |
| GET | `/api/staff/tickets` | IT Staff | `200` paginated Queue |
| GET | `/api/staff/tickets/:ticketId` | IT Staff | `200` staff Ticket detail |
| POST | `/api/staff/tickets/:ticketId/claim` | IT Staff | `200` updated Ticket |
| PATCH | `/api/staff/tickets/:ticketId/owner` | IT Staff | `200` updated Ticket |
| PATCH | `/api/staff/tickets/:ticketId/priority` | IT Staff | `200` updated Ticket |
| PATCH | `/api/staff/tickets/:ticketId/status` | IT Staff | `200` updated Ticket |
| GET | `/api/admin/tickets/:ticketId` | Administrator | `200` read-only Ticket detail |
| PATCH | `/api/admin/tickets/:ticketId/priority` | Administrator | `200` updated IT Priority |
| GET | `/api/admin/users` | Administrator | `200` User list |
| POST | `/api/admin/users` | Administrator | `201` User |
| PATCH | `/api/admin/users/:userId` | Administrator | `200` User |
| POST | `/api/admin/users/:userId/initial-password` | Administrator | `204` |

## 4. Authentication endpoints

### POST `/api/auth/login`

Public request body:

```json
{
  "email": "requester-a@toktickit.test",
  "password": "local-only-password"
}
```

The server trims and normalizes email, validates the password boundary, compares the stored hash, verifies the account is active, creates a session, and sets `toktickit_session` and `toktickit_csrf` cookies.

Success `200`:

```json
{
  "user": {
    "id": 1,
    "name": "Requester A",
    "email": "requester-a@toktickit.test",
    "role": "REQUESTER",
    "active": true,
    "mustChangePassword": true
  },
  "session": { "expiresAt": "2026-09-10T18:30:00.000Z" },
  "csrfToken": "returned-for-the-client-header"
}
```

`csrfToken` is not an authentication credential. The client keeps it only as needed to mirror the CSRF cookie in `X-CSRF-Token` and never places it in a URL or log.

Errors:

| Status | Code | Use |
| --- | --- | --- |
| `400` | `LOGIN_INPUT_INVALID` | Missing/invalid email or password shape. |
| `401` | `INVALID_CREDENTIALS` | Unknown email or incorrect password; no session. |
| `403` | `ACCOUNT_INACTIVE` | Credentials are valid for an inactive account; no normal session. |
| `500` | `LOGIN_FAILED` | Safe unexpected failure. |

### GET `/api/auth/me`

Requires a valid session but permits the limited password-change state. Returns `200` with `user`, `session.expiresAt`, and the current `csrfToken`. It returns `401 SESSION_REQUIRED` when no valid session exists. It never returns a password or token hash.

### PATCH `/api/auth/password`

Requires a valid session and `X-CSRF-Token`; a limited session is allowed. Request body:

```json
{
  "currentPassword": "local-only-password",
  "newPassword": "new-local-only-password!1",
  "confirmPassword": "new-local-only-password!1"
}
```

The server verifies the current password, validates the new password rule, stores a new scrypt hash, clears `mustChangePassword`, revokes every existing session for the User, creates a fresh session for the current request, and sets fresh session/CSRF cookies. Success `200` returns the public User with `mustChangePassword: false`, the new session expiry, and the fresh CSRF token. A password change never leaves a sibling session usable.

Errors include `400 PASSWORD_INPUT_INVALID`, `401 CURRENT_PASSWORD_INVALID` or `SESSION_REQUIRED`, `403 CSRF_TOKEN_INVALID`, `409 PASSWORD_REUSE_NOT_ALLOWED` when the new password equals the current password, and `500 PASSWORD_CHANGE_FAILED`.

### POST `/api/auth/logout`

Requires the current session and CSRF token when a session exists. The server marks the session revoked, clears the session and CSRF cookies, and returns `204`. A repeated logout is also `204` and does not reveal prior session state.

## 5. Authenticated Requester and reference APIs

### GET `/api/categories` and GET `/api/related-systems`

Require a normal authenticated User. Return active records as an ascending-ID array of reference resources. Inactive records are not returned. A database failure returns `503 REFERENCE_DATA_UNAVAILABLE` or a safe `500 REFERENCE_DATA_FAILED`.

### POST `/api/tickets`

Requires a normal authenticated Requester session and CSRF token. The request body preserves the Lab 2 contract but removes all client identity fields:

```json
{
  "clientRequestId": "550e8400-e29b-41d4-a716-446655440000",
  "categoryId": 1,
  "relatedSystemId": 1,
  "requestedPriority": "HIGH",
  "summary": "Cannot access course email",
  "description": "The browser shows an authentication error after sign-in."
}
```

The body must not include `requesterId`, `ticketNumber`, `ticketDate`, `currentStatus`, `itPriority`, or Attachment bytes. The server derives the Requester from the session, generates Ticket Number/date, sets `NEW`, and initializes `itPriority` equal to `requestedPriority`.

Validation:

- `clientRequestId` is a UUID and is required.
- Category and Related System IDs must refer to active records.
- Requested Priority must be `LOW`, `MEDIUM`, or `HIGH`.
- Summary is trimmed and is 5-120 characters inclusive.
- Description is trimmed and is 20-4,000 characters inclusive.

Success is `201` with the created Requester Ticket detail and an empty attachment list. A retry by the same authenticated Requester with the same `clientRequestId` and equivalent normalized payload returns `200` with the existing Ticket. Reusing the key for a different payload returns `409 IDEMPOTENCY_KEY_REUSED`.

Other errors are `400 TICKET_INPUT_INVALID`, `404 CATEGORY_NOT_FOUND` or `RELATED_SYSTEM_NOT_FOUND`, and `500 TICKET_CREATE_FAILED`.

### GET `/api/tickets`

Requires a normal authenticated Requester session. The server always applies `requesterUserId = session.userId` before search, filtering, sorting, or pagination. Supported query parameters:

| Parameter | Values | Default | Meaning |
| --- | --- | --- | --- |
| `search` | trimmed string, max 120 characters | empty | Case-insensitive contains over Ticket Number and Summary. |
| `categoryId` | positive integer | omitted | Category filter. |
| `relatedSystemId` | positive integer | omitted | Related System filter. |
| `requestedPriority` | `LOW`, `MEDIUM`, `HIGH` | omitted | Requested Priority filter. |
| `currentStatus` | any required Ticket status | omitted | Current status filter. |
| `sortBy` | `ticketDate`, `updatedAt`, `ticketNumber`, `summary` | `ticketDate` | Primary sort field. |
| `sortDirection` | `asc`, `desc` | `desc` | Primary sort direction. |
| `page` | positive integer | `1` | One-based page. |
| `pageSize` | `10`, `20`, `50` | `10` | Page size. |

Sorting applies the requested field and direction, then `id desc` as a deterministic tie-breaker. Response `200`:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 10,
  "totalItems": 0,
  "totalPages": 0
}
```

An empty owned list and a valid query with no matches have the same safe wire shape; the UI distinguishes them by whether active query controls are present. Invalid query values return `400 TICKET_QUERY_INVALID`; unexpected failures return `500 TICKET_LIST_FAILED`.

### GET `/api/tickets/:ticketId`

Requires a normal authenticated Requester session and a positive integer Ticket ID. The server scopes the query by the session User before reading the Ticket. A missing or cross-Requester Ticket returns `404 TICKET_NOT_FOUND` without revealing whether another User owns it. Success is `200` with Requester Ticket detail, including active and removed Attachment metadata and Public Comments but no Internal Notes.

### Requester Attachments

The Lab 2 routes remain under `/api/tickets/:ticketId/attachments` and require an authenticated Requester who owns the Ticket. The server preserves the existing rules:

- Upload uses exactly one `file` part and accepts JPG, JPEG, PNG, WEBP, and PDF.
- Extension and server-validated MIME category are checked.
- Each file is at most 5 MB and a Ticket has at most five active Attachments.
- The original filename is display metadata only; storage uses a generated safe key.
- Metadata returns active and removed records. Removed records have no download URL.
- Download returns only active content with safe `Content-Disposition` and stored MIME type.
- Delete is a soft removal with `{ "removalReason": "..." }`, trimmed to 3-200 characters, and requires explicit UI confirmation.

Cross-Requester Ticket/Attachment access returns a non-disclosing `404`. Other Lab 2 error codes remain: `400 ATTACHMENT_FILE_REQUIRED` or `ATTACHMENT_UPLOAD_INVALID`, `409 ACTIVE_ATTACHMENT_LIMIT_REACHED` or `ATTACHMENT_ALREADY_REMOVED`, `410 ATTACHMENT_REMOVED`, `413 ATTACHMENT_TOO_LARGE`, `415 ATTACHMENT_TYPE_NOT_ALLOWED`, `503 ATTACHMENT_STORAGE_UNAVAILABLE`, and safe `500` failures.

## 6. Public Comments, Internal Notes, and resolution indication

### GET `/api/tickets/:ticketId/comments`

Permitted roles are:

- Requester: only their own Ticket.
- IT Staff: permitted Ticket records in the shared workflow.
- Administrator: read-only visibility required by the Public Comment rule.

The endpoint returns a chronological array of Public Comment shapes. Requesters cannot use another Requester's Ticket ID to learn whether it exists.

### POST `/api/tickets/:ticketId/comments`

Requires CSRF and permits an authenticated Requester on their own Ticket or IT Staff on a permitted Ticket. Request body:

```json
{ "content": "I can sign in now, but the problem still occurs." }
```

Content is trimmed, must be 1-2,000 characters, rejects whitespace-only input, and is stored as plain text. The author and timestamp come from the session. Success is `201` with the created Public Comment. Invalid content returns `400 COMMENT_INPUT_INVALID`; forbidden or cross-owner access is `403` or non-disclosing `404` as applicable; unexpected failure returns `500 COMMENT_CREATE_FAILED`.

### POST `/api/tickets/:ticketId/resolution-indication`

Requires an authenticated Requester, CSRF, and ownership of the Ticket. The request body is:

```json
{ "appearsResolved": true }
```

`true` records `requesterResolutionIndicatedAt` using the server clock and the authenticated Requester identity. Repeating the same indication is idempotent. This endpoint never changes `currentStatus` and cannot set `RESOLVED` or `CLOSED`. Success is `200` with the updated indication. Invalid body, cross-owner, and unexpected failures use safe documented errors.

### GET `/api/tickets/:ticketId/internal-notes`

Requires IT Staff or Administrator authentication. It returns chronological Internal Note shapes. Requesters receive `403 INTERNAL_NOTES_FORBIDDEN` without note content. A missing or inaccessible Ticket is handled without disclosing protected resources.

### POST `/api/tickets/:ticketId/internal-notes`

Requires IT Staff authentication and CSRF. Administrator read access does not grant creation permission. Request body is `{ "content": "..." }` with the same trim, 2,000-character, plain-text, append-only rules as Public Comments. Success is `201`; invalid, forbidden, missing, and unexpected failures use stable safe codes.

## 7. IT Staff Ticket Queue and operations

### GET `/api/staff/tickets`

Requires a normal authenticated IT Staff session. The Queue always returns a shared operational view and supports:

| Parameter | Values | Default | Meaning |
| --- | --- | --- | --- |
| `search` | trimmed string, max 120 characters | empty | Case-insensitive contains over Ticket Number and Summary. |
| `categoryId` | positive integer | omitted | Category filter. |
| `relatedSystemId` | positive integer | omitted | Related System filter. |
| `requestedPriority` | `LOW`, `MEDIUM`, `HIGH` | omitted | Requester priority filter. |
| `itPriority` | `LOW`, `MEDIUM`, `HIGH` | omitted | Staff priority filter. |
| `currentStatus` | required Ticket status | omitted | Workflow status filter. |
| `owner` | `unassigned`, `me`, or positive User ID | omitted | Ownership filter. Target must be an eligible active IT Staff or Administrator when a User ID is used. |
| `sortBy` | `ticketDate`, `updatedAt`, `ticketNumber`, `itPriority`, `currentStatus`, `owner` | `updatedAt` | Primary sort field. |
| `sortDirection` | `asc`, `desc` | `desc` | Primary sort direction. |
| `page` | positive integer | `1` | One-based page. |
| `pageSize` | `10`, `20`, `50` | `10` | Page size. |

Search, filters, sorting, and pagination are applied server-side. Sorting uses `id desc` as the final tie-breaker. The response also includes the complete active IT Staff and Administrator owner list so the ownership filter is not limited to the current page. Response `200`:

```json
{
  "items": [/* Staff Ticket summaries */],
  "eligibleOwners": [/* active IT Staff and Administrator targets */],
  "page": 1,
  "pageSize": 10,
  "totalItems": 1,
  "totalPages": 1
}
```

Empty and no-results responses use the same shape with `items: []`. Invalid values return `400 STAFF_QUEUE_QUERY_INVALID`; a non-IT Staff receives `403 STAFF_QUEUE_FORBIDDEN`; an unexpected failure returns `500 STAFF_QUEUE_FAILED`.

### GET `/api/staff/tickets/:ticketId`

Requires IT Staff and a positive integer Ticket ID. It returns staff Ticket detail with owner, IT Priority, status, Public Comments, Internal Notes, existing Attachment metadata, and the Requester resolution indication. A missing Ticket returns `404 TICKET_NOT_FOUND`. The response does not grant a client permission to mutate any field without the matching operation endpoint.

### POST `/api/staff/tickets/:ticketId/claim`

Requires IT Staff and CSRF. The Ticket must be unassigned. The server sets the owner to the authenticated IT Staff User. A Ticket already assigned returns `409 TICKET_ALREADY_ASSIGNED`; unknown/cross-scope resources return a safe `404`; success is `200` with the updated staff Ticket detail.

### PATCH `/api/staff/tickets/:ticketId/owner`

Requires IT Staff and CSRF. Request body:

```json
{ "ownerId": 21 }
```

The target must be an active IT Staff or Administrator. This is assignment/reassignment, not a role change. Unknown, inactive, Requester, or invalid targets return `400`/`404 OWNER_INVALID` and the current owner remains unchanged. Success is `200` with the updated Ticket.

### PATCH `/api/staff/tickets/:ticketId/priority`

Requires IT Staff and CSRF. Request body:

```json
{ "itPriority": "MEDIUM" }
```

The value must be `LOW`, `MEDIUM`, or `HIGH`; the Requester's `requestedPriority` is unchanged. Success is `200` with the updated Ticket. Invalid input returns `400 IT_PRIORITY_INVALID`.

### PATCH `/api/staff/tickets/:ticketId/status`

Requires IT Staff and CSRF. Request body:

```json
{
  "status": "RESOLVED",
  "confirmation": true
}
```

The server checks the current status, target status, role, and confirmation against the matrix in `specification.md`. `confirmation: true` is required for transitions into `RESOLVED`, `CLOSED`, `REOPENED`, or `CANCELLED`; it is ignored only when no confirmation is required. Unlisted transitions return `400 TICKET_STATUS_TRANSITION_INVALID`; missing confirmation returns `400 STATUS_CONFIRMATION_REQUIRED`; a concurrent status change returns `409 TICKET_STATUS_CONFLICT` so the client can refresh before retrying; success is `200` with the updated Ticket. No update is partially applied on failure.

## 8. Administrator User Management

All routes require an active Administrator normal session and CSRF for mutations. No route supports User deletion, bulk operations, import/export, roles arrays, email delivery, history, or advanced account recovery.

### GET `/api/admin/tickets/:ticketId`

This is the Administrator's read-only Ticket Review endpoint. It requires an active Administrator session, accepts a positive integer Ticket ID, and returns any existing Ticket's read-only facts, Requester, Category, Related System, Requested Priority, IT Priority, status, owner, Attachment metadata, Public Comments, Internal Notes, and Requester resolution indication. It is a detail lookup, not a Queue and not a Ticket mutation permission. A missing Ticket returns `404 TICKET_NOT_FOUND`; the response never exposes credentials or storage keys.

### PATCH `/api/admin/tickets/:ticketId/priority`

This is the narrow Administrator exception required by the handout. It requires an active Administrator session and CSRF. The request body is the same as the staff priority operation:

```json
{ "itPriority": "MEDIUM" }
```

The server changes only IT Priority, preserves Requested Priority, and does not grant Queue, ownership, status, Public Comment, or Internal Note creation permissions. Success is `200` with the read-only Administrator Ticket detail. Invalid values return `400 IT_PRIORITY_INVALID`; a missing Ticket returns `404 TICKET_NOT_FOUND`; a non-Administrator receives `403 ADMIN_TICKET_FORBIDDEN`; unexpected failures return `500 ADMIN_TICKET_PRIORITY_FAILED`.

### GET `/api/admin/users`

Query parameters:

| Parameter | Values | Default | Meaning |
| --- | --- | --- | --- |
| `search` | trimmed string, max 120 characters | empty | Case-insensitive contains over name or email. |
| `role` | `REQUESTER`, `IT_STAFF`, `ADMINISTRATOR` | omitted | One optional role filter. |

The response is an array of User list items ordered by normalized name ascending, then ID ascending. There is no pagination, multi-column sorting, or multiple simultaneous User-list filter system. Invalid values return `400 USER_QUERY_INVALID`; a non-Administrator receives `403 USER_MANAGEMENT_FORBIDDEN`.

### POST `/api/admin/users`

Request body:

```json
{
  "name": "New IT Staff",
  "email": "new-staff@toktickit.test",
  "role": "IT_STAFF",
  "active": true,
  "initialPassword": "local-initial-password!1",
  "confirmInitialPassword": "local-initial-password!1"
}
```

The server trims/normalizes name and email, validates the one role and activation state, checks unique email, hashes the initial password, and sets `mustChangePassword = true`. Success is `201` with a User list item or public User without credentials. Errors include `400 USER_INPUT_INVALID` or `PASSWORD_INPUT_INVALID`, `409 EMAIL_ALREADY_EXISTS`, and safe `500 USER_CREATE_FAILED`.

### PATCH `/api/admin/users/:userId`

Request body is a partial update containing at least one of the following:

```json
{
  "name": "Updated Name",
  "email": "updated@toktickit.test",
  "role": "REQUESTER",
  "active": true
}
```

Only name, normalized email, one role, and activation state are editable. Password changes use the dedicated endpoint. The server rejects invalid roles, duplicate emails, unknown Users, self-deactivation (`409 SELF_DEACTIVATION_NOT_ALLOWED`), removal/deactivation of the last active Administrator, and any role/activation update that would leave one or more existing Tickets owned by an inactive User or a Requester. The User update and ownership check are one atomic operation; no partial User update is persisted. Success is `200`; safe errors include `400 USER_INPUT_INVALID`, `404 USER_NOT_FOUND`, `409 EMAIL_ALREADY_EXISTS`, `SELF_DEACTIVATION_NOT_ALLOWED`, `LAST_ADMINISTRATOR_REQUIRED`, or `USER_OWNS_TICKETS`, and `500 USER_UPDATE_FAILED`.

### POST `/api/admin/users/:userId/initial-password`

Request body:

```json
{
  "initialPassword": "replacement-initial-password!1",
  "confirmInitialPassword": "replacement-initial-password!1"
}
```

The server stores only the new hash, sets `mustChangePassword = true`, revokes every existing session for the target User, and does not send email. Success is `204`. Invalid password input, unknown User, forbidden role, CSRF failure, and unexpected failure return safe stable errors. The next login is limited to the Change Password flow.

## 9. Validation, authorization, and safe-error matrix

| Operation | Authentication | Resource/role validation | Ownership or disclosure behavior |
| --- | --- | --- | --- |
| Login | Public | Email/password boundary and account state | Generic invalid credentials; minimal inactive response. |
| Normal application | Valid active session with `mustChangePassword = false` | Role middleware | Limited sessions receive `403 PASSWORD_CHANGE_REQUIRED`. |
| Requester Ticket/Attachment | Requester normal session | IDs, body, file, and active references | Scope by session User; cross-owner resources use non-disclosing `404`. |
| Public Comment | Requester owner or IT Staff | Content and Ticket access | Author comes from session; Admin is read-only. |
| Internal Note | IT Staff/Admin read; IT Staff create | Content and Ticket access | Requesters receive `403` with no note content. |
| Staff Queue/operations | IT Staff normal session | Query, assignment, priority, status matrix | Shared queue; invalid mutation does not partially update. |
| Administrator Ticket Review | Administrator normal session | Positive Ticket ID; read-only detail | Any existing Ticket may be read; no Queue or general Ticket mutation is granted. |
| Administrator IT Priority | Administrator normal session | Priority enum and Ticket existence | Only IT Priority changes; Requested Priority and all other fields remain unchanged. |
| User Management | Administrator normal session | One role, unique email, account-safety rules | Non-Administrators receive safe `403`; no credential data. |
| State-changing request | Valid session | CSRF token and Origin check | Invalid CSRF is rejected before mutation. |

Status policy:

- `400`: malformed or invalid input, invalid query, invalid transition, missing confirmation.
- `401`: missing/expired/revoked session or invalid credentials.
- `403`: valid session but wrong role, limited password-change state, inactive account, or invalid CSRF.
- `404`: missing resource or non-disclosing cross-owner access.
- `409`: duplicate/conflicting identity, idempotency key reuse, already assigned/removed state, Administrator safety conflict, or a User update that would leave owned Tickets ineligible.
- `410`: removed Attachment content.
- `413`: file too large.
- `415`: unsupported file type.
- `503`: unavailable reference or Attachment storage dependency.
- `500`: unexpected failure with a generic safe code and message.

## 10. Migration and seed API boundary

Migration is a database/application operation, not a public REST endpoint. The implementation must:

- create Users from Development Requesters matched by normalized email;
- preserve Ticket and Attachment ownership and IDs;
- hash one-time local initial passwords and mark migrated Users for password change;
- write newly generated migration passwords only through the explicit ignored local handoff workflow in `specification.md`, then verify first-login completion before deleting that handoff;
- initialize IT Priority from Requested Priority and preserve existing `NEW` status;
- create the Public Comment, Internal Note, Session, and new ownership structures;
- verify no orphaned Ticket or Attachment relationships before making new ownership required; and
- remove the selector dependency only after the backfill is verified.

Seed is repeat-safe and creates at least four active Requesters, one inactive Requester, three active IT Staff, one inactive IT Staff, one active Administrator, realistic Tickets across statuses/priorities/ownership, and safe example comments/notes. Local credentials are provided through an uncommitted development/test environment variable; the API never returns or logs them.

## 11. Test and traceability references

The contract is planned against:

- `server/tests/lab-03/auth.api.test.ts`
- `server/tests/lab-03/authorization.api.test.ts`
- `server/tests/lab-03/staff-queue.api.test.ts`
- `server/tests/lab-03/staff-ticket-detail.api.test.ts`
- `server/tests/lab-03/comments-notes.api.test.ts`
- `server/tests/lab-03/users-admin.api.test.ts`
- `server/tests/lab-03/auth.unit.test.ts`
- `server/tests/lab-03/migration.unit.test.ts`
- `client/tests/lab-03/Login.test.tsx`
- `client/tests/lab-03/ChangePassword.test.tsx`
- `client/tests/lab-03/StaffTicketQueue.test.tsx`
- `client/tests/lab-03/StaffTicketDetail.test.tsx`
- `client/tests/lab-03/UserManagement.test.tsx`
- `client/tests/lab-03/zen-green.responsive.test.tsx`
- `e2e/lab-03/authentication.spec.ts`
- `e2e/lab-03/staff-ticket-flow.spec.ts`
- `e2e/lab-03/user-administration.spec.ts`

Every endpoint, authorization rule, validation boundary, safe error, and migration decision must have a planned test mapping in [tests.md](tests.md).
