import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../database/prismaClient";

const app = createApp();

describe("Error handling", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns 404 for an unknown route", async () => {
    const res = await request(app).get("/api/this-route-does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("NotFound");
  });

  it("returns 500 for the intentional lab error endpoint", async () => {
    const res = await request(app).get("/api/debug/error");

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("message");
  });

  it("never leaks a stack trace in the error response outside development", async () => {
    const res = await request(app).get("/api/debug/error");

    expect(res.body.message).not.toMatch(/at debugErrorHandler/);
  });
});
