import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

export const prisma = new PrismaClient({
  log: [
    { emit: "event", level: "warn" },
    { emit: "event", level: "error" },
  ],
});

prisma.$on("warn" as never, (event: unknown) => {
  logger.warn({ prisma: event }, "prisma warning");
});

prisma.$on("error" as never, (event: unknown) => {
  logger.error({ prisma: event }, "prisma error");
});

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logger.error({ err }, "database health check failed");
    return false;
  }
}
