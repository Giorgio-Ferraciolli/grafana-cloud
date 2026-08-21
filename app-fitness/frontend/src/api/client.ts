import type { DietPlan, Exercise, Food, FullPlan, User, UserPreferences, WorkoutPlan } from "../types/domain";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.message || `Request failed with status ${res.status}`, res.status, body.details);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  age: number;
}

export interface SavePreferencesPayload {
  goal: string;
  experienceLevel: string;
  daysPerWeek: number;
  minutesPerSession: number;
  trainingPreference: string;
  dietaryRestrictions: string[];
  nutritionGoal: string;
  likedFoods: string[];
  dislikedFoods: string[];
}

export const api = {
  health: () => request<{ status: string; database: string }>("/api/health"),

  createUser: (payload: CreateUserPayload) =>
    request<User>("/api/users", { method: "POST", body: JSON.stringify(payload) }),

  getUser: (id: string) => request<User>(`/api/users/${id}`),

  savePreferences: (id: string, payload: SavePreferencesPayload) =>
    request<UserPreferences>(`/api/users/${id}/preferences`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  generatePlan: (userId: string, simulateDelay?: number) => {
    const query = simulateDelay ? `?simulateDelay=${simulateDelay}` : "";
    return request<FullPlan>(`/api/plans/generate${query}`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  },

  getPlan: (userId: string) => request<FullPlan>(`/api/plans/${userId}`),

  getWorkoutPlan: (userId: string) => request<WorkoutPlan>(`/api/workouts/${userId}`),

  getDietPlan: (userId: string) => request<DietPlan>(`/api/diet/${userId}`),

  listExercises: () => request<Exercise[]>("/api/exercises"),

  listFoods: () => request<Food[]>("/api/foods"),

  triggerDebugError: () => request<unknown>("/api/debug/error"),

  triggerSlowDb: (delayMs: number) => request<unknown>(`/api/debug/slow-db?delayMs=${delayMs}`),
};
