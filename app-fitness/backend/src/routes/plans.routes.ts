import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { validate } from "../middlewares/validate";
import { generatePlanHandler, getAiCoachNoteHandler, getPlanHandler } from "../controllers/planController";
import { generatePlanQuerySchema, generatePlanSchema, userIdParamSchema } from "../validation/schemas";

export const plansRouter = Router();

/**
 * @openapi
 * /api/plans/generate:
 *   post:
 *     summary: Generate a new workout + diet plan for a user (the main "Gerar minha rotina" action)
 *     tags: [Plans]
 *     parameters:
 *       - in: query
 *         name: simulateDelay
 *         schema: { type: integer }
 *         description: "Lab feature: adds this many milliseconds of artificial latency (max 10000) to produce a slow trace."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId: { type: string, format: uuid }
 *     responses:
 *       201: { description: Plan generated }
 *       404: { description: User or preferences not found }
 */
plansRouter.post(
  "/generate",
  validate(generatePlanQuerySchema, "query"),
  validate(generatePlanSchema),
  asyncHandler(generatePlanHandler)
);

/**
 * @openapi
 * /api/plans/{userId}:
 *   get:
 *     summary: Get the latest generated workout + diet plan for a user
 *     tags: [Plans]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Plan found }
 *       404: { description: User not found }
 */
plansRouter.get("/:userId", validate(userIdParamSchema, "params"), asyncHandler(getPlanHandler));

/**
 * @openapi
 * /api/plans/{userId}/ai-coach-note:
 *   post:
 *     summary: Generate a short AI coaching note for the user's latest plan (Claude, via Agent Observability)
 *     tags: [Plans]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Coaching note generated }
 *       404: { description: User or plan not found }
 */
plansRouter.post(
  "/:userId/ai-coach-note",
  validate(userIdParamSchema, "params"),
  asyncHandler(getAiCoachNoteHandler)
);
