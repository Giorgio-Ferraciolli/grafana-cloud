import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, Circle, Dumbbell, Moon, Sparkles } from "lucide-react";
import clsx from "clsx";
import { Card, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { SkeletonCard } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { api, ApiError } from "../api/client";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useWorkoutCompletion } from "../hooks/useWorkoutCompletion";
import { DAY_LABEL_PT } from "../lib/options";
import type { Workout } from "../types/domain";

export function WorkoutsPage() {
  const { userId } = useCurrentUser();
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["workouts", userId],
    queryFn: () => api.getWorkoutPlan(userId as string),
    enabled: Boolean(userId),
    retry: false,
  });

  const { completed, toggle } = useWorkoutCompletion(query.data?.id);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="Nenhum treino gerado ainda"
          description="Gere sua rotina no Dashboard para ver seu plano de treino semanal aqui."
        />
      );
    }
    return <ErrorState onRetry={() => query.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Meus treinos</h1>
        <p className="mt-1 text-sm text-slate-400">Plano semanal gerado com base no seu perfil de treino.</p>
      </div>

      <div className="space-y-3">
        {query.data?.workouts.map((workout) => (
          <WorkoutDayCard
            key={workout.id}
            workout={workout}
            isExpanded={expanded === workout.id}
            isDone={completed.has(workout.dayOfWeek)}
            onToggleExpand={() => setExpanded(expanded === workout.id ? null : workout.id)}
            onToggleDone={() => toggle(workout.dayOfWeek)}
          />
        ))}
      </div>
    </div>
  );
}

function WorkoutDayCard({
  workout,
  isExpanded,
  isDone,
  onToggleExpand,
  onToggleDone,
}: {
  workout: Workout;
  isExpanded: boolean;
  isDone: boolean;
  onToggleExpand: () => void;
  onToggleDone: () => void;
}) {
  if (workout.isRestDay) {
    return (
      <Card className="flex items-center gap-4 p-5 opacity-70">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/10 text-slate-400">
          <Moon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-200">{DAY_LABEL_PT[workout.dayOfWeek]}</p>
          <p className="text-xs text-slate-500">Dia de descanso</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <button
        onClick={onToggleExpand}
        className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-surface-raised/40"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
          <Dumbbell className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-200">{DAY_LABEL_PT[workout.dayOfWeek]}</p>
          <p className="truncate text-xs text-slate-500">{workout.focus}</p>
        </div>
        <Badge tone="brand">{workout.exercises.length} exercícios</Badge>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone();
          }}
          className="shrink-0"
          aria-label={isDone ? "Marcar como não concluído" : "Marcar como concluído"}
        >
          {isDone ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          ) : (
            <Circle className="h-6 w-6 text-slate-600" />
          )}
        </button>
        <ChevronDown className={clsx("h-4 w-4 shrink-0 text-slate-500 transition-transform", isExpanded && "rotate-180")} />
      </button>

      {isExpanded && (
        <CardContent className="border-t border-surface-border pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 font-medium">Exercício</th>
                  <th className="pb-2 font-medium">Séries</th>
                  <th className="pb-2 font-medium">Repetições</th>
                  <th className="pb-2 font-medium">Descanso</th>
                  <th className="pb-2 font-medium">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {workout.exercises.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-2.5 pr-4 font-medium text-slate-200">{entry.exercise.name}</td>
                    <td className="py-2.5 pr-4 text-slate-400">{entry.sets}</td>
                    <td className="py-2.5 pr-4 text-slate-400">{entry.reps}</td>
                    <td className="py-2.5 pr-4 text-slate-400">{entry.restSeconds}s</td>
                    <td className="py-2.5 text-slate-500">{entry.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
