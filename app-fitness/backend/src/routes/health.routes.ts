import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { healthHandler } from "../controllers/healthController";

export const healthRouter = Router();

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Backend and database are healthy
 *       503:
 *         description: Database is unreachable
 */
healthRouter.get("/", asyncHandler(healthHandler));
