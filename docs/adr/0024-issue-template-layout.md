# ADR 0024: Use a fixed compact layout for Issue templates

- Status: Accepted
- Date: 2026-08-04

## Decision

The parent-Issue template uses this order:

1. Goal
2. Branch / PR
3. Dependencies
4. Acceptance Criteria
5. Sub-issues
6. Notes
7. Definition of Done

The sub-issue template uses this order:

1. Parent
2. Scope
3. Checklist
4. Acceptance Criteria
5. Evidence

All sections remain short and checklist-oriented.

## Consequences

- Issue pages have a predictable reading order.
- Required delivery information is visible without a long narrative.
- Feature-specific detail belongs in the relevant child Issue instead of bloating every parent template.
