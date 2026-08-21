import { prisma } from "../database/prismaClient";
import { withSpan } from "../utils/tracing";

export async function listExercises() {
  return withSpan("database.load_exercises", async () =>
    prisma.exercise.findMany({ orderBy: { name: "asc" } })
  );
}

export async function loadExercisesByMuscleGroups(muscleGroups: string[]) {
  return withSpan(
    "database.load_exercises",
    async () =>
      prisma.exercise.findMany({
        where: { muscleGroup: { in: muscleGroups as never[] } },
        orderBy: { name: "asc" },
      }),
    { "exercise.muscle_groups": muscleGroups.join(",") }
  );
}
