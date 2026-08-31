import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEffect, type ReactNode } from "react";

import RequesterTicketDetail from "../../src/lab-02/RequesterTicketDetail";
import {
  DevelopmentRequesterProvider,
  useDevelopmentRequester,
} from "../../src/lab-02/requester-context";

type MockResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
  blob?: () => Promise<Blob>;
};

const requester = {
  id: 1,
  name: "Requester A",
  email: "requester-a@toktickit.test",
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

const ticket = {
  id: 101,
  ticketNumber: "TT-20260829-ABC123",
  ticketDate: "2026-08-29T08:00:00.000Z",
  requester: { id: 1, name: "Requester A" },
  category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 4, name: "VPN" },
  requestedPriority: "HIGH",
  summary: "VPN connection fails",
  description: "The VPN connection fails after entering the credentials.",
  currentStatus: "NEW",
  createdAt: "2026-08-29T08:00:00.000Z",
  lastUpdated: "2026-08-29T08:00:00.000Z",
  attachments: [activeAttachment, removedAttachment],
};

function response(payload: unknown, ok = true): MockResponse {
  return {
    ok,
    json: async () => payload,
  };
}

function SelectRequester({ children }: { children: ReactNode }) {
  const { selectRequester } = useDevelopmentRequester();

  useEffect(() => {
    selectRequester(requester);
  }, [selectRequester]);

  return children;
}

function renderDetail() {
  const onBack = vi.fn();
  render(
    <DevelopmentRequesterProvider>
      <SelectRequester>
        <RequesterTicketDetail ticketId={101} onBack={onBack} />
      </SelectRequester>
    </DevelopmentRequesterProvider>,
  );
  return onBack;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Issue #55 Requester Ticket Detail", () => {
  it("renders owned ticket fields read-only and separates active and removed attachments", async () => {
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, _options?: RequestInit) => {
        expect(String(input)).toBe("/api/tickets/101");
        return Promise.resolve(response(ticket));
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const onBack = renderDetail();

    expect(
      await screen.findByRole("heading", { name: "TT-20260829-ABC123" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Summary")).toHaveValue(
      "VPN connection fails",
    );
    expect(screen.getByLabelText("Summary")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Description")).toHaveAttribute("readonly");
    expect(screen.getByText("evidence.png")).toBeInTheDocument();
    expect(screen.getByText("old-evidence.pdf")).toBeInTheDocument();
    expect(screen.getByText(/Contains obsolete evidence/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Download" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    expect(screen.queryByText("Preview")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Back to My Tickets" }),
    ).toBeInTheDocument();

    const detailCall = fetchMock.mock.calls[0];
    expect(detailCall?.[1]).toEqual({
      headers: { "X-Development-Requester-Id": "1" },
    });

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Back to My Tickets" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("shows a safe recoverable failure for an unavailable or cross-requester Ticket", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        response(
          {
            error: {
              code: "TICKET_NOT_FOUND",
              message: "Ticket was not found",
            },
          },
          false,
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderDetail();

    expect(
      await screen.findByText(
        "Unable to connect to TokTickIT API. This Ticket could not be loaded.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ticket was not found")).not.toBeInTheDocument();
  });

  it("keeps upload success feedback visible while refreshing the Ticket", async () => {
    const refreshedTicket = {
      ...ticket,
      lastUpdated: "2026-08-29T10:00:00.000Z",
      attachments: [
        ...ticket.attachments,
        { ...activeAttachment, id: 203, displayName: "new-evidence.png" },
      ],
    };
    let detailRequests = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/tickets/101") {
        detailRequests += 1;
        return Promise.resolve(
          response(detailRequests === 1 ? ticket : refreshedTicket),
        );
      }
      if (url === "/api/tickets/101/attachments") {
        return Promise.resolve(response(activeAttachment));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderDetail();
    await screen.findByRole("heading", { name: "TT-20260829-ABC123" });
    await user.upload(
      screen.getByLabelText("Upload attachment"),
      new File(["image"], "new-evidence.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("button", { name: "Upload attachment" }));

    expect(
      await screen.findByText("Attachment uploaded successfully."),
    ).toBeInTheDocument();
    expect(detailRequests).toBe(2);
    expect(screen.getByText("new-evidence.png")).toBeInTheDocument();
  });
});
