import { Router } from "express";
import { healthRouter } from "./health.routes";
import { usersRouter } from "./users.routes";
import { plansRouter } from "./plans.routes";
import { workoutsRouter } from "./workouts.routes";
import { dietRouter } from "./diet.routes";
import { exercisesRouter, foodsRouter } from "./catalog.routes";
import { debugRouter } from "./debug.routes";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/plans", plansRouter);
apiRouter.use("/workouts", workoutsRouter);
apiRouter.use("/diet", dietRouter);
apiRouter.use("/exercises", exercisesRouter);
apiRouter.use("/foods", foodsRouter);
apiRouter.use("/debug", debugRouter);
