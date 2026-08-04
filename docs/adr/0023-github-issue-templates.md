# ADR 0023: Enforce Issue structure with GitHub Markdown templates

- Status: Accepted
- Date: 2026-08-04

## Decision

Add reusable Markdown templates under `.github/ISSUE_TEMPLATE/`:

- a parent-Issue template for one of the four Lab 1 delivery Issues;
- a sub-issue template for one bounded implementation, test, or documentation/evidence task.

Templates must remain compact, checklist-driven, and link child work to its parent. They are a consistency aid; they do not replace the Lab 1 requirements or parent-level acceptance criteria.

## Consequences

- New Issues start with the required metadata and checklists.
- Reviewers can find branch, dependency, acceptance, notes, sub-issues, and completion information in predictable locations.
- The repository itself documents the intended GitHub workflow for future contributors.
