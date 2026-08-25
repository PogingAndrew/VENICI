import { NavLink, Outlet } from "react-router-dom";

const ADMIN_NAV = [
  { to: "/admin/stats", label: "System Statistics" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/foods", label: "Foods" },
  { to: "/admin/exercises", label: "Exercises" },
];

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 border-r border-slate-200 bg-ink-900 text-white">
        <div className="px-6 py-6 text-lg font-bold">Venici Admin</div>
        <nav className="space-y-1 px-3">
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-xl px-3 py-2.5 text-sm font-medium ${
                  isActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 pt-4">
          <NavLink to="/dashboard" className="block rounded-xl px-3 py-2.5 text-sm text-white/70 hover:bg-white/5">
            ← Back to app
          </NavLink>
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
