# Lab 1 app evidence capture

These captures are the human-in-the-loop evidence for the Git workflow and App Demo sections of the LaTeX report.

## Part 1 repository workflow captures

The GitHub captures were taken with browser-use CLI from the `lab1-staging` repository state.

### Project board

Verify that the board shows all six workflow columns, the four parent Lab 1 issues, their sub-issue progress, and the current workflow status.

Save the readable board capture as `docs/lab-01/evidence/board.png`.

### Commit and merge history

Verify that the `lab1-staging` history shows the foundation merge for PR #44 and focused issue-referenced commits for the Lab 1 work.

Save the history capture as `docs/lab-01/evidence/commit-history.png`.

Capture the current `main` history separately. It must show the staging-to-main integration when a human completes that merge.

Save the main-branch capture as `docs/lab-01/evidence/main-history.png`.

### Directory structure

Verify that the repository tree shows the required `client/`, `server/`, `docs/`, `AGENTS.md`, and root tooling files.

Save the readable tree capture as `docs/lab-01/evidence/directory-structure.png`.

Save the nested documentation tree as `docs/lab-01/evidence/docs-lab1-structure.png` and the server test tree as `docs/lab-01/evidence/server-tests-structure.png`.

### Terminal test output

Verify that the captured terminal output shows the client suite passing 3 tests and the server suite passing 6 tests.

Save the terminal capture as `docs/lab-01/evidence/test-capture.png`.

### Part 1 human QA

- [x] The board capture shows all workflow columns and the four parent issue cards.
- [x] The commit history capture shows both a merge commit and focused issue-referenced commits.
- [x] The main-branch history is captured; it currently shows that staging has not yet been merged into `main`.
- [x] The directory capture keeps the repository folders and root tooling readable.
- [x] The nested captures show `docs/lab-01/` and `server/tests/lab-01/` contents.
- [x] The terminal capture shows all client and server tests passing.

### Submission blockers requiring human action

- [ ] Merge `lab1-staging` into `main` and recapture the final main history.
- [ ] Complete reciprocal peer review for the student’s partner repository and record the comment and response.

## Preconditions

1. Copy `server/.env.example` to `server/.env`.
2. Start PostgreSQL, apply the migration, and seed the categories.
3. Start the application with `bun dev`.
4. Open `http://localhost:5173` in a browser.

## Captures

### Loading

Click `Check System` and capture the page while the button reads `Checking...` and the status reads `Checking...`. Use browser network throttling or a paused request so the state is visible without changing production code.

Save the readable page capture as `docs/lab-01/evidence/loading.png`.

### Success

After the request completes, verify the page contains the TokTickIT heading, `System Status: Online`, and all four database-backed categories in order.

Save the readable page capture as `docs/lab-01/evidence/success.png`.

### Failure

Make the API unavailable without changing the application code, click `Check System`, and verify `System Status: Offline` and `Unable to connect to TokTickIT API`. Confirm stale categories are absent.

Save the readable page capture as `docs/lab-01/evidence/failure.png`.

## Human QA

- [x] The full app card and state text are visible in every capture.
- [x] No text, button, list item, or caption is clipped.
- [x] The success capture shows all four categories in order.
- [x] The failure capture shows the user-safe error and no stale list.
- [x] The loading capture shows the transient state rather than a completed request.
