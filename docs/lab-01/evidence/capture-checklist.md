# Lab 1 app evidence capture

These captures are the human-in-the-loop evidence for the App Demo section of the LaTeX report.

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
