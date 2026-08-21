import { prisma } from "../database/prismaClient";
import { NotFoundError } from "../utils/errors";
import { withSpan, sleep } from "../utils/tracing";
import { generateWorkoutPlan } from "./workoutGeneratorService";
import { generateDietPlan } from "./dietGeneratorService";
import { planGenerationDuration, plansGeneratedTotal } from "../metrics";
import { logger } from "../utils/logger";

export interface GeneratePlanOptions {
  simulateDelayMs?: number;
}

/**
 * The full "Gerar minha rotina" flow. Each step below is its own span so
 * the resulting trace mirrors the real sequence of work: validation, two
 * independent reads, two independent generation phases (each with their own
 * catalog lookup), and two writes.
 */
export async function generatePlan(userId: string, options: GeneratePlanOptions = {}) {
  const startedAt = Date.now();

  const result = await withSpan(
    "business.generate_plan",
    async () => {
      await withSpan("business.validate_user", async () => {
        const exists = await prisma.user.count({ where: { id: userId } });
        if (!exists) throw new NotFoundError("User");
      });

      const user = await withSpan("database.load_user", async () =>
        prisma.user.findUniqueOrThrow({ where: { id: userId } })
      );

      const preferences = await withSpan("database.load_preferences", async () => {
        const prefs = await prisma.userPreferences.findUnique({ where: { userId } });
        if (!prefs) {
          throw new NotFoundError("UserPreferences - set them via PUT /api/users/:id/preferences first");
        }
        return prefs;
      });

      if (options.simulateDelayMs) {
        await withSpan(
          "lab.simulate_delay",
          async () => {
            await sleep(options.simulateDelayMs as number);
          },
          { "lab.simulated": true, "lab.delay_ms": options.simulateDelayMs }
        );
      }

      const [workoutDays, meals] = await Promise.all([
        generateWorkoutPlan(preferences),
        generateDietPlan(preferences),
      ]);

      const workoutPlan = await withSpan("database.save_workout_plan", async () =>
        prisma.workoutPlan.create({
          data: {
            userId,
            workouts: {
              create: workoutDays.map((day) => ({
                dayOfWeek: day.dayOfWeek,
                focus: day.focus,
                isRestDay: day.isRestDay,
                exercises: {
                  create: day.exercises.map((ex) => ({
                    order: ex.order,
                    exerciseId: ex.exerciseId,
                    sets: ex.sets,
                    reps: ex.reps,
                    restSeconds: ex.restSeconds,
                    notes: ex.notes,
                  })),
                },
              })),
            },
          },
          include: { workouts: { include: { exercises: { include: { exercise: true } } } } },
        })
      );

      const dietPlan = await withSpan("database.save_diet_plan", async () =>
        prisma.dietPlan.create({
          data: {
            userId,
            meals: {
              create: meals.map((meal) => ({
                type: meal.type,
                calories: meal.calories,
                protein: meal.protein,
                carbs: meal.carbs,
                fat: meal.fat,
                foods: {
                  create: meal.foods.map((f) => ({
                    foodId: f.foodId,
                    quantityGrams: f.quantityGrams,
                  })),
                },
              })),
            },
          },
          include: { meals: { include: { foods: { include: { food: true } } } } },
        })
      );

      return { user, workoutPlan, dietPlan };
    },
    { "user.id": userId }
  );

  const durationMs = Date.now() - startedAt;
  plansGeneratedTotal.add(1, { "plan.user_id": userId });
  planGenerationDuration.record(durationMs);
  logger.info({ "user.id": userId, duration_ms: durationMs }, "plan generated");

  return result;
}

export async function getLatestPlanForUser(userId: string) {
  return withSpan("database.load_latest_plan", async () => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError("User");

    const [workoutPlan, dietPlan] = await Promise.all([
      prisma.workoutPlan.findFirst({
        where: { userId },
        orderBy: { generatedAt: "desc" },
        include: { workouts: { include: { exercises: { include: { exercise: true } } } } },
      }),
      prisma.dietPlan.findFirst({
        where: { userId },
        orderBy: { generatedAt: "desc" },
        include: { meals: { include: { foods: { include: { food: true } } } } },
      }),
    ]);

    return { user, workoutPlan, dietPlan };
  });
}

export async function getLatestWorkoutPlanForUser(userId: string) {
  return withSpan("database.load_workout_plan", async () => {
    const plan = await prisma.workoutPlan.findFirst({
      where: { userId },
      orderBy: { generatedAt: "desc" },
      include: { workouts: { include: { exercises: { include: { exercise: true } } } } },
    });
    if (!plan) throw new NotFoundError("WorkoutPlan");
    return plan;
  });
}

export async function getLatestDietPlanForUser(userId: string) {
  return withSpan("database.load_diet_plan", async () => {
    const plan = await prisma.dietPlan.findFirst({
      where: { userId },
      orderBy: { generatedAt: "desc" },
      include: { meals: { include: { foods: { include: { food: true } } } } },
    });
    if (!plan) throw new NotFoundError("DietPlan");
    return plan;
  });
}
