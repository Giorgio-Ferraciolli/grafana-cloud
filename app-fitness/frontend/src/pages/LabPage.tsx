import { useState } from "react";
import { AlertTriangle, Clock, FlaskConical, Gauge, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { api, ApiError } from "../api/client";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useToast } from "../context/ToastContext";

interface LabAction {
  key: string;
  icon: typeof Zap;
  title: string;
  description: string;
  buttonLabel: string;
  variant: "primary" | "secondary" | "danger";
  run: () => Promise<unknown>;
}

export function LabPage() {
  const { userId } = useCurrentUser();
  const { push } = useToast();
  const [pending, setPending] = useState<string | null>(null);

  const actions: LabAction[] = [
    {
      key: "normal",
      icon: Zap,
      title: "Trace simples",
      description: "Gera uma rotina normalmente. Produz uma árvore de spans com validação, leitura de dados e geração de treino/dieta.",
      buttonLabel: "Gerar rotina (normal)",
      variant: "primary",
      run: () => api.generatePlan(userId as string),
    },
    {
      key: "slow-plan",
      icon: Clock,
      title: "Trace com latência artificial",
      description: "Gera uma rotina com 1500ms de atraso proposital (POST /api/plans/generate?simulateDelay=1500), útil para observar um span lento na árvore de spans.",
      buttonLabel: "Gerar rotina (lenta +1.5s)",
      variant: "secondary",
      run: () => api.generatePlan(userId as string, 1500),
    },
    {
      key: "slow-db",
      icon: Gauge,
      title: "Consulta lenta no banco",
      description: "Executa um SELECT SLEEP(2) real no MySQL (GET /api/debug/slow-db) dentro de um span próprio, sem afetar dados da aplicação.",
      buttonLabel: "Simular banco lento (2s)",
      variant: "secondary",
      run: () => api.triggerSlowDb(2000),
    },
    {
      key: "error",
      icon: AlertTriangle,
      title: "Erro controlado",
      description: "Dispara um erro 500 proposital (GET /api/debug/error) para observar exception events, logs de erro e a métrica de erros HTTP.",
      buttonLabel: "Provocar erro 500",
      variant: "danger",
      run: () => api.triggerDebugError(),
    },
  ];

  async function handleRun(action: LabAction) {
    if (action.key !== "error" && action.key !== "slow-db" && !userId) {
      push("Crie seu perfil antes de gerar uma rotina.", "error");
      return;
    }
    setPending(action.key);
    try {
      await action.run();
      push(`"${action.title}" executado com sucesso. Confira o trace no Grafana Cloud.`, "success");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Requisição falhou";
      push(`"${action.title}" retornou: ${message}`, action.key === "error" ? "info" : "error");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
          <FlaskConical className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Laboratório de observabilidade</h1>
          <p className="mt-1 text-sm text-slate-400">
            Ações controladas para gerar traces, latência e erros e explorá-los no Grafana Cloud.
          </p>
        </div>
      </div>

      <Badge tone="warning" className="w-fit">
        Funcionalidades de laboratório - não afetam dados reais de outros usuários
      </Badge>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {actions.map((action) => (
          <Card key={action.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <action.icon className="h-4 w-4 text-brand-300" />
                {action.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-400">{action.description}</p>
              <Button
                variant={action.variant}
                className="w-full"
                loading={pending === action.key}
                onClick={() => handleRun(action)}
              >
                {action.buttonLabel}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
