# Lab 2 REST API specification

Status: implementation contract completed; routes released to final `main` at `538b5da`; final evidence review pending (2026-09-04)

Origin issue: #51 - Lab 2 - Sprint specification and test plan
Applies to: Issues #51-#57 and the integrated Lab 2 result

Base URL: `/api`

This document defines the wire contract for the Lab 2 requester-facing increment. It is aligned with `specification.md`; the implementation must not invent a different requester context, query contract, response shape, or error policy without updating both documents and their tests.

## Current Lab 2 state

The API contract was delivered with Issue #51 and is implemented by the merged Lab 2 work in `lab2-staging` (PRs #58-#64), the test-isolation follow-up PR #69, and the release PR #70. The API and integration tests pass in the recorded final-main-aligned validation. This document describes the released contract on `main` at `538b5da`; formal review and final evidence sign-off remain separate delivery responsibilities.

## 1. API conventions

### 1.1 Requester testing context

Every requester-scoped request requires this header:

| Header | Required | Value |
| --- | --- | --- |
| `X-Development-Requester-Id` | Yes for ticket and attachment operations | Positive integer ID of an active seeded Development Requester. |

This header is a test context only. It is intentionally spoofable in Lab 2 and is not authentication, a session, a token, or authorization. Reference-data endpoints do not require it.

Missing, non-integer, unknown, or inactive requester context is rejected before business data is read. Ownership failures for a valid context are returned as non-disclosing `404` responses.

### 1.2 Content and response conventions

- JSON requests use `Content-Type: application/json` and UTF-8.
- Attachment upload uses `multipart/form-data` with one `file` part.
- JSON timestamps are ISO 8601 UTC strings.
- IDs are positive JSON integers.
- Enum values on the wire are uppercase: `LOW`, `MEDIUM`, `HIGH`, and `NEW`.
- Successful JSON responses contain a resource, list, or metadata object; errors use the common error shape below.
- No response includes a stack trace, database error, local storage path, or secret.

### 1.3 Common error shape

```text
{
  error: {
    code: string,
    message: string,
    fields?: [
      {
        field: string,
        code: string,
        message: string
      }
    ]
  }
}
```

`fields` is present for input validation and identifies the field-safe reason that the client can render next to a control. Unexpected errors use a stable code and generic message.

## 2. Resource shapes

### 2.1 Reference resource

```text
{ id: 1, name: string }
```

### 2.2 Development Requester

```text
{ id: 1, name: string, email: string }
```

Only active Requesters are returned. The `active` database flag is not exposed because inactive records are not valid selector options.

### 2.3 Ticket summary

```text
{
  id: 1,
  ticketNumber: string,
  ticketDate: ISO-8601 UTC string,
  requester: { id: 1, name: string },
  category: { id: 1, name: string },
  relatedSystem: { id: 1, name: string },
  requestedPriority: LOW | MEDIUM | HIGH,
  summary: string,
  currentStatus: NEW,
  lastUpdated: ISO-8601 UTC string
}
```

### 2.4 Ticket detail

```text
{
  id: 1,
  ticketNumber: string,
  ticketDate: ISO-8601 UTC string,
  requester: { id: 1, name: string },
  category: { id: 1, name: string },
  relatedSystem: { id: 1, name: string },
  requestedPriority: LOW | MEDIUM | HIGH,
  summary: string,
  description: string,
  currentStatus: NEW,
  createdAt: ISO-8601 UTC string,
  lastUpdated: ISO-8601 UTC string,
  attachments: AttachmentMetadata[]
}
```

### 2.5 Attachment metadata

```text
{
  id: 1,
  displayName: string,
  mimeType: string,
  sizeBytes: integer,
  uploadedAt: ISO-8601 UTC string,
  removedAt: ISO-8601 UTC string | null,
  removalReason: string | null,
  isActive: boolean,
  downloadUrl: string | null
}
```

`downloadUrl` is non-null only for an active attachment. Removed metadata remains visible with `isActive: false` and a null download URL.

## 3. Endpoint index

| Method | Path | Context | Success |
| --- | --- | --- | --- |
| GET | `/api/categories` | None | `200` active Category list |
| GET | `/api/related-systems` | None | `200` active Related System list |
| GET | `/api/development-requesters` | None | `200` active Requester list |
| POST | `/api/tickets` | Required | `201` created Ticket; `200` idempotent replay |
| GET | `/api/tickets` | Required | `200` paginated owned Ticket list |
| GET | `/api/tickets/:ticketId` | Required | `200` owned Ticket detail |
| POST | `/api/tickets/:ticketId/attachments` | Required | `201` Attachment metadata |
| GET | `/api/tickets/:ticketId/attachments` | Required | `200` all Attachment metadata |
| GET | `/api/tickets/:ticketId/attachments/:attachmentId/download` | Required | `200` active file bytes |
| DELETE | `/api/tickets/:ticketId/attachments/:attachmentId` | Required | `204` soft removal |

