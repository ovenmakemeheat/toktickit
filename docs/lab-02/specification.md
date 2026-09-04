# Lab 2 engineering specification

Status: implementation contract completed; Lab 2 released to `main`; final evidence review pending (2026-09-04)

Origin issue: #51 - Lab 2 - Sprint specification and test plan
Applies to: Issues #51-#57 and the integrated Lab 2 result

Source: [Lab 2 requirements](requirements/UTF-8_Lab_02_labsheet-1.pdf)

This document is the implementation contract for the Lab 2 requester-facing increment. It is intentionally narrower than the full stakeholder handout. It was established before product implementation and remains the source of truth for the integrated Lab 2 result.

## Current Lab 2 state

As of 2026-09-04, Issues #51-#57 are closed and their feature Pull Requests #58-#64 are merged into `lab2-staging`. Follow-up Issue #68 and PR #69 isolate the shared test fixtures, and release PR #70 merged the integrated result into final `main` at `538b5da`. The implementation, tests, and visual artifacts described here are present on that released baseline. Human review evidence is consolidated in `reviewer.md`; it must not be inferred from automated review output.

## 1. Sprint goal

Deliver a responsive requester-facing TokTickIT MVP in which a selected Development Requester can create an IT support ticket, receive a backend-generated Ticket Number, find only their own tickets, inspect ticket detail, and manage permitted attachments. The selector is a temporary testing context; it is not authentication.

## 2. Stakeholder request

The IT department needs a professional Zen Green experience for describing a problem, classifying it by Category and Related System, choosing a Requested Priority, attaching evidence, and submitting the request. The requester must then be able to find, search, filter, sort, paginate, and open their own tickets. Ticket detail must expose read-only ticket information and the permitted attachment lifecycle.

The Lab 2 implementation uses seeded Development Requesters to simulate different users before Lab 3 introduces authentication. The selected requester is sent as an explicit test context and is used for ownership filtering. It must never be presented as secure identity or role-based authorization.

## 3. Scope

### Included

- Development Requester Selection as a temporary testing context.
- A reusable application shell with TokTickIT identity, current requester, My Tickets, Create Ticket, and Change Requester navigation.
- Active Category, Related System, and Development Requester reference data.
- Create Ticket with required fields, backend-generated Ticket Number, initial `NEW` status, validation, and separate attachment upload.
- My Tickets with requester ownership, search, filtering, sorting, pagination, and loading, empty, no-results, and failure states.
- Requester Ticket Detail with read-only ticket fields and requester-owned attachment operations.
- Attachment metadata, upload, active download, and soft removal.
- Zen Green tokens, reusable form/list/badge/state conventions, responsive layouts, keyboard access, and visual inspection.
- Unit, API/integration, UI, style/responsive, visual, and E2E evidence.

### Explicitly excluded

- Authentication, login, logout, passwords, password hashing, sessions, tokens, authenticated identities, and real role-based authorization.
- IT Staff dashboards or queues, ticket claiming, reassignment, IT Priority, and other staff-owner functions.
- Public Comments, Internal Notes, Actions Taken, event logs, and work tracking.
- Status changes after the initial `NEW` status, including resolving, closing, reopening, cancelling, or resolution confirmation.
- Administrator management of users, Requesters, roles, Categories, or Related Systems.
- Lab 3 identity integration. Lab 2 only leaves a documented seam for replacing the test context later.

## 4. Functional requirements

