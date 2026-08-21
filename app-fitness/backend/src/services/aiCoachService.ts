import Anthropic from "@anthropic-ai/sdk";
import { getAgento11yClient } from "../lib/agento11yClient";
import { withSpan } from "../utils/tracing";
import { AppError, NotFoundError } from "../utils/errors";
import { getLatestPlanForUser } from "./planService";
import type { GeneratedMeal, GeneratedWorkout } from "../types/domain";

const MODEL = "claude-sonnet-4-5";

// Constructed lazily (not at module scope) so importing this module never
// throws just because ANTHROPIC_API_KEY isn't set yet - only this feature's
// own request path fails until the key is configured.
let anthropicClient: Anthropic | undefined;
function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AppError("ANTHROPIC_API_KEY is not configured", 503);
  }
  anthropicClient ??= new Anthropic();
  return anthropicClient;
}

const SYSTEM_PROMPT =
  "Voce e um personal trainer e nutricionista motivador. Escreva uma nota curta " +
  "(2 a 3 frases), em portugues, comentando o plano de treino e dieta do usuario " +
  "e dando um incentivo pratico para a semana. Nao repita os numeros do resumo, " +
  "va direto ao ponto.";

function summarizePlan(
  workoutPlan: { workouts: Pick<GeneratedWorkout, "dayOfWeek" | "focus" | "isRestDay">[] },
  dietPlan: { meals: Pick<GeneratedMeal, "type" | "calories">[] }
): string {
  const trainingDays = workoutPlan.workouts
    .filter((workout) => !workout.isRestDay)
    .map((workout) => `${workout.dayOfWeek}: ${workout.focus}`)
    .join("; ");

  const dailyCalories = Math.round(
    dietPlan.meals.reduce((total, meal) => total + meal.calories, 0)
  );

  return `Dias de treino: ${trainingDays}.\nTotal aproximado da dieta: ${dailyCalories} kcal/dia.`;
}

/**
 * Generates a short, personalized coaching note for the user's latest plan
 * via Anthropic Claude, recorded as an Agent Observability generation.
 */
export async function generateAiCoachNote(userId: string): Promise<{ note: string }> {
  return withSpan(
    "business.generate_ai_coach_note",
    async () => {
      const { workoutPlan, dietPlan } = await getLatestPlanForUser(userId);
      if (!workoutPlan || !dietPlan) {
        throw new NotFoundError("WorkoutPlan or DietPlan");
      }

      const planSummary = summarizePlan(workoutPlan, dietPlan);
      const client = getAnthropicClient();
      // @grafana/agento11y is ESM-only; see ../lib/agento11yClient for why
      // this has to be a dynamic import in a CommonJS app.
      const [agento11y, { anthropic }] = await Promise.all([
        getAgento11yClient(),
        import("@grafana/agento11y"),
      ]);

      const response = await anthropic.messages.create(
        agento11y,
        {
          model: MODEL,
          max_tokens: 300,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: [{ type: "text", text: planSummary }] }],
        },
        // The request never sets `stream`, so this is always the
        // non-streaming overload; cast explicitly because `request`'s
        // wrapper-supplied type is a streaming/non-streaming union, and the
        // wrapper's own response type intersects with an index signature
        // that the concrete Anthropic SDK type doesn't structurally carry.
        async (request) =>
          (await client.messages.create(
            request as Anthropic.MessageCreateParamsNonStreaming
          )) as Anthropic.Message & Record<string, unknown>,
        {
          agentName: "planner-ai-coach",
          agentVersion: "1.0.0",
          conversationId: `coach-note:${userId}`,
        }
      );

      const note = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();

      return { note };
    },
    { "user.id": userId }
  );
}
