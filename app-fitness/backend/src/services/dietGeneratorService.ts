import { Food, UserPreferences } from "@prisma/client";
import { loadFoodsByCategories } from "./foodService";
import { withSpan } from "../utils/tracing";
import type { GeneratedMeal, GeneratedMealFood } from "../types/domain";

const MEAL_TYPES = [
  "BREAKFAST",
  "MORNING_SNACK",
  "LUNCH",
  "AFTERNOON_SNACK",
  "DINNER",
  "SUPPER",
] as const;

const MEAL_CALORIE_SHARE: Record<(typeof MEAL_TYPES)[number], number> = {
  BREAKFAST: 0.2,
  MORNING_SNACK: 0.1,
  LUNCH: 0.3,
  AFTERNOON_SNACK: 0.1,
  DINNER: 0.25,
  SUPPER: 0.05,
};

const MEAL_CATEGORIES: Record<(typeof MEAL_TYPES)[number], string[]> = {
  BREAKFAST: ["breakfast", "dairy", "fruit"],
  MORNING_SNACK: ["fruit", "snack"],
  LUNCH: ["protein", "carb", "vegetable"],
  AFTERNOON_SNACK: ["snack", "fruit", "dairy"],
  DINNER: ["protein", "carb", "vegetable"],
  SUPPER: ["dairy", "fruit"],
};

const CALORIE_TARGET_BY_GOAL: Record<string, number> = {
  LOSE_WEIGHT: 1800,
  MAINTAIN: 2200,
  GAIN_MUSCLE: 2800,
  HEALTHY_EATING: 2000,
};

const RESTRICTION_EXCLUDED_TAGS: Record<string, string[]> = {
  vegetarian: ["meat", "fish"],
  vegan: ["meat", "fish", "dairy", "egg"],
  lactose_free: ["dairy"],
  gluten_free: ["gluten"],
};

// Caps how many grams of a single food a meal can lean on. Without this, a
// low-calorie-density food (e.g. a vegetable at 17 kcal/100g) ends up with
// an implausible portion (1kg+) just to hit the meal's calorie target.
const MAX_GRAMS_BY_CATEGORY: Record<string, number> = {
  protein: 300,
  carb: 300,
  vegetable: 250,
  fruit: 250,
  dairy: 300,
  fat: 40,
  snack: 150,
  breakfast: 250,
};
const DEFAULT_MAX_GRAMS = 300;
const MIN_GRAMS = 10;

function isFoodAllowed(food: Food, restrictions: string[], dislikedFoods: string[]): boolean {
  const tags = (food.tags as string[]) ?? [];
  const nameLower = food.name.toLowerCase();

  if (dislikedFoods.some((disliked) => nameLower.includes(disliked.toLowerCase()))) {
    return false;
  }

  return !restrictions.some((restriction) => {
    const excludedTags = RESTRICTION_EXCLUDED_TAGS[restriction] ?? [];
    return excludedTags.some((tag) => tags.includes(tag));
  });
}

function pickFoodsForMeal(candidates: Food[], likedFoods: string[]): Food[] {
  const likedLower = likedFoods.map((f) => f.toLowerCase());
  const sorted = [...candidates].sort((a, b) => {
    const aLiked = likedLower.some((liked) => a.name.toLowerCase().includes(liked)) ? 0 : 1;
    const bLiked = likedLower.some((liked) => b.name.toLowerCase().includes(liked)) ? 0 : 1;
    return aLiked - bLiked;
  });
  return sorted.slice(0, Math.min(3, Math.max(2, sorted.length)));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Builds the six daily meals for the given preferences, distributing a
 * goal-based calorie target across meals and picking real Food rows from
 * the catalog that respect dietary restrictions and dislikes.
 */
export async function generateDietPlan(preferences: UserPreferences): Promise<GeneratedMeal[]> {
  return withSpan(
    "business.generate_diet_plan",
    async () => {
      const dailyCalories = CALORIE_TARGET_BY_GOAL[preferences.nutritionGoal] ?? CALORIE_TARGET_BY_GOAL.MAINTAIN;
      const restrictions = (preferences.dietaryRestrictions as string[]) ?? [];
      const likedFoods = (preferences.likedFoods as string[]) ?? [];
      const dislikedFoods = (preferences.dislikedFoods as string[]) ?? [];

      const meals: GeneratedMeal[] = [];

      for (const mealType of MEAL_TYPES) {
        const mealCalorieTarget = dailyCalories * MEAL_CALORIE_SHARE[mealType];
        const candidates = await loadFoodsByCategories(MEAL_CATEGORIES[mealType]);
        const allowed = candidates.filter((food) => isFoodAllowed(food, restrictions, dislikedFoods));
        const chosen = pickFoodsForMeal(allowed.length ? allowed : candidates, likedFoods);

        const caloriePerFood = mealCalorieTarget / Math.max(1, chosen.length);
        const foods: GeneratedMealFood[] = [];
        let calories = 0;
        let protein = 0;
        let carbs = 0;
        let fat = 0;

        for (const food of chosen) {
          const rawQuantity = (caloriePerFood / food.caloriesPer100g) * 100;
          const maxGrams = MAX_GRAMS_BY_CATEGORY[food.category] ?? DEFAULT_MAX_GRAMS;
          const quantityGrams = round1(Math.min(Math.max(rawQuantity, MIN_GRAMS), maxGrams));
          foods.push({ foodId: food.id, name: food.name, quantityGrams });
          const factor = quantityGrams / 100;
          calories += food.caloriesPer100g * factor;
          protein += food.proteinPer100g * factor;
          carbs += food.carbsPer100g * factor;
          fat += food.fatPer100g * factor;
        }

        meals.push({
          type: mealType,
          calories: round1(calories),
          protein: round1(protein),
          carbs: round1(carbs),
          fat: round1(fat),
          foods,
        });
      }

      return meals;
    },
    { "diet.nutrition_goal": preferences.nutritionGoal }
  );
}
