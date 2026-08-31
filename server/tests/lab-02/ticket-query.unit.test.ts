import { describe, expect, it } from "vitest";

import {
  parseTicketQuery,
  TicketQueryValidationError,
} from "../../src/services/ticket-query-service.js";

describe("parseTicketQuery", () => {
  it("applies the documented defaults and trims search", () => {
    expect(parseTicketQuery({ search: "  VPN failure  " })).toEqual({
      search: "VPN failure",
      categoryId: undefined,
      relatedSystemId: undefined,
      requestedPriority: undefined,
      currentStatus: undefined,
      sortBy: "ticketDate",
      sortDirection: "desc",
      page: 1,
      pageSize: 10,
    });
  });

  it("parses every supported filter, sort, and pagination value", () => {
    expect(
      parseTicketQuery({
        search: "vpn",
        categoryId: "2",
        relatedSystemId: "3",
        requestedPriority: "HIGH",
        currentStatus: "NEW",
        sortBy: "summary",
        sortDirection: "asc",
        page: "2",
        pageSize: "20",
      }),
    ).toEqual({
      search: "vpn",
      categoryId: 2,
      relatedSystemId: 3,
      requestedPriority: "HIGH",
      currentStatus: "NEW",
      sortBy: "summary",
      sortDirection: "asc",
      page: 2,
      pageSize: 20,
    });
  });

  it.each([
    ["search", "x".repeat(121)],
    ["categoryId", "0"],
    ["relatedSystemId", "not-an-id"],
    ["requestedPriority", "URGENT"],
    ["currentStatus", "OPEN"],
    ["sortBy", "createdAt"],
    ["sortDirection", "up"],
    ["page", "0"],
    ["pageSize", "15"],
  ])("rejects an invalid %s", (field, value) => {
    expect(() => parseTicketQuery({ [field]: value })).toThrow(
      TicketQueryValidationError,
    );
  });

  it("rejects repeated or unknown query values instead of guessing", () => {
    expect(() => parseTicketQuery({ search: ["one", "two"] })).toThrow(
      TicketQueryValidationError,
    );
    expect(() => parseTicketQuery({ unsupported: "value" })).toThrow(
      TicketQueryValidationError,
    );
  });
});
