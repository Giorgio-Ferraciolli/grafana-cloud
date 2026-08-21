export interface GeneratedExercise {
  order: number;
  exerciseId: string;
  name: string;
  muscleGroup: string;
  sets: number;
  reps: string;
  restSeconds: number;
  notes: string;
}

export interface GeneratedWorkout {
  dayOfWeek:
    | "MONDAY"
    | "TUESDAY"
    | "WEDNESDAY"
    | "THURSDAY"
    | "FRIDAY"
    | "SATURDAY"
    | "SUNDAY";
  focus: string;
  isRestDay: boolean;
  exercises: GeneratedExercise[];
}

export interface GeneratedMealFood {
  foodId: string;
  name: string;
  quantityGrams: number;
}

export interface GeneratedMeal {
  type:
    | "BREAKFAST"
    | "MORNING_SNACK"
    | "LUNCH"
    | "AFTERNOON_SNACK"
    | "DINNER"
    | "SUPPER";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  foods: GeneratedMealFood[];
}
