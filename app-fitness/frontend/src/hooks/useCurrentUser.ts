import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../api/client";

const STORAGE_KEY = "planner.userId";

function readStoredUserId(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function useCurrentUser() {
  const [userId, setUserIdState] = useState<string | null>(readStoredUserId);

  useEffect(() => {
    const onStorage = () => setUserIdState(readStoredUserId());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setUserId = useCallback((id: string | null) => {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
    setUserIdState(id);
  }, []);

  const query = useQuery({
    queryKey: ["user", userId],
    queryFn: () => api.getUser(userId as string),
    enabled: Boolean(userId),
    retry: false,
  });

  useEffect(() => {
    // A stored userId can outlive the user it points to (e.g. the database
    // was reset). Drop it so the app falls back to onboarding instead of
    // getting stuck showing error states on every page.
    if (query.error instanceof ApiError && query.error.status === 404) {
      setUserId(null);
    }
  }, [query.error, setUserId]);

  return {
    userId,
    setUserId,
    user: query.data,
    isLoading: Boolean(userId) && query.isLoading,
    isError: query.isError,
    hasProfile: Boolean(userId) && Boolean(query.data?.preferences),
  };
}
