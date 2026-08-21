import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Flame, Sparkles, TrendingUp, Wheat } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Skeleton, SkeletonCard } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { StatCard } from "../components/dashboard/StatCard";
import { WeeklyProgressChart, type DayDatum } from "../components/dashboard/WeeklyProgressChart";
import { MacroBreakdown } from "../components/dashboard/MacroBreakdown";
import { api, ApiError } from "../api/client";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useWorkoutCompletion } from "../hooks/useWorkoutCompletion";
import { useToast } from "../context/ToastContext";
import { DAY_LABEL_PT } from "../lib/options";
import type { DayOfWeek } from "../types/domain";

const JS_DAY_TO_ENUM: DayOfWeek[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

export function DashboardPage() {
  const { userId, user } = useCurrentUser();
  const { push } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);

  const planQuery = useQuery({
    queryKey: ["plan", userId],
    queryFn: () => api.getPlan(userId as string),
    enabled: Boolean(userId),
    retry: false,
  });

  const { completed } = useWorkoutCompletion(planQuery.data?.workoutPlan?.id);

  const generateMutation = useMutation({
    mutationFn: () => api.generatePlan(userId as string),
    onMutate: () => setGenerating(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan", userId] });
      push("Sua rotina foi gerada com sucesso!", "success");
    },
    onError: (err) => {
      push(err instanceof ApiError ? err.message : "Não foi possível gerar sua rotina agora.", "error");
    },
    onSettled: () => setGenerating(false),
  });

  const workoutPlan = planQuery.data?.workoutPlan;
  const dietPlan = planQuery.data?.dietPlan;

  const weeklyDays: DayDatum[] = useMemo(() => {
    if (!workoutPlan) return [];
    return workoutPlan.workouts.map((w) => ({
      day: w.dayOfWeek,
      focus: w.isRestDay ? "Descanso" : w.focus,
      status: w.isRestDay ? "rest" : completed.has(w.dayOfWeek) ? "done" : "pending",
    }));
  }, [workoutPlan, completed]);

  const nextWorkout = useMemo(() => {
    if (!workoutPlan) return null;
    const todayIdx = new Date().getDay();
    for (let offset = 0; offset < 7; offset += 1) {
      const enumDay = JS_DAY_TO_ENUM[(todayIdx + offset) % 7];
      const match = workoutPlan.workouts.find((w) => w.dayOfWeek === enumDay && !w.isRestDay);
      if (match) return match;
    }
    return null;
  }, [workoutPlan]);

  const trainingDaysCount = workoutPlan?.workouts.filter((w) => !w.isRestDay).length ?? 0;
  const dailyTotals = useMemo(() => {
    if (!dietPlan) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    return dietPlan.meals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.calories,
        protein: acc.protein + meal.protein,
        carbs: acc.carbs + meal.carbs,
        fat: acc.fat + meal.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [dietPlan]);

  if (planQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (planQuery.isError && !(planQuery.error instanceof ApiError && planQuery.error.status === 404)) {
    return <ErrorState onRetry={() => planQuery.refetch()} />;
  }

  const firstName = user?.name?.split(" ")[0] ?? "";

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Olá, {firstName}</h1>
          <p className="mt-1 text-sm text-slate-400">Aqui está o resumo da sua semana de treino e alimentação.</p>
        </div>
        <Button onClick={() => generateMutation.mutate()} loading={generating} size="lg">
          <Sparkles className="h-4 w-4" />
          Gerar minha rotina
        </Button>
      </div>

      {!workoutPlan || !dietPlan ? (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="Você ainda não tem uma rotina"
          description="Clique em 'Gerar minha rotina' para criarmos um plano de treino e alimentação personalizado com base no seu perfil."
          actionLabel="Gerar minha rotina"
          onAction={() => generateMutation.mutate()}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Calendar className="h-5 w-5" />}
              label="Próximo treino"
              value={nextWorkout ? DAY_LABEL_PT[nextWorkout.dayOfWeek] : "Descanso"}
              sublabel={nextWorkout?.focus ?? "Aproveite para recuperar"}
              tone="brand"
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Progresso semanal"
              value={`${completed.size}/${trainingDaysCount}`}
              sublabel="treinos concluídos"
              tone="success"
            />
            <StatCard
              icon={<Flame className="h-5 w-5" />}
              label="Calorias diárias"
              value={`${Math.round(dailyTotals.calories)} kcal`}
              sublabel="meta do plano alimentar"
              tone="warning"
            />
            <StatCard
              icon={<Wheat className="h-5 w-5" />}
              label="Proteínas"
              value={`${Math.round(dailyTotals.protein)}g`}
              sublabel={`${Math.round(dailyTotals.carbs)}g carbo · ${Math.round(dailyTotals.fat)}g gordura`}
              tone="neutral"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Resumo da semana</CardTitle>
              </CardHeader>
              <CardContent>
                <WeeklyProgressChart days={weeklyDays} />
                <p className="mt-4 text-xs text-slate-500">
                  Marque seus treinos como concluídos na página{" "}
                  <button className="text-brand-400 hover:underline" onClick={() => navigate("/workouts")}>
                    Treinos
                  </button>
                  .
                </p>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Resumo nutricional</CardTitle>
              </CardHeader>
              <CardContent>
                <MacroBreakdown protein={dailyTotals.protein} carbs={dailyTotals.carbs} fat={dailyTotals.fat} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
