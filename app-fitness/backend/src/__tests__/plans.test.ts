import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createApp } from "../app";
import { prisma } from "../database/prismaClient";

const app = createApp();

let userId: string;

describe("Plan generation flow", () => {
  beforeAll(async () => {
    const userRes = await request(app)
      .post("/api/users")
      .send({ name: "Plan Test User", email: `plan-${randomUUID()}@example.com`, age: 26 });
    userId = userRes.body.id;

    await request(app).put(`/api/users/${userId}/preferences`).send({
      goal: "GAIN_MUSCLE",
      experienceLevel: "INTERMEDIATE",
      daysPerWeek: 4,
      minutesPerSession: 45,
      trainingPreference: "STRENGTH",
      dietaryRestrictions: [],
      nutritionGoal: "GAIN_MUSCLE",
      likedFoods: [],
      dislikedFoods: [],
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("generates a full workout + diet plan with 7 days and 6 meals", async () => {
    const res = await request(app).post("/api/plans/generate").send({ userId });

    expect(res.status).toBe(201);
    expect(res.body.workoutPlan.workouts).toHaveLength(7);
    expect(res.body.dietPlan.meals).toHaveLength(6);
  });

  it("returns the latest generated plan for the user", async () => {
    await request(app).post("/api/plans/generate").send({ userId });

    const res = await request(app).get(`/api/plans/${userId}`);

    expect(res.status).toBe(200);
    expect(res.body.workoutPlan).not.toBeNull();
    expect(res.body.dietPlan).not.toBeNull();
  });

  it("returns 404 when generating a plan without preferences set", async () => {
    const userRes = await request(app)
      .post("/api/users")
      .send({ name: "No Prefs User", email: `no-prefs-${randomUUID()}@example.com`, age: 40 });

    const res = await request(app).post("/api/plans/generate").send({ userId: userRes.body.id });

    expect(res.status).toBe(404);
  });

  it("returns 400 when userId is not a valid uuid", async () => {
    const res = await request(app).post("/api/plans/generate").send({ userId: "not-a-uuid" });

    expect(res.status).toBe(400);
  });
});
