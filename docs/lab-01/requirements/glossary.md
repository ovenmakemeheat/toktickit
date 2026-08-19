# TokTickIT glossary

Initial terms confirmed while grilling the Lab 1 design.

| Term | Meaning in this project |
| --- | --- |
| Lab 1 | The first individual sprint: prove the client, API, database, tests, and Git workflow as one working vertical slice. |
| Vertical slice | A thin feature that crosses the client, server/API, and database layers so the integrated stack is demonstrated. |
| Engineering contract | The product specification plus the evidence needed to prove that it is complete. |
| Category | A seeded IT request category. Lab 1 requires Account and Access, Hardware, Software, and Network. |
| Health check | `GET /api/health`, which reports that the TokTickIT API is available. |
| Staging branch | `lab1-staging`, the integration branch where feature branches are reviewed and tested before merging to `main`. |
| Feature branch | A short-lived branch for one required Lab 1 Issue. |
| Bun monorepo | The single repository managed by Bun, containing the `client/` and `server/` workspaces. |
| Workspace | One independently runnable project area inside the monorepo; Lab 1 has a client workspace and a server workspace. |
| Compose database | The local PostgreSQL service started from `server/docker-compose.yml`. |
| Migration | A versioned Prisma change that creates or alters database tables. |
| Seed | Repeatable code that inserts the four required request categories without duplicates. |
| Error envelope | The JSON shape `{ error: { code, message } }` used for API failures. |
| Liveness | Whether the Express API process can answer a health request. |
| Readiness | Whether the API's required dependencies, such as PostgreSQL, are available. |
| Idempotent | Safe to run repeatedly without creating an additional effect; the category seed must not create duplicates. |
| Check System | The Lab 1 button that calls both required API endpoints and displays their result. |
| Request state | The explicit client state for idle, loading, success, or error during a system check. |
| Test seam | The boundary at which a test interacts with the system; Lab 1 uses the Express app for API tests and `fetch` for UI tests. |
| Supertest | The library used to send assertions against the Express app without starting a real listener. |
| Test database | The isolated `toktickit_test` PostgreSQL database used by API tests. |
| Service layer | The application layer that implements a use case between HTTP routes and persistence. |
| Data access | The code that reads or writes persistent data through Prisma. |
| DTO | A small data-transfer shape crossing an API boundary; Lab 1 has health and category response DTOs. |
| API client | The client-side module that calls the server endpoints and translates HTTP responses into UI data or errors. |
| Dev proxy | Vite's local forwarding of `/api` browser requests to the Express server. |
| Requirements-first UI | The rule that Lab 1 UI behavior follows the requirement PDFs and does not invent later-lab screens. |
| Root script | A Bun command exposed at the repository root to coordinate the client, server, database, or tests. |
| Formatter | A development tool that applies the repository's consistent source layout; Lab 1 uses Biome. |
| Linter | A development tool that reports source-code problems without replacing TypeScript checks or tests; Lab 1 uses Biome. |
| Lefthook | The repository-managed Git hook runner used to check staged source files before a commit. |
| Pre-commit hook | An automated check that runs before a commit is created; this repository runs Biome through Lefthook. |
| Prisma validation | A non-mutating check that confirms the Prisma schema is valid before migrations or application builds. |
| Verification workflow | The root `bun run verify` gate that combines repository checks, Prisma validation, type checks, tests, and builds. |
| Local topology | The Lab 1 development arrangement: Vite client, Express API, and PostgreSQL running as separate processes/services. |
| T3 Env | The typed environment-validation boundary used by the server to parse configuration safely. |
| System-check screen | The single Lab 1 client screen that demonstrates API liveness and database-backed categories. |
| Live region | An accessible UI region that announces dynamic loading, status, or error changes to assistive technology. |
| Test traceability | The mapping from a requirement/test ID to its source file, command, and evidence. |
| PR target | The branch a Pull Request is intended to merge into; feature PRs target `lab1-staging`. |
| Release PR | The single final Pull Request from `lab1-staging` to `main`. |
| Review evidence | The reviewer identity, approval, comment, and author response recorded to prove peer review occurred. |
| Definition of Done | The complete checklist for finished work: implementation, tests, documentation/evidence, review approval, and the required merge. |
| Parent Issue | One of the four required Lab 1 delivery Issues that owns acceptance criteria and sub-issues. |
| Sub-issue | A native GitHub child Issue used to track one bounded piece of a parent Issue. |
| Issue checklist | A compact set of checkable work, acceptance, evidence, and completion items attached to an Issue. |
| Issue template | A reusable Markdown starting point that keeps GitHub Issues structurally consistent. |
| Evidence document | A concise Lab 1 file that records proof or reflection for the final submission. |
| AI-use reflection | The student's concise record of the AI tool, selected prompts, and lessons learned. |
| Submission source | The LaTeX document from which the single final Lab 1 PDF is built. |
| Evidence slice | The smallest representative set of artifacts that proves a requirement clearly. |
| Visual QA loop | The human-in-the-loop cycle of compiling, rendering, inspecting, and revising the PDF. |
| Intentional whitespace | Deliberate page space that improves readability without hiding missing content or wasting report length. |
