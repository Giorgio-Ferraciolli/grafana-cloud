import swaggerJSDoc from "swagger-jsdoc";
import path from "node:path";

const isCompiled = __filename.endsWith(".js");

export const openApiSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Planejador de Rotina API",
      version: process.env.OTEL_SERVICE_VERSION || "1.0.0",
      description:
        "REST API for the Planejador de Rotina observability lab: user profiles, deterministic workout/diet plan generation, and OpenTelemetry-friendly debug endpoints.",
    },
    servers: [{ url: "/", description: "Current host" }],
    tags: [
      { name: "Health", description: "Liveness and dependency checks" },
      { name: "Users", description: "User profiles and preferences" },
      { name: "Plans", description: "Generated workout + diet plans" },
      { name: "Workouts", description: "Workout plan retrieval" },
      { name: "Diet", description: "Diet plan retrieval" },
      { name: "Catalog", description: "Exercise and food catalogs" },
      { name: "Lab", description: "Observability lab utilities: controlled errors and latency" },
    ],
  },
  apis: [path.join(__dirname, isCompiled ? "../routes/*.js" : "../routes/*.ts")],
});
