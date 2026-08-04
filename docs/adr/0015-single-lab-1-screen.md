# ADR 0015: Keep the Lab 1 client to one system-check screen

- Status: Accepted
- Date: 2026-08-04

## Context

The final TokTickIT product will eventually contain dashboards, ticket details, and administration screens. Lab 1 only asks the stakeholder to prove that the technology stack works by checking API status and displaying database-backed categories.

## Decision

Implement one responsive Bootstrap screen with:

- the heading `TokTickIT IT Service Desk`;
- a `Check System` button;
- a visible loading state while both requests are pending;
- `System Status: Online` and the returned supported categories on success;
- `System Status: Offline` and `Unable to connect to TokTickIT API` on failure.

Do not add routing, authentication, ticket creation, ticket detail screens, or later-lab role features.

## Consequences

- The demo directly maps to the stakeholder request and the App Demo rubric.
- UI-01 through UI-03 can focus on one observable state machine.
- Later-lab screens can be added without pretending they are part of the Lab 1 contract.
