import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { validate } from "../middlewares/validate";
import { getWorkoutPlanHandler } from "../controllers/planController";
import { userIdParamSchema } from "../validation/schemas";

export const workoutsRouter = Router();

/**
 * @openapi
 * /api/workouts/{userId}:
 *   get:
 *     summary: Get the latest workout plan for a user
 *     tags: [Workouts]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Workout plan found }
 *       404: { description: Workout plan not found }
 */
workoutsRouter.get("/:userId", validate(userIdParamSchema, "params"), asyncHandler(getWorkoutPlanHandler));
