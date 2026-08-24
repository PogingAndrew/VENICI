import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: "🏠" },
  { to: "/profile", label: "Profile", icon: "👤" },
  { to: "/goals", label: "Goals", icon: "🎯" },
  { to: "/nutrition", label: "Nutrition", icon: "🥗" },
  { to: "/workouts", label: "Workouts", icon: "🏋️" },
  { to: "/cardio", label: "Cardio", icon: "🏃" },
  { to: "/wearables", label: "Wearables", icon: "⌚" },
  { to: "/progress", label: "Progress", icon: "📈" },
  { to: "/reports", label: "Reports", icon: "📋" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-lg font-bold text-white">
          F
        </div>
        <span className="text-lg font-bold text-ink-900">FitTrack</span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-ink-500 hover:bg-slate-50 hover:text-ink-900"
              }`
            }
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {user?.role === "ADMIN" && (
        <div className="px-3 pb-2">
          <NavLink
            to="/admin"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            <span aria-hidden>🛠️</span> Admin Panel
          </NavLink>
        </div>
      )}

      <div className="border-t border-slate-200 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-900 text-sm font-semibold text-white">
            {(user?.profile?.name ?? user?.email ?? "U").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900">
              {user?.profile?.name ?? "User"}
            </p>
            <p className="truncate text-xs text-ink-500">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-ink-700 hover:bg-slate-50"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
