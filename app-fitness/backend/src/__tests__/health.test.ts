import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../database/prismaClient";

const app = createApp();

describe("GET /api/health", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns 200 and reports the database as connected", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.database).toBe("connected");
    expect(res.body).toHaveProperty("timestamp");
  });
});
