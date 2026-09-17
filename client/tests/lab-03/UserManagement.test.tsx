import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import UserManagement from "../../src/lab-03/UserManagement";
import { response } from "./test-helpers";

const administrator = {
  id: 1,
  name: "Administrator",
  email: "administrator@toktickit.test",
  role: "ADMINISTRATOR" as const,
  status: "ACTIVE" as const,
};

const requester = {
  id: 2,
  name: "Requester A",
  email: "requester-a@toktickit.test",
  role: "REQUESTER" as const,
  status: "INACTIVE" as const,
};

function installUserFetch(users: unknown[] = [administrator, requester]) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/admin/users")) {
      return Promise.resolve(response(users));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Administrator User Management", () => {
  it("lists the required columns with search, role filter, and actions", async () => {
    const fetchMock = installUserFetch();
    const user = userEvent.setup();

    render(<UserManagement currentUserId={1} />);

    expect(
      await screen.findByRole("heading", { name: "User Management" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Search users")).toBeInTheDocument();
    expect(screen.getByLabelText("Role")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Name" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Email" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Role" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Status" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Edit action" }),
    ).toBeInTheDocument();
    const administratorRow = screen.getByRole("row", {
      name: /administrator@toktickit\.test/,
    });
    expect(
      within(administratorRow)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual([
      "Administrator",
      "administrator@toktickit.test",
      "Administrator",
      "Active",
      "Edit",
    ]);
    const requesterRow = screen.getByRole("row", {
      name: /requester-a@toktickit\.test/,
    });
    expect(
      within(requesterRow)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual([
      "Requester A",
      "requester-a@toktickit.test",
      "Requester",
      "Inactive",
      "Edit",
    ]);
    expect(
      screen.getAllByRole("button", { name: "Edit" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Create user" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear filters" }),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Search users"), "requester");
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("search=requester"),
        ),
      ).toBe(true);
    });

    await user.selectOptions(screen.getByLabelText("Role"), "IT_STAFF");
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("role=IT_STAFF"),
        ),
      ).toBe(true);
    });

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([input]) => String(input) === "/api/admin/users",
        ),
      ).toBe(true);
    });
  });

  it("distinguishes empty results and reports forbidden access", async () => {
    installUserFetch([]);
    const { unmount } = render(<UserManagement currentUserId={1} />);
    expect(
      await screen.findByText(
        "No Users are available yet. Create the first account.",
      ),
    ).toBeInTheDocument();
    unmount();

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/admin/users")) {
        return Promise.resolve(
          response(
            {
              error: {
                code: "USER_MANAGEMENT_FORBIDDEN",
                message: "forbidden",
              },
            },
            false,
            403,
          ),
        );
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<UserManagement currentUserId={1} />);
    expect(
      await screen.findByText(
        "Administrator permission is required to manage Users.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("columnheader")).not.toBeInTheDocument();
  });

  it("creates a User with the required identity and initial password fields", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/admin/users" && init?.method === "POST") {
        return Promise.resolve(
          response(
            {
              id: 9,
              name: "New Staff",
              email: "new-staff@toktickit.test",
              role: "IT_STAFF",
              status: "ACTIVE",
            },
            true,
            201,
          ),
        );
      }
      if (url.startsWith("/api/admin/users")) {
        return Promise.resolve(response([administrator]));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<UserManagement currentUserId={1} />);
    await screen.findByRole("heading", { name: "User Management" });
    await user.click(screen.getByRole("button", { name: "Create user" }));

    const form = screen.getByRole("form", { name: "Create user" });
    await user.type(within(form).getByLabelText(/^Name/), "New Staff");
    await user.type(
      within(form).getByLabelText(/^Email address/),
      "new-staff@toktickit.test",
    );
    await user.selectOptions(within(form).getByLabelText(/^Role/), "IT_STAFF");
    await user.type(
      within(form).getByLabelText(/^Initial password/),
      "InitialPassword!1",
    );
    await user.type(
      within(form).getByLabelText(/^Confirm initial password/),
      "InitialPassword!1",
    );
    await user.click(within(form).getByRole("button", { name: "Create user" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input) === "/api/admin/users" &&
            init?.method === "POST" &&
            typeof init.body === "string" &&
            JSON.parse(init.body).email === "new-staff@toktickit.test" &&
            JSON.parse(init.body).role === "IT_STAFF" &&
            JSON.parse(init.body).initialPassword === "InitialPassword!1",
        ),
      ).toBe(true);
    });
    expect(
      await screen.findByText(
        "New Staff was created and must change the initial password at the next sign-in.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "User Management" }),
    ).toBeInTheDocument();
  });

  it("blocks weak passwords and surfaces duplicate-email conflicts", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/admin/users" && init?.method === "POST") {
        return Promise.resolve(
          response(
            {
              error: {
                code: "EMAIL_ALREADY_EXISTS",
                message: "A User with this email address already exists.",
              },
            },
            false,
            409,
          ),
        );
      }
      if (url.startsWith("/api/admin/users")) {
        return Promise.resolve(response([administrator, requester]));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<UserManagement currentUserId={1} />);
    await screen.findByRole("heading", { name: "User Management" });
    await user.click(screen.getByRole("button", { name: "Create user" }));

    const form = screen.getByRole("form", { name: "Create user" });
    await user.type(within(form).getByLabelText(/^Name/), "Duplicate User");
    await user.type(
      within(form).getByLabelText(/^Email address/),
      "requester-a@toktickit.test",
    );
    await user.type(within(form).getByLabelText(/^Initial password/), "short");
    await user.type(
      within(form).getByLabelText(/^Confirm initial password/),
      "different",
    );
    await user.click(within(form).getByRole("button", { name: "Create user" }));

    expect(
      await screen.findByText(
        "Password must contain 12-128 characters, including a letter, a number, and a non-alphanumeric character.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Initial password and confirmation must match."),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "POST"),
    ).toBe(false);

    await user.clear(within(form).getByLabelText(/^Initial password/));
    await user.type(
      within(form).getByLabelText(/^Initial password/),
      "InitialPassword!1",
    );
    await user.clear(within(form).getByLabelText(/^Confirm initial password/));
    await user.type(
      within(form).getByLabelText(/^Confirm initial password/),
      "InitialPassword!1",
    );
    await user.click(within(form).getByRole("button", { name: "Create user" }));

    expect(
      await screen.findByText("A User with this email address already exists."),
    ).toBeInTheDocument();
  });

  it("edits an account, prevents self-deactivation, and sets a new initial password", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/admin/users/2" && init?.method === "PATCH") {
        return Promise.resolve(
          response({
            id: 2,
            name: "Requester A Renamed",
            email: "requester-a@toktickit.test",
            role: "REQUESTER",
            status: "ACTIVE",
          }),
        );
      }
      if (
        url === "/api/admin/users/1/initial-password" &&
        init?.method === "POST"
      ) {
        return Promise.resolve(response(null, true, 204));
      }
      if (url.startsWith("/api/admin/users")) {
        return Promise.resolve(response([administrator, requester]));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<UserManagement currentUserId={1} />);
    await screen.findByRole("heading", { name: "User Management" });
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);

    const selfEditForm = screen.getByRole("form", {
      name: "Edit Administrator",
    });
    expect(
      within(selfEditForm).getByLabelText(/Account is active/),
    ).toBeDisabled();
    expect(
      screen.getByText("You cannot deactivate your own Administrator account."),
    ).toBeInTheDocument();
    await user.click(
      within(selfEditForm).getByRole("button", { name: "Back to list" }),
    );

    await user.click(screen.getAllByRole("button", { name: "Edit" })[1]);
    const form = screen.getByRole("form", { name: "Edit Requester A" });
    const nameInput = within(form).getByLabelText(/^Name/);
    await user.clear(nameInput);
    await user.type(nameInput, "Requester A Renamed");
    await user.click(
      within(form).getByRole("checkbox", { name: /Account is active/ }),
    );
    await user.click(
      within(form).getByRole("button", { name: "Save changes" }),
    );

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input) === "/api/admin/users/2" &&
            init?.method === "PATCH" &&
            typeof init.body === "string" &&
            JSON.parse(init.body).name === "Requester A Renamed" &&
            JSON.parse(init.body).active === true,
        ),
      ).toBe(true);
    });
    expect(
      await screen.findByText("Requester A Renamed was updated."),
    ).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    const passwordToggle = screen.getByRole("button", {
      name: "Set new initial password",
    });
    expect(passwordToggle).toHaveAttribute("aria-expanded", "false");
    await user.click(passwordToggle);

    const passwordForm = screen.getByRole("form", {
      name: "Set new initial password",
    });
    await user.type(
      within(passwordForm).getByLabelText(/^New initial password/),
      "ReplacementPassword!2",
    );
    await user.type(
      within(passwordForm).getByLabelText(/^Confirm new initial password/),
      "ReplacementPassword!2",
    );
    await user.click(
      within(passwordForm).getByRole("button", {
        name: "Save new initial password",
      }),
    );

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input) === "/api/admin/users/1/initial-password" &&
            init?.method === "POST" &&
            typeof init.body === "string" &&
            JSON.parse(init.body).initialPassword === "ReplacementPassword!2",
        ),
      ).toBe(true);
    });
    expect(
      await screen.findByText(
        /A new initial password was set for Administrator\./,
      ),
    ).toBeInTheDocument();
  });
});
