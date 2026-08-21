export type Goal = "LOSE_WEIGHT" | "GAIN_MUSCLE" | "MAINTAIN" | "IMPROVE_CONDITIONING";
export type ExperienceLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type TrainingPreference = "STRENGTH" | "CARDIO" | "HIIT" | "FUNCTIONAL" | "MIXED";
export type NutritionGoal = "LOSE_WEIGHT" | "GAIN_MUSCLE" | "MAINTAIN" | "HEALTHY_EATING";
export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";
export type MealType =
  | "BREAKFAST"
  | "MORNING_SNACK"
  | "LUNCH"
  | "AFTERNOON_SNACK"
  | "DINNER"
  | "SUPPER";

export interface UserPreferences {
  id: string;
  userId: string;
  goal: Goal;
  experienceLevel: ExperienceLevel;
  daysPerWeek: number;
  minutesPerSession: number;
  trainingPreference: TrainingPreference;
  dietaryRestrictions: string[];
  nutritionGoal: NutritionGoal;
  likedFoods: string[];
  dislikedFoods: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  createdAt: string;
  preferences?: UserPreferences | null;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  difficulty: ExperienceLevel;
  description: string | null;
}

export interface WorkoutExerciseEntry {
  id: string;
  order: number;
  sets: number;
  reps: string;
  restSeconds: number;
  notes: string | null;
  exercise: Exercise;
}

export interface Workout {
  id: string;
  dayOfWeek: DayOfWeek;
  focus: string;
  isRestDay: boolean;
  exercises: WorkoutExerciseEntry[];
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  generatedAt: string;
  workouts: Workout[];
}

export interface Food {
  id: string;
  name: string;
  category: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  tags: string[];
}

export interface MealFoodEntry {
  id: string;
  quantityGrams: number;
  food: Food;
}

export interface Meal {
  id: string;
  type: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  foods: MealFoodEntry[];
}

export interface DietPlan {
  id: string;
  userId: string;
  generatedAt: string;
  meals: Meal[];
}

export interface FullPlan {
  user: User;
  workoutPlan: WorkoutPlan | null;
  dietPlan: DietPlan | null;
}
