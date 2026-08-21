import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { FieldWrapper, Select, TextInput } from "../components/ui/Field";
import { TagInput } from "../components/ui/TagInput";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import { useCurrentUser } from "../hooks/useCurrentUser";
import {
  DIETARY_RESTRICTION_OPTIONS,
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  NUTRITION_GOAL_OPTIONS,
  TRAINING_PREFERENCE_OPTIONS,
} from "../lib/options";

interface ProfileForm {
  name: string;
  email: string;
  age: string;
}

interface PreferencesForm {
  goal: string;
  experienceLevel: string;
  daysPerWeek: string;
  minutesPerSession: string;
  trainingPreference: string;
  dietaryRestrictions: string[];
  nutritionGoal: string;
  likedFoods: string[];
  dislikedFoods: string[];
}

const DEFAULT_PREFERENCES: PreferencesForm = {
  goal: "MAINTAIN",
  experienceLevel: "BEGINNER",
  daysPerWeek: "3",
  minutesPerSession: "45",
  trainingPreference: "MIXED",
  dietaryRestrictions: [],
  nutritionGoal: "MAINTAIN",
  likedFoods: [],
  dislikedFoods: [],
};

export function OnboardingPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [profile, setProfile] = useState<ProfileForm>({ name: "", email: "", age: "" });
  const [preferences, setPreferences] = useState<PreferencesForm>(DEFAULT_PREFERENCES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const { setUserId } = useCurrentUser();
  const { push } = useToast();
  const navigate = useNavigate();

  function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (profile.name.trim().length < 2) nextErrors.name = "Informe seu nome completo";
    if (!/^\S+@\S+\.\S+$/.test(profile.email)) nextErrors.email = "Informe um e-mail válido";
    const age = Number(profile.age);
    if (!age || age < 13 || age > 100) nextErrors.age = "Idade deve estar entre 13 e 100";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) setStep(2);
  }

  async function handlePreferencesSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await api.createUser({
        name: profile.name.trim(),
        email: profile.email.trim(),
        age: Number(profile.age),
      });

      await api.savePreferences(user.id, {
        goal: preferences.goal,
        experienceLevel: preferences.experienceLevel,
        daysPerWeek: Number(preferences.daysPerWeek),
        minutesPerSession: Number(preferences.minutesPerSession),
        trainingPreference: preferences.trainingPreference,
        dietaryRestrictions: preferences.dietaryRestrictions,
        nutritionGoal: preferences.nutritionGoal,
        likedFoods: preferences.likedFoods,
        dislikedFoods: preferences.dislikedFoods,
      });

      setUserId(user.id);
      push(`Bem-vindo(a), ${user.name.split(" ")[0]}! Perfil criado com sucesso.`, "success");
      navigate("/dashboard");
    } catch (err) {
      push(err instanceof Error ? err.message : "Não foi possível criar seu perfil", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleRestriction(value: string) {
    setPreferences((prev) => ({
      ...prev,
      dietaryRestrictions: prev.dietaryRestrictions.includes(value)
        ? prev.dietaryRestrictions.filter((r) => r !== value)
        : [...prev.dietaryRestrictions, value],
    }));
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 shadow-glow">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-50">Planejador de Rotina</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Conte um pouco sobre você para gerarmos seu treino e sua dieta personalizados.
          </p>

          <div className="mt-5 flex items-center gap-2">
            <div className={`h-1.5 w-10 rounded-full ${step >= 1 ? "bg-brand-500" : "bg-surface-border"}`} />
            <div className={`h-1.5 w-10 rounded-full ${step >= 2 ? "bg-brand-500" : "bg-surface-border"}`} />
          </div>
        </div>

        <Card className="p-6 sm:p-8">
          {step === 1 ? (
            <form onSubmit={handleProfileSubmit} className="space-y-5">
              <h2 className="text-sm font-semibold text-slate-200">1. Seu perfil</h2>

              <FieldWrapper label="Nome" htmlFor="name" error={errors.name}>
                <TextInput
                  id="name"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="Ana Souza"
                />
              </FieldWrapper>

              <FieldWrapper label="E-mail" htmlFor="email" error={errors.email}>
                <TextInput
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="ana@example.com"
                />
              </FieldWrapper>

              <FieldWrapper label="Idade" htmlFor="age" error={errors.age}>
                <TextInput
                  id="age"
                  type="number"
                  min={13}
                  max={100}
                  value={profile.age}
                  onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                  placeholder="28"
                />
              </FieldWrapper>

              <Button type="submit" className="w-full" size="lg">
                Continuar <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <form onSubmit={handlePreferencesSubmit} className="space-y-5">
              <h2 className="text-sm font-semibold text-slate-200">2. Objetivos e preferências</h2>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <FieldWrapper label="Objetivo" htmlFor="goal">
                  <Select
                    id="goal"
                    value={preferences.goal}
                    onChange={(e) => setPreferences({ ...preferences, goal: e.target.value })}
                  >
                    {GOAL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FieldWrapper>

                <FieldWrapper label="Nível de experiência" htmlFor="experienceLevel">
                  <Select
                    id="experienceLevel"
                    value={preferences.experienceLevel}
                    onChange={(e) => setPreferences({ ...preferences, experienceLevel: e.target.value })}
                  >
                    {EXPERIENCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FieldWrapper>

                <FieldWrapper label="Dias disponíveis por semana" htmlFor="daysPerWeek">
                  <Select
                    id="daysPerWeek"
                    value={preferences.daysPerWeek}
                    onChange={(e) => setPreferences({ ...preferences, daysPerWeek: e.target.value })}
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <option key={d} value={d}>
                        {d} {d === 1 ? "dia" : "dias"}
                      </option>
                    ))}
                  </Select>
                </FieldWrapper>

                <FieldWrapper label="Tempo por treino (minutos)" htmlFor="minutesPerSession">
                  <Select
                    id="minutesPerSession"
                    value={preferences.minutesPerSession}
                    onChange={(e) => setPreferences({ ...preferences, minutesPerSession: e.target.value })}
                  >
                    {[20, 30, 45, 60, 75, 90].map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </Select>
                </FieldWrapper>

                <FieldWrapper label="Preferência de treino" htmlFor="trainingPreference">
                  <Select
                    id="trainingPreference"
                    value={preferences.trainingPreference}
                    onChange={(e) => setPreferences({ ...preferences, trainingPreference: e.target.value })}
                  >
                    {TRAINING_PREFERENCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FieldWrapper>

                <FieldWrapper label="Objetivo nutricional" htmlFor="nutritionGoal">
                  <Select
                    id="nutritionGoal"
                    value={preferences.nutritionGoal}
                    onChange={(e) => setPreferences({ ...preferences, nutritionGoal: e.target.value })}
                  >
                    {NUTRITION_GOAL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FieldWrapper>
              </div>

              <FieldWrapper label="Restrições alimentares" htmlFor="restrictions">
                <div className="flex flex-wrap gap-2" id="restrictions">
                  {DIETARY_RESTRICTION_OPTIONS.map((o) => {
                    const active = preferences.dietaryRestrictions.includes(o.value);
                    return (
                      <button
                        type="button"
                        key={o.value}
                        onClick={() => toggleRestriction(o.value)}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? "border-brand-500 bg-brand-500/15 text-brand-300"
                            : "border-surface-border bg-surface-raised text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </FieldWrapper>

              <FieldWrapper label="Alimentos que você gosta" htmlFor="liked" hint="Pressione Enter para adicionar">
                <TagInput
                  values={preferences.likedFoods}
                  onChange={(v) => setPreferences({ ...preferences, likedFoods: v })}
                  placeholder="Ex: Frango, Banana..."
                />
              </FieldWrapper>

              <FieldWrapper label="Alimentos que você não gosta" htmlFor="disliked" hint="Pressione Enter para adicionar">
                <TagInput
                  values={preferences.dislikedFoods}
                  onChange={(v) => setPreferences({ ...preferences, dislikedFoods: v })}
                  placeholder="Ex: Brócolis, Peixe..."
                />
              </FieldWrapper>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Button>
                <Button type="submit" className="flex-1" size="lg" loading={submitting}>
                  <Sparkles className="h-4 w-4" /> Criar meu perfil
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
