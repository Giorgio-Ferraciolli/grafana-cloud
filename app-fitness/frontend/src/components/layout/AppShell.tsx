import { NavLink, Outlet } from "react-router-dom";
import { Activity, FlaskConical, LayoutDashboard, Salad, Dumbbell } from "lucide-react";
import clsx from "clsx";
import { useCurrentUser } from "../../hooks/useCurrentUser";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/workouts", label: "Treinos", icon: Dumbbell },
  { to: "/diet", label: "Alimentação", icon: Salad },
  { to: "/lab", label: "Laboratório", icon: FlaskConical },
];

export function AppShell() {
  const { user } = useCurrentUser();

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-surface-border bg-surface-raised/60 backdrop-blur-sm lg:flex">
        <div className="flex items-center gap-2.5 px-6 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 shadow-glow">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-slate-50">Planejador</p>
            <p className="text-xs leading-tight text-slate-500">de Rotina</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-500/15 text-brand-300"
                    : "text-slate-400 hover:bg-surface-card hover:text-slate-200"
                )
              }
            >
              <Icon className="h-4.5 w-4.5" />
              {label}
            </NavLink>
          ))}
        </nav>

        {user && (
          <div className="border-t border-surface-border p-4">
            <div className="flex items-center gap-3 rounded-xl bg-surface-card px-3 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-300">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-200">{user.name}</p>
                <p className="truncate text-[11px] text-slate-500">{user.email}</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-surface-border bg-surface/70 px-4 py-4 backdrop-blur-sm lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-700">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <p className="text-sm font-bold text-slate-50">Planejador de Rotina</p>
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-surface-border bg-surface/70 px-3 py-2 lg:hidden">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
                  isActive ? "bg-brand-500/15 text-brand-300" : "text-slate-400"
                )
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-6xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
