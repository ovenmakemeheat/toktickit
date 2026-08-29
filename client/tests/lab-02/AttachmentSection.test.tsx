import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import AttachmentSection from "../../src/lab-02/AttachmentSection";

type MockResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
  blob?: () => Promise<Blob>;
};

const activeAttachment = {
  id: 201,
  displayName: "evidence.png",
  mimeType: "image/png",
  sizeBytes: 4_096,
  uploadedAt: "2026-08-29T09:00:00.000Z",
  removedAt: null,
  removalReason: null,
  isActive: true,
  downloadUrl: "/api/tickets/101/attachments/201/download",
};

const removedAttachment = {
  id: 202,
  displayName: "old-evidence.pdf",
  mimeType: "application/pdf",
  sizeBytes: 8_192,
  uploadedAt: "2026-08-28T09:00:00.000Z",
  removedAt: "2026-08-29T10:00:00.000Z",
  removalReason: "Contains obsolete evidence",
  isActive: false,
  downloadUrl: null,
};

function response(payload: unknown, ok = true): MockResponse {
  return {
    ok,
    json: async () => payload,
  };
}

function renderAttachments(
  attachments = [activeAttachment, removedAttachment],
  onChanged = vi.fn(async () => undefined),
) {
  render(
    <AttachmentSection
      requesterId={1}
      ticketId={101}
      attachments={attachments}
      onChanged={onChanged}
    />,
  );
  return onChanged;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Issue #55 AttachmentSection", () => {
  it("rejects an invalid file before calling the upload API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderAttachments();
    await user.upload(
      screen.getByLabelText("Upload attachment"),
      new File(["not an image"], "evidence.png", {
        type: "application/pdf",
      }),
    );

    expect(
      screen.getByText("The file type does not match its filename extension."),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Upload attachment" }),
    ).not.toBeInTheDocument();
  });

  it("uploads a permitted file with requester context and offers retry on failure", async () => {
    let shouldFail = true;
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, options?: RequestInit) => {
        expect(String(input)).toBe("/api/tickets/101/attachments");
        expect(options?.method).toBe("POST");
        expect(options?.headers).toEqual({ "X-Development-Requester-Id": "1" });
        expect(options?.body).toBeInstanceOf(FormData);
        return Promise.resolve(
          shouldFail
            ? response(
                { error: { code: "ATTACHMENT_STORAGE_UNAVAILABLE" } },
                false,
              )
            : response(activeAttachment),
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderAttachments();
    await user.upload(
      screen.getByLabelText("Upload attachment"),
      new File(["image"], "new-evidence.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "Upload attachment" }));

    expect(
      await screen.findByText(
        "Attachment storage is temporarily unavailable. Try again.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry upload" }),
    ).toBeInTheDocument();

    shouldFail = false;
    await user.click(screen.getByRole("button", { name: "Retry upload" }));
    expect(
      await screen.findByText("Attachment uploaded successfully."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("downloads active files and requires confirmation plus a reason before removal", async () => {
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, options?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/download")) {
          return Promise.resolve({
            ok: true,
            json: async () => null,
            blob: async () => new Blob(["file"], { type: "image/png" }),
          });
        }

        expect(url).toBe("/api/tickets/101/attachments/201");
        expect(options?.method).toBe("DELETE");
        expect(options?.headers).toEqual({
          "Content-Type": "application/json",
          "X-Development-Requester-Id": "1",
        });
        expect(JSON.parse(String(options?.body))).toEqual({
          removalReason: "No longer needed",
        });
        return Promise.resolve(response(null));
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:attachment"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const user = userEvent.setup();

    renderAttachments();
    await user.click(screen.getByRole("button", { name: "Download" }));
    expect(fetchMock.mock.calls[0]?.[1]).toEqual({
      headers: { "X-Development-Requester-Id": "1" },
    });
    expect(click).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByLabelText("Removal reason")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Confirm removal" }));
    expect(
      screen.getByText(
        "Removal reason must contain 3-200 characters after trimming.",
      ),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.type(
      screen.getByLabelText("Removal reason"),
      "No longer needed",
    );
    await user.click(screen.getByRole("button", { name: "Confirm removal" }));
    expect(
      await screen.findByText("Attachment removed. Its metadata is retained."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByRole("button", { name: "Download" }),
    ).toBeInTheDocument();
  });
});
