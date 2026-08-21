import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { validate } from "../middlewares/validate";
import { getDietPlanHandler } from "../controllers/planController";
import { userIdParamSchema } from "../validation/schemas";

export const dietRouter = Router();

/**
 * @openapi
 * /api/diet/{userId}:
 *   get:
 *     summary: Get the latest diet plan for a user
 *     tags: [Diet]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Diet plan found }
 *       404: { description: Diet plan not found }
 */
dietRouter.get("/:userId", validate(userIdParamSchema, "params"), asyncHandler(getDietPlanHandler));
