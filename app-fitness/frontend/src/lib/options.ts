export const GOAL_OPTIONS = [
  { value: "LOSE_WEIGHT", label: "Perder peso" },
  { value: "GAIN_MUSCLE", label: "Ganhar massa muscular" },
  { value: "MAINTAIN", label: "Manter a forma" },
  { value: "IMPROVE_CONDITIONING", label: "Melhorar condicionamento" },
];

export const EXPERIENCE_OPTIONS = [
  { value: "BEGINNER", label: "Iniciante" },
  { value: "INTERMEDIATE", label: "Intermediário" },
  { value: "ADVANCED", label: "Avançado" },
];

export const TRAINING_PREFERENCE_OPTIONS = [
  { value: "STRENGTH", label: "Musculação" },
  { value: "CARDIO", label: "Cardio" },
  { value: "HIIT", label: "HIIT" },
  { value: "FUNCTIONAL", label: "Funcional" },
  { value: "MIXED", label: "Misto" },
];

export const NUTRITION_GOAL_OPTIONS = [
  { value: "LOSE_WEIGHT", label: "Perder peso" },
  { value: "GAIN_MUSCLE", label: "Ganhar massa muscular" },
  { value: "MAINTAIN", label: "Manter o peso" },
  { value: "HEALTHY_EATING", label: "Alimentação saudável" },
];

export const DIETARY_RESTRICTION_OPTIONS = [
  { value: "vegetarian", label: "Vegetariano" },
  { value: "vegan", label: "Vegano" },
  { value: "lactose_free", label: "Sem lactose" },
  { value: "gluten_free", label: "Sem glúten" },
];

export const DAY_LABEL_PT: Record<string, string> = {
  MONDAY: "Segunda",
  TUESDAY: "Terça",
  WEDNESDAY: "Quarta",
  THURSDAY: "Quinta",
  FRIDAY: "Sexta",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

export const MEAL_LABEL_PT: Record<string, string> = {
  BREAKFAST: "Café da manhã",
  MORNING_SNACK: "Lanche da manhã",
  LUNCH: "Almoço",
  AFTERNOON_SNACK: "Lanche da tarde",
  DINNER: "Jantar",
  SUPPER: "Ceia",
};

export function labelFor(options: { value: string; label: string }[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}