| ID | Requirement |
| --- | --- |
| FR-01 | The application presents a Development Requester Selection screen before requester-specific screens can be used. |
| FR-02 | The selector loads active Development Requesters from PostgreSQL and excludes inactive Requesters. |
| FR-03 | After selection, the shell displays the current Requester and provides a Change Requester action. |
| FR-04 | Switching Requester reloads requester-specific data and prevents stale tickets or detail data from remaining visible. |
| FR-05 | The shell provides My Tickets and Create Ticket navigation with a clear active-page indication. |
| FR-06 | Create Ticket captures Category, Related System, Requested Priority, Summary, Description, and optional Attachments. |
| FR-07 | The server validates a ticket request, generates the official Ticket Number and Ticket Date, saves the ticket, and starts it with status `NEW`. |
| FR-08 | Create Ticket can upload permitted files after ticket creation and reports partial success if an upload fails. |
| FR-09 | My Tickets retrieves only tickets owned by the selected Requester and supports documented search, filters, sorting, and pagination. |
| FR-10 | My Tickets distinguishes an empty owned list from a no-results query and exposes recoverable loading and failure states. |
| FR-11 | Ticket Detail retrieves one ticket only when it belongs to the selected Requester and renders its ticket fields read-only. |
| FR-12 | Ticket Detail lists attachment metadata, including metadata for soft-removed files, without exposing removed file content. |
| FR-13 | A selected Requester can upload permitted attachments to an owned ticket. |
| FR-14 | A selected Requester can download an active attachment from an owned ticket. |
| FR-15 | A selected Requester can soft-remove an owned attachment after the required confirmation and removal reason. |
| FR-16 | The API rejects missing, inactive, or unknown requester context for requester-scoped operations. |
| FR-17 | The API returns safe, documented errors for validation, ownership, missing resources, attachment constraints, conflicts, and unexpected failures. |
| FR-18 | The UI uses the Zen Green specification and remains usable at desktop, tablet, and mobile sizes without horizontal scrolling. |
| FR-19 | Required fields, validation messages, focus indicators, labels, disabled states, and icon labels are accessible at the user-observable boundary. |

## 5. Business rules

| ID | Rule |
| --- | --- |
| BR-01 | The official Ticket Number is generated by the backend, is never accepted from the client, and is unique in the database. The format is `TT-YYYYMMDD-XXXXXX`, where the suffix is uppercase alphanumeric. |
| BR-02 | Every new Ticket starts with current status `NEW`. Lab 2 does not expose a status-transition operation. |
| BR-03 | The Development Requester selector is a testing mechanism, not authentication and not authorization. Its identifier is sent in `X-Development-Requester-Id`. |
| BR-04 | Only Requesters with `active = true` are returned by the selector and accepted as new requester context. |
| BR-05 | A requester context is required for Create Ticket, My Tickets, Ticket Detail, and all attachment operations. |
| BR-06 | Requester switching clears the previous route-specific data before loading data for the new Requester. |
| BR-07 | A ticket belongs to exactly one Development Requester. Every ticket and attachment read or mutation is scoped to the selected Requester. |
| BR-08 | A ticket requires an active Category, an active Related System, a Requested Priority, a non-empty Summary, and a non-empty Description. |
| BR-09 | Client text is trimmed before validation and persistence. Summary length is 5-120 characters inclusive; Description length is 20-4000 characters inclusive. |
| BR-10 | Requested Priority accepts only `LOW`, `MEDIUM`, or `HIGH`. The API rejects all other values. |
| BR-11 | Ticket Date is generated from the server clock and returned as an ISO 8601 UTC timestamp. The client cannot edit it. |
| BR-12 | `clientRequestId` is a required UUID generated for one user submission intent. It is unique for a Ticket. A retry with the same key and equivalent payload returns the existing Ticket; reuse with a different payload returns a conflict. |
| BR-13 | The Create button is disabled while the create request is pending, and the backend idempotency rule remains the authoritative duplicate protection. |
| BR-14 | Ticket-list `search` is a case-insensitive contains search over Ticket Number and Summary after trimming. |
| BR-15 | Ticket-list filters are Category, Related System, Requested Priority, and Current Status. Filter values must be valid IDs or enum values. |
| BR-16 | Ticket-list sorting permits `ticketDate`, `updatedAt`, `ticketNumber`, or `summary`. The default is `ticketDate` descending with `id` descending as the tie-breaker. |
| BR-17 | Ticket-list pages are one-based. The default page size is 10; permitted page sizes are 10, 20, and 50. Invalid page or page-size values return `400`. |
| BR-18 | Allowed attachment types are JPG, JPEG, PNG, WEBP, and PDF. Type validation checks the file extension and server-validated MIME category. |
| BR-19 | Each attachment is at most 5 MB. A Ticket can have at most five active attachments; soft-removed attachments do not count toward the active limit. |
| BR-20 | The original filename is display metadata only. Storage uses a generated non-user-controlled key; path separators and unsafe filename characters are not used as storage paths. |
| BR-21 | Attachment upload is separate from Ticket creation. A created Ticket remains saved if one or more uploads fail; the UI reports the partial failure and offers retry. |
| BR-22 | Attachment metadata includes active and removed records. A removed file has `removedAt` and `removalReason`, remains visible as metadata, and cannot be downloaded or previewed. |
| BR-23 | Only the selected Requester who owns the Ticket can upload, download, or remove its Attachments. Cross-Requester Ticket and Attachment access is returned as a non-disclosing `404`. |
| BR-24 | Removing an Attachment requires a user confirmation step and a trimmed removal reason between 3 and 200 characters. |
| BR-25 | No Lab 2 API or UI operation claims to authenticate a person. Lab 3 may replace the requester-context header with real identity without changing the ownership contract. |
| BR-26 | Empty, no-results, loading, API-failure, validation, upload, removal, and responsive states are explicit states rather than silent blank screens. |

