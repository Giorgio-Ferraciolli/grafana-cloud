import { useCallback, useEffect, useState } from "react";

function storageKey(planId: string) {
  return `planner.completedDays.${planId}`;
}

/**
 * Marking a training day "done" is a purely local, client-side convenience
 * (there's no backend concept of workout completion) so the dashboard's
 * weekly chart and progress stat have something to reflect between plan
 * generations.
 */
export function useWorkoutCompletion(planId: string | undefined) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!planId) {
      setCompleted(new Set());
      return;
    }
    const raw = localStorage.getItem(storageKey(planId));
    setCompleted(new Set(raw ? (JSON.parse(raw) as string[]) : []));
  }, [planId]);

  const toggle = useCallback(
    (day: string) => {
      if (!planId) return;
      setCompleted((prev) => {
        const next = new Set(prev);
        if (next.has(day)) next.delete(day);
        else next.add(day);
        localStorage.setItem(storageKey(planId), JSON.stringify([...next]));
        return next;
      });
    },
    [planId]
  );

  return { completed, toggle };
}
