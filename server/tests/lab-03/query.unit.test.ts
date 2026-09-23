import { describe, expect, it } from "vitest";

import {
  parseStaffTicketQuery,
  StaffQueueQueryValidationError,
} from "../../src/services/staff-ticket-query-service.js";

describe("parseStaffTicketQuery", () => {
  it("applies the documented defaults and parses every staff filter", () => {
    expect(
      parseStaffTicketQuery({
        search: "  VPN  ",
        categoryId: "2",
        relatedSystemId: "3",
        requestedPriority: "HIGH",
        itPriority: "MEDIUM",
        currentStatus: "OPEN",
        owner: "unassigned",
        sortBy: "owner",
        sortDirection: "asc",
        page: "2",
        pageSize: "20",
      }),
    ).toEqual({
      search: "VPN",
      categoryId: 2,
      relatedSystemId: 3,
      requestedPriority: "HIGH",
      itPriority: "MEDIUM",
      currentStatus: "OPEN",
      owner: "unassigned",
      sortBy: "owner",
      sortDirection: "asc",
      page: 2,
      pageSize: 20,
    });

    expect(parseStaffTicketQuery({})).toEqual({
      search: "",
      categoryId: undefined,
      relatedSystemId: undefined,
      requestedPriority: undefined,
      itPriority: undefined,
      currentStatus: undefined,
      owner: undefined,
      sortBy: "updatedAt",
      sortDirection: "desc",
      page: 1,
      pageSize: 10,
    });
  });

  it.each([
    ["search", "x".repeat(121)],
    ["categoryId", "0"],
    ["itPriority", "URGENT"],
    ["currentStatus", "UNKNOWN"],
    ["owner", "REQUESTER"],
    ["sortBy", "summary"],
    ["sortDirection", "up"],
    ["page", "0"],
    ["pageSize", "15"],
  ])("rejects an invalid %s", (field, value) => {
    expect(() => parseStaffTicketQuery({ [field]: value })).toThrow(
      StaffQueueQueryValidationError,
    );
  });

  it("accepts the current-user owner filter and rejects repeated values", () => {
    expect(parseStaffTicketQuery({ owner: "me" }).owner).toBe("me");
    expect(parseStaffTicketQuery({ owner: "21" }).owner).toBe(21);
    expect(() =>
      parseStaffTicketQuery({ owner: ["me", "unassigned"] }),
    ).toThrow(StaffQueueQueryValidationError);
  });
});
