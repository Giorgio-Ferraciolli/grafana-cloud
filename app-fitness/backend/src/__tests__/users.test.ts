import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createApp } from "../app";
import { prisma } from "../database/prismaClient";

const app = createApp();

function uniqueEmail() {
  return `test-${randomUUID()}@example.com`;
}

describe("Users API", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a user and returns 201 with the persisted record", async () => {
    const email = uniqueEmail();
    const res = await request(app).post("/api/users").send({ name: "Test User", email, age: 30 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Test User", email, age: 30 });
    expect(res.body).toHaveProperty("id");
  });

  it("rejects a payload with an invalid email with 400", async () => {
    const res = await request(app).post("/api/users").send({ name: "Test User", email: "not-an-email", age: 30 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
  });

  it("rejects a payload missing required fields with 400", async () => {
    const res = await request(app).post("/api/users").send({ email: uniqueEmail() });

    expect(res.status).toBe(400);
  });

  it("fetches a previously created user by id", async () => {
    const email = uniqueEmail();
    const created = await request(app).post("/api/users").send({ name: "Fetch Me", email, age: 22 });

    const res = await request(app).get(`/api/users/${created.body.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.email).toBe(email);
  });

  it("returns 404 for a user id that does not exist", async () => {
    const res = await request(app).get(`/api/users/${randomUUID()}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("NotFoundError");
  });
});
