import { z } from "zod";

export const goalEnum = z.enum(["LOSE_WEIGHT", "GAIN_MUSCLE", "MAINTAIN", "IMPROVE_CONDITIONING"]);
export const experienceLevelEnum = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
export const trainingPreferenceEnum = z.enum(["STRENGTH", "CARDIO", "HIIT", "FUNCTIONAL", "MIXED"]);
export const nutritionGoalEnum = z.enum(["LOSE_WEIGHT", "GAIN_MUSCLE", "MAINTAIN", "HEALTHY_EATING"]);

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "name must have at least 2 characters").max(120),
  email: z.string().trim().email("must be a valid email address"),
  age: z.number().int().min(13, "age must be at least 13").max(100),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updatePreferencesSchema = z.object({
  goal: goalEnum,
  experienceLevel: experienceLevelEnum,
  daysPerWeek: z.number().int().min(1).max(7),
  minutesPerSession: z.number().int().min(10).max(180),
  trainingPreference: trainingPreferenceEnum,
  dietaryRestrictions: z.array(z.string().trim().toLowerCase()).default([]),
  nutritionGoal: nutritionGoalEnum,
  likedFoods: z.array(z.string().trim()).default([]),
  dislikedFoods: z.array(z.string().trim()).default([]),
});
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid("id must be a valid UUID"),
});

export const userIdParamSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
});

export const generatePlanSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
});

export const generatePlanQuerySchema = z.object({
  simulateDelay: z.coerce.number().int().min(0).max(10_000).optional(),
});
