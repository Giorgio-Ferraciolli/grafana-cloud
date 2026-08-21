import { ReactNode } from "react";
import clsx from "clsx";
import { Card } from "../ui/Card";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  tone?: "brand" | "success" | "warning" | "danger" | "neutral";
}

const TONE_ICON_STYLES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  brand: "bg-brand-500/15 text-brand-300",
  success: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-amber-500/15 text-amber-300",
  danger: "bg-rose-500/15 text-rose-300",
  neutral: "bg-slate-500/15 text-slate-300",
};

export function StatCard({ icon, label, value, sublabel, tone = "brand" }: StatCardProps) {
  return (
    <Card className="p-5 transition-transform hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-50">{value}</p>
          {sublabel && <p className="mt-1 text-xs text-slate-500">{sublabel}</p>}
        </div>
        <div className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", TONE_ICON_STYLES[tone])}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
