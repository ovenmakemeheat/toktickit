import { Buffer } from "node:buffer";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

const viewportSizes = {
  desktop: { width: 1280, height: 900 },
  tablet: { width: 820, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

const evidenceDirectories = [
  "create-ticket",
  "my-tickets",
  "ticket-detail",
] as const;
const repositoryRoot = resolve(__dirname, "..", "..");

type CreatedTicket = {
  id: number;
  ticketNumber: string;
};

type UploadedAttachment = {
  id: number;
  displayName: string;
};

const emptyTicketList = {
  items: [],
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 0,
};

const unavailableApiResponse = {
  error: { code: "INTERNAL_ERROR" },
};

async function prepareEvidenceDirectories(rootDir: string) {
  await Promise.all(
    evidenceDirectories.map((directory) =>
      mkdir(resolve(rootDir, "artifacts", "lab-02", "screenshots", directory), {
        recursive: true,
      }),
    ),
  );
}

async function assertNoHorizontalOverflow(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const documentWidth = Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth,
          );
          return documentWidth <= window.innerWidth;
        }),
      { message: "The page must not overflow horizontally." },
    )
    .toBe(true);
}

async function captureResponsiveEvidence(
  page: Page,
  directory: (typeof evidenceDirectories)[number],
  filePrefix: string,
  required: () => Locator[],
) {
  for (const viewportName of ["desktop", "tablet", "mobile"] as const) {
    await page.setViewportSize(viewportSizes[viewportName]);
    await assertNoHorizontalOverflow(page);

    for (const locator of required()) {
      await expect(locator).toBeVisible();
    }

    await page.screenshot({
      path: resolve(
        repositoryRoot,
        "artifacts",
        "lab-02",
        "screenshots",
        directory,
        `${filePrefix}-${viewportName}.png`,
      ),
      fullPage: true,
    });
  }
}

async function chooseRequester(page: Page, requesterName: string) {
  const requesterSelect = page.getByRole("combobox", {
    name: "Development Requester",
  });
  const requesterOption = requesterSelect
    .locator("option")
    .filter({ hasText: requesterName })
    .first();
  await expect(requesterOption).toHaveCount(1);

  const requesterId = await requesterOption.getAttribute("value");
  if (!requesterId) {
    throw new Error(`No value found for ${requesterName}`);
  }

  await requesterSelect.selectOption(requesterId);
  return requesterId;
}

function visibleTicketSummary(page: Page, summary: string) {
  return page
    .locator("table:visible, .lab2-ticket-card:visible")
    .getByText(summary, { exact: true });
}

function visibleOpenTicketButton(page: Page) {
  return page.locator("button:visible").filter({ hasText: "Open Ticket" });
}

