import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AppLayout from "./components/layout/AppLayout";
import AdminLayout from "./components/layout/AdminLayout";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Goals from "./pages/Goals";
import Nutrition from "./pages/Nutrition";
import Workouts from "./pages/Workouts";
import Cardio from "./pages/Cardio";
import CardioLive from "./pages/CardioLive";
import Wearables from "./pages/Wearables";
import Progress from "./pages/Progress";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

import AdminUsers from "./pages/admin/AdminUsers";
import AdminFoods from "./pages/admin/AdminFoods";
import AdminExercises from "./pages/admin/AdminExercises";
import AdminStats from "./pages/admin/AdminStats";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "ADMIN") return <Navigate to="/dashboard" replace />;
  return children;
}

function FullscreenLoader() {
  return (
    <div className="flex h-screen items-center justify-center text-ink-500">
      <div className="animate-pulse">Loading Venici…</div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/nutrition" element={<Nutrition />} />
        <Route path="/workouts" element={<Workouts />} />
        <Route path="/cardio" element={<Cardio />} />
        <Route path="/wearables" element={<Wearables />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* Live cardio gets its own full-screen route, outside the sidebar layout. */}
      <Route
        path="/cardio/live"
        element={
          <RequireAuth>
            <CardioLive />
          </RequireAuth>
        }
      />

      <Route
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route path="/admin" element={<Navigate to="/admin/stats" replace />} />
        <Route path="/admin/stats" element={<AdminStats />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/foods" element={<AdminFoods />} />
        <Route path="/admin/exercises" element={<AdminExercises />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
