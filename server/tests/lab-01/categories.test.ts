import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loginAgent, prepareLab3Data, prisma } from "../lab-03/test-helpers.js";

describe("API category list", () => {
  let agent: Awaited<ReturnType<typeof loginAgent>>;

  beforeAll(async () => {
    await prepareLab3Data();
    agent = await loginAgent("requester-a@toktickit.test");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns seeded categories as ID/name pairs in ascending ID order", async () => {
    const response = await agent.agent.get("/api/categories");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: expect.any(Number), name: "Account and Access" },
      { id: expect.any(Number), name: "Hardware" },
      { id: expect.any(Number), name: "Software" },
      { id: expect.any(Number), name: "Network" },
    ]);

    const ids = response.body.map((category: { id: number }) => category.id);
    expect(ids).toEqual([...ids].sort((left, right) => left - right));
  });
});