## 6. UI specification summary

The complete visual contract is in `ui-spec.md`. The application has five user-visible areas: Requester Selection, the shared shell, Create Ticket, My Tickets, and Requester Ticket Detail. Create Ticket uses a read-only requester context, active reference selectors, required Summary and Description fields, Requested Priority, and attachment selection. My Tickets uses search, filters, sorting, pagination, a Create Ticket action, and a table/card representation. Ticket Detail renders ticket values read-only and separates attachment actions from ticket information.

All screens use the Zen Green tokens, consistent labels, field heights, validation placement, focus indicators, visible button text, and explicit state messaging. Desktop uses a centered multi-column layout at 992px or wider; tablet uses practical two-column layout at 768-991px; mobile stacks fields and avoids horizontal scrolling below 768px.

## 7. Data changes

### Models

| Model | Lab 2 design |
| --- | --- |
| `Category` | Extend the existing model with `active Boolean @default(true)`. Keep `name` unique. Existing Lab 1 category names remain valid and the reference endpoint returns active rows only. |
| `RelatedSystem` | `id`, unique `name`, `active`, `createdAt`, and `updatedAt`. Seed at least six realistic systems. |
| `DevelopmentRequester` | `id`, `name`, unique `email`, `active`, `createdAt`, and `updatedAt`. Seed at least four active and one inactive Requester. |
| `Ticket` | `id`, unique `ticketNumber`, unique `clientRequestId`, `ticketDate`, `requesterId`, `categoryId`, `relatedSystemId`, `requestedPriority`, `summary`, `description`, `currentStatus`, `createdAt`, and `updatedAt`. |
| `Attachment` | `id`, `ticketId`, generated `storageKey`, safe `displayName`, `mimeType`, `sizeBytes`, `uploadedAt`, nullable `removedAt`, and nullable `removalReason`. |

`RequestedPriority` is the Prisma enum `LOW | MEDIUM | HIGH`. `TicketStatus` is the Prisma enum `NEW` for Lab 2. The API uses the same uppercase enum values and the UI supplies human-readable labels.

### Relationships and constraints

