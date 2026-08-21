import clsx from "clsx";

interface ProgressBarProps {
  value: number;
  max: number;
  tone?: "brand" | "success" | "warning";
  className?: string;
}

const TONE_STYLES: Record<NonNullable<ProgressBarProps["tone"]>, string> = {
  brand: "from-brand-400 to-brand-600",
  success: "from-emerald-400 to-emerald-600",
  warning: "from-amber-400 to-amber-600",
};

export function ProgressBar({ value, max, tone = "brand", className }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={clsx("h-2 w-full overflow-hidden rounded-full bg-surface-raised", className)}>
      <div
        className={clsx("h-full rounded-full bg-gradient-to-r transition-all duration-500", TONE_STYLES[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
