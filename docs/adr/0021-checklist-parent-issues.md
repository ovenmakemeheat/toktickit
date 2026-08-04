# ADR 0021: Structure Lab 1 work as checklist-driven parent Issues

- Status: Accepted
- Date: 2026-08-04

## Context

The four required Issues are the visible units of delivery, but each one spans implementation, tests, documentation, review, and evidence. A short Issue title alone would hide the engineering contract and make progress difficult to audit.

## Decision

Create each required GitHub Issue as a checklist-driven parent Issue containing:

- a concise goal and stakeholder context;
- the required feature branch and PR target;
- dependencies and notes/constraints;
- explicit, testable acceptance criteria;
- links or references to its GitHub sub-issues;
- a Definition of Done checklist;
- evidence expectations.

Break the work down using native GitHub sub-issues. Sub-issues must be small enough to track independently and remain connected to their parent Issue; they do not replace the parent acceptance criteria or PR review requirement.

The reusable sub-issue categories and feature-specific breakdown are decided separately.

## Consequences

- Every Issue is actionable before implementation begins.
- Board state can show both parent delivery and detailed work.
- Acceptance criteria remain visible at the parent level while execution details live in sub-issues.
- The final submission can show a clear relationship between requirements, work items, and evidence.
