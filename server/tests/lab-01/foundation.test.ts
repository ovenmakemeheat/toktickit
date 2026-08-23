import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../src/app.js";
import { env } from "../../src/env.js";

describe("TokTickIT foundation", () => {
  it("exports an Express app that answers without binding a listener", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ service: "TokTickIT API" });
  });

  it("validates the development and test database configuration", () => {
    expect(env.DATABASE_URL).toContain("toktickit_test");
    expect(env.TEST_DATABASE_URL).toContain("toktickit_test");
    expect(env.PORT).toBe(3001);
  });
});
