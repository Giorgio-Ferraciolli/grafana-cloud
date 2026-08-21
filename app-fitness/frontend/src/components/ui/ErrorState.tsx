import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Algo deu errado",
  description = "Não conseguimos carregar essas informações agora. Tente novamente em instantes.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 px-6 py-16 text-center animate-fade-in">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-300">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        <p className="max-w-sm text-sm text-slate-400">{description}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
