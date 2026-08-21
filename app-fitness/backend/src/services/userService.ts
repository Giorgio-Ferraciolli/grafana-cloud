import { prisma } from "../database/prismaClient";
import { NotFoundError, ValidationError } from "../utils/errors";
import { withSpan } from "../utils/tracing";
import type { CreateUserInput, UpdatePreferencesInput } from "../validation/schemas";

export async function createUser(input: CreateUserInput) {
  return withSpan(
    "business.create_user",
    async () => {
      const existing = await prisma.user.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new ValidationError("A user with this email already exists");
      }
      return prisma.user.create({ data: input });
    },
    { "user.email_domain": input.email.split("@")[1] ?? "unknown" }
  );
}

export async function getUserById(id: string) {
  return withSpan("database.load_user", async () => {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { preferences: true },
    });
    if (!user) throw new NotFoundError("User");
    return user;
  });
}

export async function upsertPreferences(userId: string, input: UpdatePreferencesInput) {
  return withSpan(
    "business.save_preferences",
    async () => {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundError("User");

      return prisma.userPreferences.upsert({
        where: { userId },
        create: { userId, ...input },
        update: { ...input },
      });
    },
    { "user.id": userId }
  );
}
