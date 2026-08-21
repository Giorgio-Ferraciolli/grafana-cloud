// Categorical palette (fixed order), validated with the dataviz skill's
// validator against the app's dark card surface (#161d2e): all-pairs CVD and
// contrast checks pass for this 3-slot set.
const MACROS: { key: "protein" | "carbs" | "fat"; label: string; color: string }[] = [
  { key: "protein", label: "Proteínas", color: "#3987e5" },
  { key: "carbs", label: "Carboidratos", color: "#d95926" },
  { key: "fat", label: "Gorduras", color: "#199e70" },
];

interface MacroBreakdownProps {
  protein: number;
  carbs: number;
  fat: number;
}

export function MacroBreakdown({ protein, carbs, fat }: MacroBreakdownProps) {
  const values = { protein, carbs, fat };
  const max = Math.max(protein, carbs, fat, 1);

  return (
    <div className="space-y-3.5">
      {MACROS.map(({ key, label, color }) => {
        const value = values[key];
        const pct = Math.max(4, Math.round((value / max) * 100));
        return (
          <div key={key}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                {label}
              </span>
              <span className="font-semibold text-slate-200">{Math.round(value)}g</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-raised">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