## 4. Active reference data

### GET `/api/categories`

Returns active Categories as an array of `{ id, name }`, ordered by ascending ID to preserve the Lab 1 category response convention.

### GET `/api/related-systems`

Returns active Related Systems as an array of `{ id, name }`, ordered by ascending ID.

### GET `/api/development-requesters`

Returns active Development Requesters as an array of `{ id, name, email }`, ordered by ascending ID. Inactive Requesters are never returned.

### Reference-data failures

- `200`: list returned, including an empty array when no active records exist.
- `503 REFERENCE_DATA_UNAVAILABLE`: database or reference-store unavailable.
- `500 REFERENCE_DATA_FAILED`: safe unexpected failure.

## 5. Create Ticket

### POST `/api/tickets`

Required header: `X-Development-Requester-Id`.

Request body:

```text
{
  clientRequestId: UUID string,
  categoryId: positive integer,
  relatedSystemId: positive integer,
  requestedPriority: LOW | MEDIUM | HIGH,
  summary: string,
  description: string
}
```

The request does not accept `ticketNumber`, `ticketDate`, `currentStatus`, `requesterId`, or attachment bytes. These values are generated or derived by the server. Files are uploaded with the attachment endpoint after this request succeeds.

Validation:

- `clientRequestId` must be a UUID and is required.
- `categoryId` and `relatedSystemId` must refer to active records.
- `requestedPriority` must be one of `LOW`, `MEDIUM`, or `HIGH`.
- `summary` is trimmed and must contain 5-120 characters.
- `description` is trimmed and must contain 20-4000 characters.
- The requester context must be active.

Created response `201`: a complete Ticket Detail shape with an empty `attachments` array. The server generates a unique Ticket Number, Ticket Date, `NEW` status, and timestamps.

Idempotent replay response `200`: if the same active requester sends the same `clientRequestId` with an equivalent normalized payload, return the existing Ticket Detail and do not create another Ticket.

### Create Ticket errors

| Status | Code | Use |
| --- | --- | --- |
| `400` | `REQUESTER_CONTEXT_REQUIRED` | Header is absent. |
| `400` | `REQUESTER_CONTEXT_INVALID` | Header is malformed, unknown, or inactive. |
| `400` | `TICKET_INPUT_INVALID` | One or more body fields are invalid. |
| `404` | `CATEGORY_NOT_FOUND` / `RELATED_SYSTEM_NOT_FOUND` | Referenced record does not exist or is not active. |
| `409` | `IDEMPOTENCY_KEY_REUSED` | Same client request ID is paired with a different payload. |
| `500` | `TICKET_CREATE_FAILED` | Safe unexpected persistence failure. |

## 6. My Tickets

### GET `/api/tickets`

Required header: `X-Development-Requester-Id`.

Supported query parameters:

| Parameter | Values | Default | Meaning |
| --- | --- | --- | --- |
| `search` | trimmed string, max 120 characters | empty | Case-insensitive contains over Ticket Number and Summary. |
| `categoryId` | positive integer | omitted | Filter by Category. |
| `relatedSystemId` | positive integer | omitted | Filter by Related System. |
| `requestedPriority` | `LOW`, `MEDIUM`, `HIGH` | omitted | Filter by Requested Priority. |
| `currentStatus` | `NEW` | omitted | Filter by current status. |
| `sortBy` | `ticketDate`, `updatedAt`, `ticketNumber`, `summary` | `ticketDate` | Sort field. |
| `sortDirection` | `asc`, `desc` | `desc` | Sort direction. |
| `page` | positive integer | `1` | One-based page number. |
| `pageSize` | `10`, `20`, `50` | `10` | Items per page. |

Sorting is deterministic: the requested field and direction are applied first, then `id` descending as the tie-breaker. Search, filters, and pagination always apply within the selected Requester's ownership scope.

Response `200`:

```text
{ items: TicketSummary[], page: 1, pageSize: 10, totalItems: integer, totalPages: integer }
```

An empty owned list returns `items: []`, `totalItems: 0`, and `totalPages: 0` with `200`. A valid query with no matches returns the same shape and is distinguished in the UI by the presence of active query controls.

### My Tickets errors

- `400 REQUESTER_CONTEXT_REQUIRED` or `REQUESTER_CONTEXT_INVALID` for context failures.
- `400 TICKET_QUERY_INVALID` for invalid IDs, enum values, sort fields, page, page size, or search length.
- `500 TICKET_LIST_FAILED` for safe unexpected failure.

## 7. Owned Ticket Detail

### GET `/api/tickets/:ticketId`

