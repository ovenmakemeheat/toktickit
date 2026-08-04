# ADR 0022: Use compact, checklist-driven Issue formatting

- Status: Accepted
- Date: 2026-08-04

## Decision

Keep parent Issues and sub-issues concise and scannable:

- use short headings and checklists instead of long prose;
- put branch, dependency, and implementation notes near the top;
- keep acceptance criteria observable and testable;
- link child sub-issues from the parent;
- keep review, merge, and final Definition of Done checks on the parent.

Each parent Issue has standard child categories for Implementation, Tests, and Documentation/Evidence, with feature-specific children added only when useful.

## Consequences

- Students can understand the work quickly before moving an Issue to `Specified`.
- The board and Issue pages remain readable during review.
- Checklists provide visible progress without duplicating the full requirements document.
