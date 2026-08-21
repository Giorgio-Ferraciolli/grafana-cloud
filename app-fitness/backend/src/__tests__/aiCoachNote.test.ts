import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createApp } from "../app";
import { prisma } from "../database/prismaClient";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: createMock },
  })),
}));

const app = createApp();

let userId: string;

describe("POST /api/plans/:userId/ai-coach-note", () => {
  beforeAll(async () => {
    const userRes = await request(app)
      .post("/api/users")
      .send({ name: "Coach Note User", email: `coach-${randomUUID()}@example.com`, age: 30 });
    userId = userRes.body.id;

    await request(app).put(`/api/users/${userId}/preferences`).send({
      goal: "MAINTAIN",
      experienceLevel: "INTERMEDIATE",
      daysPerWeek: 3,
      minutesPerSession: 45,
      trainingPreference: "MIXED",
      dietaryRestrictions: [],
      nutritionGoal: "MAINTAIN",
      likedFoods: [],
      dislikedFoods: [],
    });

    await request(app).post("/api/plans/generate").send({ userId });
  });

  afterAll(async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await prisma.$disconnect();
  });

  it("returns 503 when ANTHROPIC_API_KEY is not configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const res = await request(app).post(`/api/plans/${userId}/ai-coach-note`);

    expect(res.status).toBe(503);
  });

  it("generates a note through the agento11y Anthropic wrapper", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    createMock.mockResolvedValueOnce({
      id: "msg_test123",
      model: "claude-sonnet-4-5",
      stop_reason: "end_turn",
      usage: { input_tokens: 42, output_tokens: 21 },
      content: [{ type: "text", text: "Mande bem essa semana!" }],
    });

    const res = await request(app).post(`/api/plans/${userId}/ai-coach-note`);

    expect(res.status).toBe(200);
    expect(res.body.note).toBe("Mande bem essa semana!");
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][0].model).toBe("claude-sonnet-4-5");
  });

  it("returns 404 when the user has no generated plan yet", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const otherUserRes = await request(app)
      .post("/api/users")
      .send({ name: "No Plan User", email: `noplan-${randomUUID()}@example.com`, age: 22 });

    const res = await request(app).post(`/api/plans/${otherUserRes.body.id}/ai-coach-note`);

    expect(res.status).toBe(404);
  });
});
