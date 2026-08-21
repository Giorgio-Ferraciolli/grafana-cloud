import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { debugErrorHandler, debugSlowDbHandler } from "../controllers/debugController";

export const debugRouter = Router();

/**
 * @openapi
 * /api/debug/error:
 *   get:
 *     summary: "Lab: intentionally throws an unhandled error to produce a 500 response and an exception span"
 *     tags: [Lab]
 *     responses:
 *       500: { description: Intentional error }
 */
debugRouter.get("/error", asyncHandler(debugErrorHandler));

/**
 * @openapi
 * /api/debug/slow-db:
 *   get:
 *     summary: "Lab: runs a real MySQL SELECT SLEEP() to simulate a slow database query"
 *     tags: [Lab]
 *     parameters:
 *       - in: query
 *         name: delayMs
 *         schema: { type: integer }
 *         description: Milliseconds to sleep inside the database (clamped to 5000ms max)
 *     responses:
 *       200: { description: Slow query completed }
 */
debugRouter.get("/slow-db", asyncHandler(debugSlowDbHandler));
