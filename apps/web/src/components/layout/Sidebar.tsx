import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { PostComposerModal } from "../social/PostComposerModal";
import { NotificationBell } from "../social/NotificationBell";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: "🏠" },
  { to: "/feed", label: "Feed", icon: "📰" },
  { to: "/search", label: "Search", icon: "🔍" },
  { to: "/messages", label: "Messages", icon: "✉️" },
  { to: "/profile", label: "Fitness Profile", icon: "👤" },
  { to: "/goals", label: "Goals", icon: "🎯" },
  { to: "/nutrition", label: "Nutrition", icon: "🥗" },
  { to: "/workouts", label: "Workouts", icon: "🏋️" },
  { to: "/cardio", label: "Cardio", icon: "🏃" },
  { to: "/wearables", label: "Wearables", icon: "⌚" },
  { to: "/progress", label: "Progress", icon: "📈" },
  { to: "/leaderboards", label: "Leaderboards", icon: "🏆" },
  { to: "/reports", label: "Reports", icon: "📋" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <aside className="flex h-screen w-64 flex-col bg-ink-900 text-white">
      <div className="flex items-center justify-between gap-2 px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-lg font-bold text-white">
            V
          </div>
          <span className="text-lg font-bold text-white">Venici</span>
        </div>
        <NotificationBell />
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={() => setComposerOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-900/40 hover:bg-brand-600"
        >
          <span aria-hidden>✏️</span> Create Post
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? "bg-brand-500/20 text-brand-300" : "text-white/70 hover:bg-white/5 hover:text-white"
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
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-300 hover:bg-white/5"
          >
            <span aria-hidden>🛠️</span> Admin Panel
          </NavLink>
        </div>
      )}

      <div className="border-t border-white/10 p-4">
        <Link
          to="/profile"
          className="mb-3 flex items-center gap-3 rounded-lg p-1 hover:bg-white/5"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
            {(user?.profile?.name ?? user?.email ?? "U").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{user?.profile?.name ?? "User"}</p>
            <p className="truncate text-xs text-white/50">{user?.email}</p>
          </div>
        </Link>
        <button
          onClick={logout}
          className="w-full rounded-lg border border-white/15 py-2 text-sm font-medium text-white/80 hover:bg-white/5"
        >
          Log out
        </button>
      </div>

      <PostComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={() => {
          navigate("/profile");
        }}
      />
    </aside>
  );
}