- One Development Requester owns many Tickets; each Ticket has one Requester.
- One Ticket has many Attachments; each Attachment belongs to one Ticket.
- One Category and one Related System can be used by many Tickets.
- Foreign keys are required for Ticket to Requester, Category, and Related System, and Attachment to Ticket.
- Unique constraints apply to Category name, Related System name, Development Requester email, Ticket Number, and client request ID.
- Index `Ticket(requesterId, ticketDate, id)` for owned list ordering.
- Index `Ticket(requesterId, updatedAt, id)` for alternate ordering.
- Index `Ticket(categoryId)`, `Ticket(relatedSystemId)`, and `Ticket(requestedPriority)` for supported filters.
- Index `Attachment(ticketId, removedAt)` for active-count and metadata queries.
- Soft removal is represented by nullable `removedAt`; attachment rows are never deleted by the Lab 2 remove operation.
- The migration must preserve existing Category rows and mark them active.

### Seed data

The seed is repeat-safe and uses stable unique keys. It includes these Categories: Account and Access, Hardware, Software, and Network. It includes at least these Related Systems: Email, Campus Wi-Fi, VPN, LEB2 App, Grade Submission App, Printer, and Corporate Laptop. It includes at least four active Development Requesters and one inactive Requester using `.test` email addresses. The inactive Requester never appears in the selector.

## 8. API contract summary

The detailed endpoint contract, headers, query parameters, request/response shapes, errors, and status codes are in `api-spec.md`. The API is served under `/api` and remains importable through `server/src/app.ts`; listener startup stays in `server/src/index.ts`.

| Capability | Route family |
| --- | --- |
| Active Categories | `GET /api/categories` |
| Active Related Systems | `GET /api/related-systems` |
| Active Development Requesters | `GET /api/development-requesters` |
| Ticket creation | `POST /api/tickets` |
| Owned ticket list | `GET /api/tickets` |
| Owned ticket detail | `GET /api/tickets/:ticketId` |
| Attachment upload | `POST /api/tickets/:ticketId/attachments` |
| Attachment metadata | `GET /api/tickets/:ticketId/attachments` |
| Active attachment download | `GET /api/tickets/:ticketId/attachments/:attachmentId/download` |
| Attachment soft removal | `DELETE /api/tickets/:ticketId/attachments/:attachmentId` |

## 9. Acceptance criteria

| ID | Given / When / Then |
| --- | --- |
| AC-01 | Given the app has no selected Requester, when a requester-specific page is opened, then Requester Selection is shown and no requester data is requested. |
| AC-02 | Given active and inactive seeded Requesters, when the selector loads, then only active Requesters are listed and the loading, empty, failure, and keyboard-accessible states are usable. |
| AC-03 | Given Requester A is selected, when the user changes to Requester B, then the shell shows B and requester-specific list/detail data reloads without A data remaining visible. |
| AC-04 | Given active Categories and Related Systems exist, when Create Ticket loads, then the controls show only active reference data and expose failures safely. |
| AC-05 | Given valid ticket fields and a selected Requester, when the user submits once, then the API returns `201`, exactly one Ticket is saved, a unique Ticket Number is returned, and status is `NEW`. |
| AC-06 | Given a missing or invalid required field, when the user submits, then a field-level message is shown and the create API is not called. |
| AC-07 | Given invalid API input, inactive references, an invalid priority, or invalid text length, when the API receives it, then it returns documented `400` validation details and saves no Ticket. |
| AC-08 | Given a repeated create request with the same client request ID and equivalent payload, when the request is retried, then the existing Ticket is returned without a duplicate. |
| AC-09 | Given a created Ticket and permitted files, when the upload succeeds, then active attachment metadata is available and the Ticket remains accessible. |
| AC-10 | Given one upload fails after Ticket creation, when the UI receives the failure, then the Ticket Number remains visible, the partial failure is clear, and retry is available. |
| AC-11 | Given Requester A and B own different Tickets, when A loads My Tickets, then only A Tickets are returned. |
| AC-12 | Given owned Tickets, when search, filters, sorting, and valid page parameters are used, then the result and metadata follow `api-spec.md` deterministically. |
| AC-13 | Given no owned Tickets or a query with no matches, when My Tickets loads, then empty-list and no-results states are distinct and recoverable. |
| AC-14 | Given a selected Requester, when My Tickets loads or fails, then loading and API-failure states are explicit and do not show stale data as current. |
| AC-15 | Given an owned Ticket, when its detail is opened, then the Ticket fields are displayed read-only and attachment controls are visually separate. |
| AC-16 | Given a Ticket owned by another Requester, when it is requested with the current context, then no Ticket data is returned and the API responds with non-disclosing `404`. |
| AC-17 | Given active and removed Attachments, when detail metadata loads, then both metadata records are shown with their state and removed content is not previewable. |
| AC-18 | Given an unsupported, oversized, or sixth active Attachment, when upload is attempted, then the client and API reject it with the documented error and no invalid active row is created. |
| AC-19 | Given an active owned Attachment, when download is requested, then the file is returned with safe content headers. |
| AC-20 | Given an owned active Attachment, when a valid removal confirmation and reason are submitted, then it is soft-removed, remains as metadata, and cannot be downloaded or previewed. |
| AC-21 | Given an Attachment on another Requester's Ticket or a removed Attachment, when mutation or download is attempted, then the operation is rejected safely. |
| AC-22 | Given the required screens, when viewed at desktop, tablet, and mobile widths, then there is no clipping, overlap, hidden control, or horizontal scrolling. |
| AC-23 | Given keyboard and assistive-technology use, when the required screens are operated, then labels, required indicators, focus, button names, live states, and icon labels are available. |
| AC-24 | Given server validation, missing-resource, ownership, upload, conflict, or unexpected failure, when the API responds, then the body is documented and contains no stack trace or storage path. |

