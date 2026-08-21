import { CheckCircle2, Dumbbell, Moon } from "lucide-react";
import type { DayOfWeek } from "../../types/domain";

type DayStatus = "done" | "pending" | "rest";

interface DayDatum {
  day: DayOfWeek;
  status: DayStatus;
  focus: string;
}

const DAY_LABEL: Record<DayOfWeek, string> = {
  MONDAY: "Seg",
  TUESDAY: "Ter",
  WEDNESDAY: "Qua",
  THURSDAY: "Qui",
  FRIDAY: "Sex",
  SATURDAY: "Sáb",
  SUNDAY: "Dom",
};

// Validated against the card surface (#161d2e, dark) with the dataviz skill's
// validator: status "good" for completed days, the app's brand hue for
// scheduled-but-pending days, and a muted track for rest days.
const STATUS_STYLE: Record<DayStatus, { fill: string; barHeight: string }> = {
  done: { fill: "#0ca30c", barHeight: "100%" },
  pending: { fill: "#6366f1", barHeight: "70%" },
  rest: { fill: "#334155", barHeight: "28%" },
};

const LEGEND: { status: DayStatus; label: string; icon: typeof CheckCircle2 }[] = [
  { status: "done", label: "Concluído", icon: CheckCircle2 },
  { status: "pending", label: "Agendado", icon: Dumbbell },
  { status: "rest", label: "Descanso", icon: Moon },
];

export function WeeklyProgressChart({ days }: { days: DayDatum[] }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-2 sm:gap-3" role="img" aria-label="Progresso semanal de treinos">
        {days.map((d) => {
          const style = STATUS_STYLE[d.status];
          return (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-24 w-full max-w-[28px] items-end justify-center rounded-full bg-surface-raised">
                <div
                  title={`${DAY_LABEL[d.day]} · ${d.focus}`}
                  className="w-full rounded-full transition-all duration-500"
                  style={{ height: style.barHeight, backgroundColor: style.fill }}
                />
              </div>
              <span className="text-[11px] font-medium text-slate-400">{DAY_LABEL[d.day]}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-surface-border pt-3">
        {LEGEND.map(({ status, label, icon: Icon }) => (
          <div key={status} className="flex items-center gap-1.5 text-xs text-slate-400">
            <Icon className="h-3.5 w-3.5" style={{ color: STATUS_STYLE[status].fill }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

export type { DayStatus, DayDatum };
