import "./instrumentation";

import { createApp } from "./app";
import { prisma } from "./database/prismaClient";
import { shutdownAgento11y } from "./lib/agento11yClient";
import { logger } from "./utils/logger";

const port = Number(process.env.PORT) || 3001;
const app = createApp();

const server = app.listen(port, () => {
  logger.info({ port }, `planner-backend listening on port ${port}`);
});

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down gracefully");
  server.close();
  await shutdownAgento11y();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
