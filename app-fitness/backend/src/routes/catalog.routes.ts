import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { listExercisesHandler, listFoodsHandler } from "../controllers/catalogController";

export const exercisesRouter = Router();
export const foodsRouter = Router();

/**
 * @openapi
 * /api/exercises:
 *   get:
 *     summary: List the exercise catalog
 *     tags: [Catalog]
 *     responses:
 *       200: { description: List of exercises }
 */
exercisesRouter.get("/", asyncHandler(listExercisesHandler));

/**
 * @openapi
 * /api/foods:
 *   get:
 *     summary: List the food catalog
 *     tags: [Catalog]
 *     responses:
 *       200: { description: List of foods }
 */
foodsRouter.get("/", asyncHandler(listFoodsHandler));
