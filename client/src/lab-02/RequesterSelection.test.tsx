import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";

const activeRequesters = [
  { id: 1, name: "Requester A", email: "requester-a@toktickit.test" },
  { id: 2, name: "Requester B", email: "requester-b@toktickit.test" },
];

function response(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Issue #52 Development Requester selection", () => {
  it("shows only the active requester response and enables Continue after selection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(activeRequesters)),
    );
    const user = userEvent.setup();

    render(<App />);

    const selector = await screen.findByRole("combobox", {
      name: "Development Requester",
    });
    expect(
      screen.getByRole("option", { name: /Requester A/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Inactive/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    await user.selectOptions(selector, "2");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByRole("heading", { name: "Requester context selected" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Requester B")).toBeInTheDocument();
  });

  it("shows a recoverable failure state", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValueOnce(response(activeRequesters));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to connect to TokTickIT API",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("combobox")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("distinguishes the empty active-requester state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([])));

    render(<App />);

    expect(
      await screen.findByText(
        "No active Development Requesters are available.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("clears the selected requester when Change Requester is used", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(activeRequesters)),
    );
    const user = userEvent.setup();

    render(<App />);
    await user.selectOptions(await screen.findByRole("combobox"), "1");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Change Requester" }));

    expect(
      screen.getByRole("heading", {
        name: "Select a Development Requester",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("");
  });
});
