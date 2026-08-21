import { prisma } from "../database/prismaClient";
import { withSpan } from "../utils/tracing";

export async function listFoods() {
  return withSpan("database.load_foods", async () => prisma.food.findMany({ orderBy: { name: "asc" } }));
}

export async function loadFoodsByCategories(categories: string[]) {
  return withSpan(
    "database.load_foods",
    async () =>
      prisma.food.findMany({
        where: { category: { in: categories } },
        orderBy: { name: "asc" },
      }),
    { "food.categories": categories.join(",") }
  );
}
