import { useQuery } from "@tanstack/react-query";
import { Salad, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { SkeletonCard } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { api, ApiError } from "../api/client";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { MEAL_LABEL_PT } from "../lib/options";

export function DietPage() {
  const { userId } = useCurrentUser();

  const query = useQuery({
    queryKey: ["diet", userId],
    queryFn: () => api.getDietPlan(userId as string),
    enabled: Boolean(userId),
    retry: false,
  });

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
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
          title="Nenhum plano alimentar gerado ainda"
          description="Gere sua rotina no Dashboard para ver seu plano alimentar aqui."
        />
      );
    }
    return <ErrorState onRetry={() => query.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Plano alimentar</h1>
        <p className="mt-1 text-sm text-slate-400">Refeições sugeridas com base nas suas preferências e restrições.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {query.data?.meals.map((meal) => (
          <Card key={meal.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Salad className="h-4 w-4 text-brand-300" />
                {MEAL_LABEL_PT[meal.type]}
              </CardTitle>
              <Badge tone="warning">{Math.round(meal.calories)} kcal</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2">
                {meal.foods.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{entry.food.name}</span>
                    <span className="text-slate-500">{Math.round(entry.quantityGrams)}g</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 border-t border-surface-border pt-3 text-xs text-slate-400">
                <Badge tone="neutral">P: {Math.round(meal.protein)}g</Badge>
                <Badge tone="neutral">C: {Math.round(meal.carbs)}g</Badge>
                <Badge tone="neutral">G: {Math.round(meal.fat)}g</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
