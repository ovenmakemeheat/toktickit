import { Buffer } from "node:buffer";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const repositoryRoot = resolve(__dirname, "..", "..");
const reportEvidenceDirectory = resolve(
  repositoryRoot,
  "docs",
  "lab-02",
  "report",
  "evidence",
);

const activeRequesters = [
  { id: 1, name: "Requester A", email: "requester-a@toktickit.test" },
  { id: 2, name: "Requester B", email: "requester-b@toktickit.test" },
  { id: 3, name: "Requester C", email: "requester-c@toktickit.test" },
  { id: 4, name: "Requester D", email: "requester-d@toktickit.test" },
];

const categories = [
  { id: 1, name: "Hardware" },
  { id: 2, name: "Software" },
];

const relatedSystems = [
  { id: 1, name: "Email" },
  { id: 3, name: "VPN" },
];

const submittedTicket = {
  id: 9001,
  ticketNumber: "TT-20260904-ABC123",
  ticketDate: "2026-09-04T10:00:00.000Z",
  requester: { id: 1, name: "Requester A" },
  category: { id: 1, name: "Hardware" },
  relatedSystem: { id: 3, name: "VPN" },
  requestedPriority: "HIGH" as const,
  summary: "Lab 2 report evidence ticket",
  description: "This fixture represents the server-generated ticket result.",
  currentStatus: "NEW" as const,
  createdAt: "2026-09-04T10:00:00.000Z",
  lastUpdated: "2026-09-04T10:00:00.000Z",
  attachments: [],
};

function ticketSummary(id: number, summary: string) {
  return {
    id,
    ticketNumber: `TT-20260904-${String(id).padStart(6, "0")}`,
    ticketDate: `2026-09-${String(20 - (id % 10)).padStart(2, "0")}T10:00:00.000Z`,
    requester: { id: 1, name: "Requester A" },
    category: { id: 1, name: "Hardware" },
    relatedSystem: { id: 3, name: "VPN" },
    requestedPriority: id % 2 === 0 ? ("HIGH" as const) : ("MEDIUM" as const),
    summary,
    currentStatus: "NEW" as const,
    lastUpdated: "2026-09-04T10:00:00.000Z",
  };
}

const ticketItems = Array.from({ length: 11 }, (_, index) =>
  ticketSummary(
    index + 1,
    `Evidence query ticket ${String(index + 1).padStart(2, "0")}`,
  ),
);

async function fulfillJson(
  route: Parameters<Parameters<Page["route"]>[1]>[0],
  payload: unknown,
  status = 200,
) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
}

async function capture(page: Page, filename: string) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const documentWidth = Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth,
        );
        return documentWidth <= window.innerWidth;
      }),
    )
    .toBe(true);

  await page.screenshot({
    path: resolve(reportEvidenceDirectory, filename),
    fullPage: true,
  });
}

async function selectRequester(page: Page, name: string) {
  const requesterSelect = page.getByRole("combobox", {
    name: "Development Requester",
  });
  const option = requesterSelect
    .locator("option")
    .filter({ hasText: name })
    .first();
  const requesterId = await option.getAttribute("value");

  if (!requesterId) {
    throw new Error(`No requester id found for ${name}`);
  }

  await requesterSelect.selectOption(requesterId);
}

async function waitForTicketQuery(page: Page, action: () => Promise<unknown>) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/tickets") &&
      response.request().method() === "GET",
  );
  await action();
  await expect((await responsePromise).ok()).toBe(true);
}

test.describe("Issue #65 report evidence", () => {
  test("captures missing requester, create, and query-control states", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await mkdir(reportEvidenceDirectory, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.route("**/api/development-requesters", (route) =>
      fulfillJson(route, activeRequesters),
    );
    await page.route("**/api/categories", (route) =>
      fulfillJson(route, categories),
    );
    await page.route("**/api/related-systems", (route) =>
      fulfillJson(route, relatedSystems),
    );

    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "Select a Development Requester",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("option", { name: /Inactive Requester/ }),
    ).toHaveCount(0);
    await capture(page, "requester-selection-ready.png");

    await selectRequester(page, "Requester A");
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeEnabled();
    await capture(page, "requester-selection-selected.png");

    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Requester context selected" }),
    ).toBeVisible();
    await capture(page, "requester-summary.png");

    await page
      .getByRole("button", { name: "Change Requester", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Select a Development Requester",
        exact: true,
      }),
    ).toBeVisible();
    await capture(page, "requester-change.png");

    await selectRequester(page, "Requester A");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("button", { name: "Create Ticket", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Create Ticket", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Category" }),
    ).toBeVisible();
    await capture(page, "create-ticket-initial-desktop.png");

    await page.locator("#attachments").setInputFiles([
      {
        name: "report-evidence.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 report evidence"),
      },
      {
        name: "not-permitted.exe",
        mimeType: "application/octet-stream",
        buffer: Buffer.from("not an allowed attachment"),
      },
    ]);
    await expect(
      page.getByText("Only JPG, JPEG, PNG, WEBP, and PDF files are allowed.", {
        exact: true,
      }),
    ).toBeVisible();
    await capture(page, "create-ticket-invalid-attachment.png");

    await page.locator("#attachments").setInputFiles([]);
    await page.getByRole("combobox", { name: "Category" }).selectOption("1");
    await page
      .getByRole("combobox", { name: "Related System" })
      .selectOption("3");
    await page
      .getByRole("combobox", { name: "Requested Priority" })
      .selectOption("HIGH");
    await page
      .getByRole("textbox", { name: "Summary" })
      .fill("Lab 2 report evidence ticket");
    await page
      .getByRole("textbox", { name: "Description" })
      .fill("This fixture represents the server-generated ticket result.");

    let releaseSubmit!: () => void;
    const submitHeld = new Promise<void>((resolveSubmit) => {
      releaseSubmit = resolveSubmit;
    });
    await page.route("**/api/tickets", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      await submitHeld;
      await fulfillJson(route, submittedTicket, 201);
    });

    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Submitting...", exact: true }),
    ).toBeDisabled();
    await capture(page, "create-ticket-submitting-desktop.png");
    releaseSubmit();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: submittedTicket.ticketNumber }),
    ).toBeVisible();
    await page.unroute("**/api/tickets");

    await page.route("**/api/tickets**", async (route) => {
      const request = route.request();
      const requestUrl = new URL(request.url());

      if (
        request.method() !== "GET" ||
        requestUrl.pathname !== "/api/tickets"
      ) {
        await route.continue();
        return;
      }

      const pageNumber = Number(requestUrl.searchParams.get("page") ?? "1");
      const pageItems =
        pageNumber === 2 ? ticketItems.slice(10) : ticketItems.slice(0, 10);
      await fulfillJson(route, {
        items: pageItems,
        page: pageNumber,
        pageSize: 10,
        totalItems: ticketItems.length,
        totalPages: 2,
      });
    });

    await page.getByRole("button", { name: "My Tickets", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "My Tickets", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Page 1 of 2 (11 tickets)")).toBeVisible();

    await waitForTicketQuery(page, () =>
      page.getByLabel("Category").selectOption("1"),
    );
    await waitForTicketQuery(page, () =>
      page.getByLabel("Sort By").selectOption("summary"),
    );
    await waitForTicketQuery(page, () =>
      page.getByLabel("Direction").selectOption("asc"),
    );
    await waitForTicketQuery(page, () =>
      page.getByRole("button", { name: "Next page", exact: true }).click(),
    );
    await expect(page.getByText("Page 2 of 2 (11 tickets)")).toBeVisible();
    await capture(page, "my-tickets-filter-sort-page-desktop.png");
  });
});
