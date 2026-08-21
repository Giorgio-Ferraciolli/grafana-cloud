import { HTMLAttributes } from "react";
import clsx from "clsx";

type Tone = "brand" | "neutral" | "success" | "warning" | "danger";

const TONE_STYLES: Record<Tone, string> = {
  brand: "bg-brand-500/15 text-brand-300 border-brand-500/30",
  neutral: "bg-slate-500/10 text-slate-300 border-slate-500/20",
  success: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  warning: "bg-amber-500/10 text-amber-300 border-amber-500/25",
  danger: "bg-rose-500/10 text-rose-300 border-rose-500/25",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONE_STYLES[tone],
        className
      )}
      {...props}
    />
  );
}
