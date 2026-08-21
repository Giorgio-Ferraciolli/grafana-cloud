import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { OnboardingPage } from "./pages/OnboardingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { WorkoutsPage } from "./pages/WorkoutsPage";
import { DietPage } from "./pages/DietPage";
import { LabPage } from "./pages/LabPage";
import { useCurrentUser } from "./hooks/useCurrentUser";

function RequireProfile({ children }: { children: JSX.Element }) {
  const { userId } = useCurrentUser();
  if (!userId) return <Navigate to="/onboarding" replace />;
  return children;
}

export default function App() {
  const { userId } = useCurrentUser();

  return (
    <Routes>
      <Route path="/" element={<Navigate to={userId ? "/dashboard" : "/onboarding"} replace />} />
      <Route path="/onboarding" element={<OnboardingPage />} />

      <Route
        element={
          <RequireProfile>
            <AppShell />
          </RequireProfile>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/workouts" element={<WorkoutsPage />} />
        <Route path="/diet" element={<DietPage />} />
        <Route path="/lab" element={<LabPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