Every criterion maps to at least one planned test in `tests.md`.

## 10. Definition of Done

The checkboxes below distinguish completed Lab 2 implementation work from the
remaining final-submission review gate. The implementation release is present
on `main` at `538b5da`.

- [ ] This specification and the companion test, UI, and API contracts have complete human approval evidence recorded for the final submission.
- [x] Every FR, BR, and AC has a stable identifier and a planned test path.
- [x] The integrated implementation stays within the included scope and does not add authentication, IT Staff workflow, collaboration, or later status transitions.
- [x] Unit, API/integration, client UI, style/responsive, visual, and E2E tests are implemented from the plan; the recorded required tests are not skipped, disabled, or flaky.
- [x] `bun run verify` passes on the final-main-aligned `docs/lab2-docs` baseline at `538b5da`.
- [ ] Desktop, tablet, and mobile screenshots and the visual checklist have complete human review evidence against `ui-spec.md`.
- [ ] Every feature Pull Request has complete human approval evidence, an Issue link, answered review comments, and a reviewer merge into `lab2-staging` recorded in `reviewer.md`.
- [x] The integrated Lab 2 test run on `lab2-staging` passes before the release Pull Request to `main`, and release PR #70 is merged.
- [ ] `reviewer.md`, `ai-use.md`, final evidence, and the required submission material are complete.

## 11. Assumptions and decisions

- The temporary requester context uses the `X-Development-Requester-Id` header because it keeps ownership scoping consistent across create, list, detail, and attachment operations while making the lack of authentication explicit.
- Ticket creation and file upload are separate API operations so a failed file transfer cannot silently roll back a successfully created Ticket.
- `clientRequestId` provides durable duplicate protection in addition to the disabled busy Submit button.
- Search is limited to Ticket Number and Summary to keep the query predictable and fast; Category, Related System, Priority, and Status are filters.
- The default list page size is 10 and the default sort is newest Ticket Date first, with deterministic ID tie-breaking.
- A removal reason is required because the handout requires the removal-reason behavior to be defined; the UI must confirm before calling the API.
- Local development may use a storage adapter under an ignored directory, but the database stores only generated keys and safe metadata. The adapter boundary must remain replaceable for object storage later.
- The API returns uppercase enum values; the UI maps them to readable labels such as `New`, `Low`, `Medium`, and `High`.
- `updatedAt` changes for Ticket field updates and attachment lifecycle changes that affect the Ticket detail; the Ticket list exposes it as `lastUpdated`.
