import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ActionsTakenPanel from "../../src/lab-04/ActionsTakenPanel";
import type { ActionTakenEntry } from "../../src/lib/api";
import { response } from "../lab-03/test-helpers";

const action: ActionTakenEntry = {
  id: 701,
  ticketId: 101,
  actionAt: "2026-10-07T13:30:00.000Z",
  actionDescription: "Reset the account lock.",
  result: "The Requester can sign in.",
  performedBy: { id: 21, name: "IT Staff A", role: "IT_STAFF" },
  followUpRequired: true,
  followUpNote: "Confirm access after class.",
  attachmentNotes: "See the existing login-error.png attachment.",
  createdAt: "2026-10-07T13:31:00.000Z",
  updatedAt: "2026-10-07T13:31:00.000Z",
  updatedBy: null,
  version: 1,
};

function installFetch(
  handler: (url: string, init?: RequestInit) => ReturnType<typeof response>,
) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(String(input), init)),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Actions Taken panel", () => {
  it("shows a safe loading failure and retries the history request", async () => {
    let requestCount = 0;
    installFetch((url) => {
      if (url === "/api/tickets/101/actions-taken") {
        requestCount += 1;
        return requestCount === 1
          ? response(
              {
                error: {
                  code: "ACTION_TAKEN_LIST_FAILED",
                  message: "Internal error",
                },
              },
              false,
              500,
            )
          : response({ items: [] });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();
    render(<ActionsTakenPanel ticketId={101} canEdit={false} />);

    expect(
      await screen.findByText("Unable to connect to TokTickIT API"),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Retry Actions Taken" }),
    );
    expect(
      await screen.findByText(
        "No Actions Taken have been recorded for this Ticket.",
      ),
    ).toBeInTheDocument();
    expect(requestCount).toBe(2);
  });

  it("records required work details, follow-up, and plain-text attachment notes", async () => {
    let saved: ActionTakenEntry | null = null;
    const fetchMock = installFetch((url, init) => {
      if (url === "/api/tickets/101/actions-taken" && !init?.method) {
        return response({ items: saved ? [saved] : [] });
      }
      if (url === "/api/tickets/101/actions-taken" && init?.method === "POST") {
        const input = JSON.parse(String(init.body)) as Record<string, unknown>;
        saved = {
          ...action,
          ...input,
          id: 702,
          actionAt: String(input.actionAt),
          performedBy: { id: 22, name: "IT Staff B", role: "IT_STAFF" },
          version: 1,
        } as ActionTakenEntry;
        return response(saved, true, 201);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();
    render(<ActionsTakenPanel ticketId={101} canEdit />);

    await screen.findByText(
      "No Actions Taken have been recorded for this Ticket.",
    );
    await user.click(screen.getByRole("button", { name: "Add Action Taken" }));
    await user.clear(screen.getByLabelText("Action Date/Time"));
    await user.type(
      screen.getByLabelText("Action Date/Time"),
      "2026-10-08T13:30",
    );
    await user.type(
      screen.getByLabelText("Action Description"),
      "  Reconnected the service  ",
    );
    await user.type(screen.getByLabelText("Result"), "Service works again");
    await user.selectOptions(
      screen.getByLabelText("Follow-Up Required?"),
      "yes",
    );
    await user.type(
      screen.getByLabelText("Follow-up Note"),
      "Check after the next class",
    );
    await user.type(
      screen.getByLabelText("Attachment Notes"),
      "See existing screenshot.png",
    );
    await user.click(
      screen.getByRole("button", { name: "Record Action Taken" }),
    );

    expect(
      await screen.findByText("Action Taken recorded."),
    ).toBeInTheDocument();
    expect(screen.getByText("Reconnected the service")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url, init]) => {
        if (
          String(url) !== "/api/tickets/101/actions-taken" ||
          init?.method !== "POST"
        ) {
          return false;
        }
        const input = JSON.parse(String(init.body)) as Record<string, unknown>;
        return (
          typeof input.actionAt === "string" &&
          input.actionAt.endsWith("Z") &&
          input.actionDescription === "Reconnected the service" &&
          input.followUpRequired === true &&
          input.followUpNote === "Check after the next class" &&
          input.attachmentNotes === "See existing screenshot.png" &&
          new Headers(init.headers).has("Idempotency-Key")
        );
      }),
    ).toBe(true);
  });

  it("edits mutable fields with optimistic version and preserves original performer", async () => {
    let current = action;
    const fetchMock = installFetch((url, init) => {
      if (url === "/api/tickets/101/actions-taken" && !init?.method) {
        return response({ items: [current] });
      }
      if (
        url === "/api/tickets/101/actions-taken/701" &&
        init?.method === "PATCH"
      ) {
        const input = JSON.parse(String(init.body)) as Record<string, unknown>;
        current = {
          ...current,
          ...input,
          result: String(input.result),
          updatedBy: { id: 22, name: "IT Staff B", role: "IT_STAFF" },
          version: 2,
        };
        return response(current);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();
    render(<ActionsTakenPanel ticketId={101} canEdit />);

    await screen.findByText("Reset the account lock.");
    await user.click(screen.getByRole("button", { name: "Edit Action Taken" }));
    await user.clear(screen.getByLabelText("Result"));
    await user.type(
      screen.getByLabelText("Result"),
      "Verified on a second device.",
    );
    await user.click(screen.getByRole("button", { name: "Save Action Taken" }));

    expect(
      await screen.findByText("Action Taken updated."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Verified on a second device."),
    ).toBeInTheDocument();
    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith("/701") && init?.method === "PATCH",
    );
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual(
      expect.objectContaining({
        expectedVersion: 1,
        result: "Verified on a second device.",
      }),
    );
    expect(current.performedBy).toEqual(action.performedBy);
    expect(current.updatedBy?.id).toBe(22);
  });

  it("keeps Requester history read-only", async () => {
    installFetch((url) => {
      if (url === "/api/tickets/101/actions-taken") {
        return response({ items: [action] });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    render(<ActionsTakenPanel ticketId={101} canEdit={false} />);

    expect(
      await screen.findByText("Reset the account lock."),
    ).toBeInTheDocument();
    expect(screen.getByText("Confirm access after class.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit Action Taken" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Record Action Taken" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Action Description"),
    ).not.toBeInTheDocument();
  });

  it("refreshes the current version after conflict without discarding the draft", async () => {
    let actionList = [action];
    let patchCount = 0;
    installFetch((url, init) => {
      if (url === "/api/tickets/101/actions-taken" && !init?.method) {
        return response({ items: actionList });
      }
      if (
        url === "/api/tickets/101/actions-taken/701" &&
        init?.method === "PATCH"
      ) {
        patchCount += 1;
        if (patchCount === 1) {
          actionList = [
            { ...action, result: "Updated elsewhere.", version: 2 },
          ];
          return response(
            { error: { code: "ACTION_TAKEN_CONFLICT", message: "Conflict" } },
            false,
            409,
          );
        }
        const input = JSON.parse(String(init.body)) as Record<string, unknown>;
        const current = actionList[0];
        if (!current) {
          throw new Error("Expected the Action Taken to remain in history");
        }
        actionList = [{ ...current, result: String(input.result), version: 3 }];
        return response(actionList[0]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();
    render(<ActionsTakenPanel ticketId={101} canEdit />);

    await screen.findByText("Reset the account lock.");
    await user.click(screen.getByRole("button", { name: "Edit Action Taken" }));
    await user.clear(screen.getByLabelText("Result"));
    await user.type(
      screen.getByLabelText("Result"),
      "My preserved correction.",
    );
    await user.click(screen.getByRole("button", { name: "Save Action Taken" }));

    expect(
      await screen.findByText(/your draft is preserved/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Result")).toHaveValue(
      "My preserved correction.",
    );
    expect(screen.getByText("Editing version 2.")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Reapply changes to version 2" }),
    );

    expect(
      await screen.findByText("Action Taken updated."),
    ).toBeInTheDocument();
    expect(patchCount).toBe(2);
  });
});