test.describe("Issue #57 requester ticket flow", () => {
  test("E2E-01, E2E-02, RESP-01, VIS-01: completes the requester ticket lifecycle", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await prepareEvidenceDirectories(repositoryRoot);

    const runToken = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const summary = `Lab 2 E2E ticket ${runToken}`;
    const description =
      "The Lab 2 end-to-end flow verifies requester ownership and attachment lifecycle behavior.";
    const attachmentName = "lab2-e2e-evidence.pdf";
    const removalReason = "Replaced by current Lab 2 evidence";

    await page.goto("/");
    const requesterId = await chooseRequester(page, "Requester A");
    await expect(
      page.getByRole("option", { name: /Inactive Requester/ }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByText("Testing context: Requester A")).toBeVisible();

    let releaseReferenceLoading!: () => void;
    const referenceLoadingReleased = new Promise<void>((resolve) => {
      releaseReferenceLoading = resolve;
    });
    await page.route("**/api/categories", async (route) => {
      await referenceLoadingReleased;
      await route.continue();
    });
    await page
      .getByRole("button", { name: "Create Ticket", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Create Ticket", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Loading Categories and Related Systems...", {
        exact: true,
      }),
    ).toBeVisible();
    await captureResponsiveEvidence(
      page,
      "create-ticket",
      "create-ticket-reference-loading",
      () => [
        page.getByRole("heading", { name: "Create Ticket", exact: true }),
        page.getByText("Loading Categories and Related Systems...", {
          exact: true,
        }),
      ],
    );
    releaseReferenceLoading();
    await expect(
      page.getByRole("combobox", { name: "Category" }),
    ).toBeVisible();
    await page.unroute("**/api/categories");

    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(
      page.getByText("Category is required.", { exact: true }),
    ).toBeVisible();
    await captureResponsiveEvidence(
      page,
      "create-ticket",
      "create-ticket-validation",
      () => [
        page.getByRole("heading", { name: "Create Ticket", exact: true }),
        page.getByText("Category is required.", { exact: true }),
        page.getByText(
          "Description must contain 20-4000 characters after trimming.",
          {
            exact: true,
          },
        ),
      ],
    );

    await page.getByRole("combobox", { name: "Category" }).selectOption({
      label: "Hardware",
    });
    await page
      .getByRole("combobox", { name: "Related System" })
      .selectOption({ label: "VPN" });
    await page
      .getByRole("combobox", { name: "Requested Priority" })
      .selectOption("HIGH");
    await page.getByRole("textbox", { name: "Summary" }).fill(summary);
    await page.getByRole("textbox", { name: "Description" }).fill(description);

    await page.route("**/api/tickets", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify(unavailableApiResponse),
        });
        return;
      }

      await route.continue();
    });
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({
        hasText: "Unable to connect to TokTickIT API",
      }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Summary" })).toHaveValue(
      summary,
    );
    await captureResponsiveEvidence(
      page,
      "create-ticket",
      "create-ticket-api-failure",
      () => [
        page.getByRole("heading", { name: "Create Ticket", exact: true }),
        page.getByRole("alert").filter({
          hasText: "Unable to connect to TokTickIT API",
        }),
        page.getByRole("textbox", { name: "Summary" }),
      ],
    );
    await page.unroute("**/api/tickets");

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/tickets") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    const createdTicket = (await createResponse.json()) as CreatedTicket;
    expect(createdTicket.id).toEqual(expect.any(Number));
    expect(createdTicket.ticketNumber).toMatch(/^TT-\d{8}-[A-Z0-9]{6}$/);
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: `Ticket created: ${createdTicket.ticketNumber}` }),
    ).toBeVisible();

    await captureResponsiveEvidence(
      page,
      "create-ticket",
      "create-ticket-success",
      () => [
        page.getByRole("heading", { name: "Create Ticket", exact: true }),
        page.getByLabel("Ticket Number"),
        page
          .getByRole("status")
          .filter({ hasText: `Ticket created: ${createdTicket.ticketNumber}` }),
      ],
    );

    await page.setViewportSize(viewportSizes.desktop);
    await page.getByRole("button", { name: "My Tickets", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "My Tickets", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Tickets owned by Requester A")).toBeVisible();
    await page.getByRole("textbox", { name: "Search" }).fill(summary);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(visibleTicketSummary(page, summary)).toBeVisible();

    await captureResponsiveEvidence(
      page,
      "my-tickets",
      "my-tickets-filtered",
      () => [
        page.getByRole("heading", { name: "My Tickets", exact: true }),
        visibleTicketSummary(page, summary),
        visibleOpenTicketButton(page),
      ],
    );

    await page.setViewportSize(viewportSizes.desktop);
    let requesterDId = "";
    await page.route("**/api/tickets**", async (route) => {
      const request = route.request();
      const requestUrl = new URL(request.url());
      if (
        request.method() === "GET" &&
        requestUrl.pathname === "/api/tickets" &&
        request.headers()["x-development-requester-id"] === requesterDId
      ) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(emptyTicketList),
        });
        return;
      }

      await route.continue();
    });
    await page
      .getByRole("button", { name: "Change Requester", exact: true })
      .click();
    await expect(
      page.getByRole("combobox", { name: "Development Requester" }),
    ).toBeVisible();
    requesterDId = await chooseRequester(page, "Requester D");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "My Tickets", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "My Tickets", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Requester D has no tickets yet.", { exact: true }),
    ).toBeVisible();
    await captureResponsiveEvidence(
      page,
      "my-tickets",
      "my-tickets-empty",
      () => [
        page.getByRole("heading", { name: "My Tickets", exact: true }),
        page.getByText("Requester D has no tickets yet.", { exact: true }),
        page.getByRole("button", { name: "Create Ticket", exact: true }).last(),
      ],
    );
    await page.unroute("**/api/tickets**");

    let requesterCId = "";
    await page.route("**/api/tickets**", async (route) => {
      const request = route.request();
      const requestUrl = new URL(request.url());
      if (
        request.method() === "GET" &&
        requestUrl.pathname === "/api/tickets" &&
        request.headers()["x-development-requester-id"] === requesterCId
      ) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify(unavailableApiResponse),
        });
        return;
      }

      await route.continue();
    });
    await page
      .getByRole("button", { name: "Change Requester", exact: true })
      .click();
    await expect(
      page.getByRole("combobox", { name: "Development Requester" }),
    ).toBeVisible();
    requesterCId = await chooseRequester(page, "Requester C");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "My Tickets", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "My Tickets", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("alert").filter({
        hasText: "Your current ticket list was not kept as current",
      }),
    ).toBeVisible();
    await captureResponsiveEvidence(
      page,
      "my-tickets",
      "my-tickets-api-failure",
      () => [
        page.getByRole("heading", { name: "My Tickets", exact: true }),
        page.getByRole("alert").filter({
          hasText: "Your current ticket list was not kept as current",
        }),
        page.getByRole("button", { name: "Try again", exact: true }),
      ],
    );
    await page.unroute("**/api/tickets**");

    await page
      .getByRole("button", { name: "Change Requester", exact: true })
      .click();
    await expect(
      page.getByRole("combobox", { name: "Development Requester" }),
    ).toBeVisible();
    await chooseRequester(page, "Requester B");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "My Tickets", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "My Tickets", exact: true }),
    ).toBeVisible();
    await page.getByRole("textbox", { name: "Search" }).fill(summary);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(
      page.getByText("No tickets match the current search and filters."),
    ).toBeVisible();

    await captureResponsiveEvidence(
      page,
      "my-tickets",
      "my-tickets-ownership-isolation",
      () => [
        page.getByRole("heading", { name: "My Tickets", exact: true }),
        page.getByText("No tickets match the current search and filters."),
        page
          .getByRole("button", { name: "Create Ticket", exact: true })
          .first(),
      ],
    );

    await page.setViewportSize(viewportSizes.desktop);
    await page
      .getByRole("button", { name: "Change Requester", exact: true })
      .click();
    await expect(
      page.getByRole("combobox", { name: "Development Requester" }),
    ).toBeVisible();
    await chooseRequester(page, "Requester A");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "My Tickets", exact: true }).click();
    await page.getByRole("textbox", { name: "Search" }).fill(summary);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(visibleTicketSummary(page, summary)).toBeVisible();
    await visibleOpenTicketButton(page).click();

    await expect(
      page.getByRole("heading", {
        name: createdTicket.ticketNumber,
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Summary")).toHaveValue(summary);
    await expect(
      page.getByRole("heading", { name: "Attachments", exact: true }),
    ).toBeVisible();

    const attachmentInput = page.getByLabel("Upload attachment");
    await attachmentInput.setInputFiles({
      name: "lab2-invalid-attachment.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("not an allowed attachment"),
    });
    await expect(
      page.getByText("Only JPG, JPEG, PNG, WEBP, and PDF files are allowed.", {
        exact: true,
      }),
    ).toBeVisible();
    await captureResponsiveEvidence(
      page,
      "ticket-detail",
      "ticket-detail-invalid-attachment",
      () => [
        page.getByRole("heading", {
          name: createdTicket.ticketNumber,
          exact: true,
        }),
        page.getByRole("heading", { name: "Attachments", exact: true }),
        page.getByText(
          "Only JPG, JPEG, PNG, WEBP, and PDF files are allowed.",
          { exact: true },
        ),
      ],
    );
    await attachmentInput.setInputFiles({
      name: attachmentName,
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 Lab 2 E2E attachment evidence\n"),
    });
    await expect(page.getByText(`Selected: ${attachmentName}`)).toBeVisible();

    const uploadResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(`/api/tickets/${createdTicket.id}/attachments`) &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("region", { name: "Attachments" })
      .locator("button")
      .filter({ hasText: "Upload attachment" })
      .click();
    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.status()).toBe(201);
    const uploadedAttachment =
      (await uploadResponse.json()) as UploadedAttachment;
    expect(uploadedAttachment.displayName).toBe(attachmentName);
    await expect(
      page.getByText("Attachment uploaded successfully.", { exact: true }),
    ).toBeVisible();
    const activeAttachment = page
      .getByRole("list", { name: "Ticket attachments" })
      .getByText(attachmentName, { exact: true });
    await expect(activeAttachment).toBeVisible();
    await expect(
      page
        .getByRole("list", { name: "Ticket attachments" })
        .getByText("Active", {
          exact: true,
        }),
    ).toBeVisible();

    await captureResponsiveEvidence(
      page,
      "ticket-detail",
      "ticket-detail-active",
      () => [
        page.getByRole("heading", {
          name: createdTicket.ticketNumber,
          exact: true,
        }),
        page.getByRole("heading", { name: "Attachments", exact: true }),
        activeAttachment,
        page.getByRole("button", { name: "Download", exact: true }),
      ],
    );

    await page.setViewportSize(viewportSizes.desktop);
    const downloadResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/attachments/") &&
        response.url().endsWith("/download") &&
        response.request().method() === "GET",
    );
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download", exact: true }).click();
    const [download, downloadResponse] = await Promise.all([
      downloadPromise,
      downloadResponsePromise,
    ]);
    expect(downloadResponse.status()).toBe(200);
    expect(download.suggestedFilename()).toBe(attachmentName);

    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(
      page.getByRole("group", { name: "Confirm attachment removal" }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "Removal reason" })
      .fill(removalReason);

    const removeResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(
            `/api/tickets/${createdTicket.id}/attachments/${uploadedAttachment.id}`,
          ) && response.request().method() === "DELETE",
    );
    await page
      .getByRole("button", { name: "Confirm removal", exact: true })
      .click();
    const removeResponse = await removeResponsePromise;
    expect(removeResponse.status()).toBe(204);
    await expect(
      page.getByText("Attachment removed. Its metadata is retained.", {
        exact: true,
      }),
    ).toBeVisible();

    const removedAttachment = page
      .locator("li.lab2-attachment-record-removed")
      .filter({ hasText: attachmentName });
    await expect(removedAttachment).toContainText(removalReason);
    await expect(
      removedAttachment.locator(".lab2-attachment-removed"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Download", exact: true }),
    ).toHaveCount(0);
    await expect(
      removedAttachment.getByText(
        "Download unavailable: removed attachments cannot be previewed or downloaded.",
        { exact: true },
      ),
    ).toBeVisible();

    const removedDownloadResponse = await page.request.get(
      new URL(
        `/api/tickets/${createdTicket.id}/attachments/${uploadedAttachment.id}/download`,
        page.url(),
      ).toString(),
      { headers: { "X-Development-Requester-Id": requesterId } },
    );
    expect(removedDownloadResponse.status()).toBe(410);
    expect(await removedDownloadResponse.json()).toMatchObject({
      error: { code: "ATTACHMENT_REMOVED" },
    });

    await captureResponsiveEvidence(
      page,
      "ticket-detail",
      "ticket-detail-blocked-download",
      () => [
        page.getByRole("heading", {
          name: createdTicket.ticketNumber,
          exact: true,
        }),
        page.getByRole("heading", { name: "Attachments", exact: true }),
        removedAttachment.getByText(
          "Download unavailable: removed attachments cannot be previewed or downloaded.",
          { exact: true },
        ),
      ],
    );

    await captureResponsiveEvidence(
      page,
      "ticket-detail",
      "ticket-detail-removed",
      () => [
        page.getByRole("heading", {
          name: createdTicket.ticketNumber,
          exact: true,
        }),
        page.getByRole("heading", { name: "Attachments", exact: true }),
        removedAttachment,
      ],
    );
  });
});
