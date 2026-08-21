import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { validate } from "../middlewares/validate";
import { createUserHandler, getUserHandler, updatePreferencesHandler } from "../controllers/userController";
import { createUserSchema, idParamSchema, updatePreferencesSchema } from "../validation/schemas";

export const usersRouter = Router();

/**
 * @openapi
 * /api/users:
 *   post:
 *     summary: Create a user profile
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, age]
 *             properties:
 *               name: { type: string, example: "Ana Souza" }
 *               email: { type: string, example: "ana@example.com" }
 *               age: { type: integer, example: 28 }
 *     responses:
 *       201: { description: User created }
 *       400: { description: Validation error }
 */
usersRouter.post("/", validate(createUserSchema), asyncHandler(createUserHandler));

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     summary: Get a user by id
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: User found }
 *       404: { description: User not found }
 */
usersRouter.get("/:id", validate(idParamSchema, "params"), asyncHandler(getUserHandler));

/**
 * @openapi
 * /api/users/{id}/preferences:
 *   put:
 *     summary: Create or update a user's training and nutrition preferences
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [goal, experienceLevel, daysPerWeek, minutesPerSession, trainingPreference, nutritionGoal]
 *             properties:
 *               goal: { type: string, enum: [LOSE_WEIGHT, GAIN_MUSCLE, MAINTAIN, IMPROVE_CONDITIONING] }
 *               experienceLevel: { type: string, enum: [BEGINNER, INTERMEDIATE, ADVANCED] }
 *               daysPerWeek: { type: integer, example: 4 }
 *               minutesPerSession: { type: integer, example: 45 }
 *               trainingPreference: { type: string, enum: [STRENGTH, CARDIO, HIIT, FUNCTIONAL, MIXED] }
 *               dietaryRestrictions: { type: array, items: { type: string }, example: ["vegetarian"] }
 *               nutritionGoal: { type: string, enum: [LOSE_WEIGHT, GAIN_MUSCLE, MAINTAIN, HEALTHY_EATING] }
 *               likedFoods: { type: array, items: { type: string } }
 *               dislikedFoods: { type: array, items: { type: string } }
 *     responses:
 *       200: { description: Preferences saved }
 *       404: { description: User not found }
 */
usersRouter.put(
  "/:id/preferences",
  validate(idParamSchema, "params"),
  validate(updatePreferencesSchema),
  asyncHandler(updatePreferencesHandler)
);
