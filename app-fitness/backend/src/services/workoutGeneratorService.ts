import { UserPreferences } from "@prisma/client";
import { loadExercisesByMuscleGroups } from "./exerciseService";
import { withSpan } from "../utils/tracing";
import type { GeneratedExercise, GeneratedWorkout } from "../types/domain";

const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

// Deterministic weekly training-day layout per days-per-week. Index 0 = Monday.
const WEEK_TEMPLATES: Record<number, boolean[]> = {
  1: [true, false, false, false, false, false, false],
  2: [true, false, false, true, false, false, false],
  3: [true, false, true, false, true, false, false],
  4: [true, false, true, true, true, false, false],
  5: [true, true, false, true, true, true, false],
  6: [true, true, true, true, true, true, false],
  7: [true, true, true, true, true, true, true],
};

const FOCUS_POOLS: Record<string, { focus: string; muscleGroups: string[] }[]> = {
  STRENGTH: [
    { focus: "Peito + Tríceps", muscleGroups: ["CHEST", "TRICEPS"] },
    { focus: "Costas + Bíceps", muscleGroups: ["BACK", "BICEPS"] },
    { focus: "Pernas", muscleGroups: ["LEGS", "GLUTES"] },
    { focus: "Ombros + Core", muscleGroups: ["SHOULDERS", "CORE"] },
    { focus: "Full Body", muscleGroups: ["FULL_BODY", "CHEST", "BACK", "LEGS"] },
  ],
  CARDIO: [
    { focus: "Cardio Contínuo", muscleGroups: ["CARDIO"] },
    { focus: "Cardio Intervalado", muscleGroups: ["CARDIO", "CORE"] },
    { focus: "Cardio + Core", muscleGroups: ["CARDIO", "CORE"] },
    { focus: "Cardio + Mobilidade", muscleGroups: ["CARDIO", "FULL_BODY"] },
  ],
  HIIT: [
    { focus: "HIIT Full Body", muscleGroups: ["FULL_BODY", "CARDIO"] },
    { focus: "HIIT Inferior", muscleGroups: ["LEGS", "GLUTES", "CARDIO"] },
    { focus: "HIIT Superior", muscleGroups: ["CHEST", "BACK", "SHOULDERS"] },
    { focus: "HIIT Core", muscleGroups: ["CORE", "CARDIO"] },
  ],
  FUNCTIONAL: [
    { focus: "Funcional Full Body", muscleGroups: ["FULL_BODY", "CORE"] },
    { focus: "Funcional Inferior", muscleGroups: ["LEGS", "GLUTES", "CORE"] },
    { focus: "Funcional Superior", muscleGroups: ["CHEST", "BACK", "SHOULDERS"] },
    { focus: "Mobilidade + Core", muscleGroups: ["CORE", "FULL_BODY"] },
  ],
};
FOCUS_POOLS.MIXED = [FOCUS_POOLS.STRENGTH[0], FOCUS_POOLS.CARDIO[0], FOCUS_POOLS.STRENGTH[1], FOCUS_POOLS.HIIT[0], FOCUS_POOLS.STRENGTH[2]];

function exerciseCountFor(minutesPerSession: number): number {
  if (minutesPerSession <= 30) return 3;
  if (minutesPerSession <= 45) return 4;
  if (minutesPerSession <= 60) return 5;
  return 6;
}

function setsRepsRestFor(goal: string, experienceLevel: string) {
  const byGoal: Record<string, { sets: number; reps: string; restSeconds: number }> = {
    GAIN_MUSCLE: { sets: 4, reps: "8-12", restSeconds: 90 },
    LOSE_WEIGHT: { sets: 3, reps: "12-15", restSeconds: 45 },
    MAINTAIN: { sets: 3, reps: "10-12", restSeconds: 60 },
    IMPROVE_CONDITIONING: { sets: 3, reps: "15-20", restSeconds: 30 },
  };
  const base = byGoal[goal] ?? byGoal.MAINTAIN;
  const sets =
    experienceLevel === "BEGINNER"
      ? Math.max(2, base.sets - 1)
      : experienceLevel === "ADVANCED"
      ? base.sets + 1
      : base.sets;
  return { ...base, sets };
}

/**
 * Builds a full 7-day workout plan for the given preferences. Runs a real
 * database query per unique focus (load_exercises) so the resulting trace
 * shows the actual exercise-catalog lookups behind each training day.
 */
export async function generateWorkoutPlan(preferences: UserPreferences): Promise<GeneratedWorkout[]> {
  return withSpan(
    "business.generate_workout_plan",
    async () => {
      const template = WEEK_TEMPLATES[preferences.daysPerWeek] ?? WEEK_TEMPLATES[3];
      const pool = FOCUS_POOLS[preferences.trainingPreference] ?? FOCUS_POOLS.STRENGTH;
      const exerciseCount = exerciseCountFor(preferences.minutesPerSession);
      const { sets, reps, restSeconds } = setsRepsRestFor(preferences.goal, preferences.experienceLevel);

      const workouts: GeneratedWorkout[] = [];
      let trainingDayIndex = 0;

      for (let i = 0; i < 7; i += 1) {
        const isTrainingDay = template[i];
        if (!isTrainingDay) {
          workouts.push({ dayOfWeek: DAYS[i], focus: "Descanso", isRestDay: true, exercises: [] });
          continue;
        }

        const focusDef = pool[trainingDayIndex % pool.length];
        trainingDayIndex += 1;

        const candidates = await loadExercisesByMuscleGroups(focusDef.muscleGroups);
        const chosen = candidates.length
          ? Array.from({ length: exerciseCount }, (_, idx) => candidates[idx % candidates.length])
          : [];

        const exercises: GeneratedExercise[] = chosen.map((exercise, order) => ({
          order,
          exerciseId: exercise.id,
          name: exercise.name,
          muscleGroup: exercise.muscleGroup,
          sets,
          reps,
          restSeconds,
          notes:
            preferences.experienceLevel === "BEGINNER"
              ? "Priorize a execução correta antes de aumentar a carga."
              : "Ajuste a carga para atingir a falha próxima da última repetição.",
        }));

        workouts.push({ dayOfWeek: DAYS[i], focus: focusDef.focus, isRestDay: false, exercises });
      }

      return workouts;
    },
    {
      "workout.days_per_week": preferences.daysPerWeek,
      "workout.training_preference": preferences.trainingPreference,
    }
  );
}
