# ADR 0027: Build the single submission PDF from LaTeX

- Status: Accepted
- Date: 2026-08-04

## Decision

Maintain one concise LaTeX source for the Lab 1 submission PDF. It must preserve the required four-part structure:

1. Git use with engineering workflow
2. Tests
3. AI use and reflection
4. App demo

The source will include readable screenshots, copied test output, links/identifiers needed for grading, and concise captions. The generated PDF is the single submission artifact; intermediate source/build files are not submitted as additional PDFs.

The compilation engine and exact output location are decided separately.

## Consequences

- Submission formatting is repeatable and reviewable as source.
- Evidence can be arranged consistently instead of assembled manually.
- The build process must be documented and the final PDF visually checked.
