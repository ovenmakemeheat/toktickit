# ADR 0005: Seed categories by unique name and return them in ID order

- Status: Accepted
- Date: 2026-08-04

## Context

Lab 1 requires exactly four starter categories, a unique `name`, an autoincrementing `id`, and a seed that is safe to run repeatedly. The category API must return a predictable order and the client must display database data rather than hard-coded values.

## Decision

Keep the required Prisma model shape:

- `id Int @id @default(autoincrement())`
- `name String @unique`
- `createdAt DateTime @default(now())`

Seed the categories in this fixed order:

1. Account and Access
2. Hardware
3. Software
4. Network

Use an upsert keyed by `name` for each value, with no destructive update on an existing row. The API queries categories with ascending `id` order and returns only `id` and `name`.

## Consequences

- Re-running the seed does not create duplicates.
- A fresh database produces the required IDs 1–4 and order.
- Existing databases preserve their category IDs; predictable order is based on stored IDs.
- The client remains data-driven and cannot accidentally pass the UI test with hard-coded category names.
