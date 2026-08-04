# ADR 0012: Make the root Bun workspace the Lab 1 command surface

- Status: Accepted
- Date: 2026-08-04

## Context

The repository has two application workspaces and a Compose database. Students and reviewers need one clear setup path that can be repeated without remembering workspace-specific commands.

## Decision

Expose documented root Bun scripts for:

- starting the client and server development processes together;
- starting and stopping the Compose database;
- applying development migrations;
- seeding development categories;
- creating/preparing the isolated API test database;
- running the complete client and server test suite;
- running verification checks such as type checking and linting where configured.

The README is the operational contract for the exact command order and expected evidence.

## Consequences

- A reviewer can follow one root workflow from a clean checkout.
- Workspace-specific commands remain available for focused debugging.
- The root scripts must fail clearly when Docker, Bun, or environment configuration is missing.