Requires a positive integer `ticketId` path parameter and `X-Development-Requester-Id`. Return the complete Ticket Detail shape, including all attachment metadata.

A missing Ticket and a Ticket owned by another Requester both return `404 TICKET_NOT_FOUND`. The response must not reveal whether a Ticket exists for another Requester.

Errors:

- `400 REQUESTER_CONTEXT_REQUIRED` or `REQUESTER_CONTEXT_INVALID`.
- `400 TICKET_ID_INVALID`.
- `404 TICKET_NOT_FOUND`.
- `500 TICKET_DETAIL_FAILED`.

## 8. Attachment lifecycle

All attachment endpoints require a valid active requester context and an owned Ticket. Ownership is checked before the Attachment operation.

### POST `/api/tickets/:ticketId/attachments`

Request: `multipart/form-data` with exactly one `file` part. The original filename is accepted as display metadata only.

The server checks the extension and MIME category, size, active count, Ticket ownership, and storage-key safety. The permitted types are JPG, JPEG, PNG, WEBP, and PDF. Maximum size is 5 MB per file. Maximum active count is five.

Response `201`: one Attachment Metadata object with an active download URL.

Errors:

- `400 ATTACHMENT_FILE_REQUIRED` or `ATTACHMENT_UPLOAD_INVALID`.
- `404 TICKET_NOT_FOUND` for missing or cross-Requester Ticket.
- `409 ACTIVE_ATTACHMENT_LIMIT_REACHED` when five active attachments already exist.
- `413 ATTACHMENT_TOO_LARGE` when the file exceeds 5 MB.
- `415 ATTACHMENT_TYPE_NOT_ALLOWED` for unsupported type or MIME category.
- `503 ATTACHMENT_STORAGE_UNAVAILABLE` when the storage adapter cannot persist the file.
- `500 ATTACHMENT_UPLOAD_FAILED` for safe unexpected failure.

### GET `/api/tickets/:ticketId/attachments`

Returns all Attachment Metadata objects for the owned Ticket, including active and removed records. Active records are ordered by upload time ascending, followed by removed records in upload time ascending. Removed records have no download URL.

### GET `/api/tickets/:ticketId/attachments/:attachmentId/download`

Returns the active file bytes with the safe display filename in `Content-Disposition` and the stored MIME type in `Content-Type`. The storage key is never sent to the client.

- `404 TICKET_NOT_FOUND` for missing or cross-Requester Ticket.
- `404 ATTACHMENT_NOT_FOUND` for an unknown Attachment.
- `410 ATTACHMENT_REMOVED` for a soft-removed Attachment.
- `503 ATTACHMENT_STORAGE_UNAVAILABLE` when active content cannot be read.

### DELETE `/api/tickets/:ticketId/attachments/:attachmentId`

Request body:

```text
{ removalReason: string }
```

The client must obtain explicit confirmation before sending the request. The server trims the reason and requires 3-200 characters. The operation sets `removedAt` and `removalReason`; it does not delete the row or file metadata. A second removal of the same Attachment returns `409 ATTACHMENT_ALREADY_REMOVED`.

Response `204` has no body. Errors include `400 REMOVAL_REASON_INVALID`, `404 TICKET_NOT_FOUND` or `ATTACHMENT_NOT_FOUND`, `409 ATTACHMENT_ALREADY_REMOVED`, and `500 ATTACHMENT_REMOVE_FAILED`.

## 9. Validation and ownership matrix

| Operation | Context | Resource validation | Ownership behavior |
| --- | --- | --- | --- |
| Create Ticket | Active requester required | Active Category and Related System; body rules | New Ticket is assigned to header context. |
| List Tickets | Active requester required | Query contract | Query is always filtered by header context. |
| Ticket Detail | Active requester required | Positive Ticket ID | Missing and cross-owner Ticket both return `404`. |
| Upload | Active requester required | Owned Ticket; file rules | Cross-owner Ticket returns `404`; no storage write occurs. |
| Metadata | Active requester required | Owned Ticket | Cross-owner Ticket returns `404`. |
| Download | Active requester required | Owned Ticket and Attachment | Removed file returns `410`; cross-owner resource returns `404`. |
| Soft removal | Active requester required | Owned Ticket and active Attachment; reason rules | Cross-owner resource returns `404`; removed record remains. |

## 10. Test and traceability references

The API contract is planned against these paths:

- `server/tests/lab-02/create-ticket.api.test.ts`
- `server/tests/lab-02/my-tickets.api.test.ts`
- `server/tests/lab-02/ticket-detail.api.test.ts`
- `server/tests/lab-02/attachments.api.test.ts`
- `server/tests/lab-02/ticket-number.unit.test.ts`

Every status, validation rule, ownership response, query parameter, and attachment rule is mapped to an AC and planned test in `tests.md`.
