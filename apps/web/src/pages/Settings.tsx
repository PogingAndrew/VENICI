import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export default function Settings() {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Settings</h1>
        <p className="text-sm text-ink-500">Manage your account.</p>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold text-ink-900">Account</h2>
        <p className="text-sm text-ink-700">Email: {user?.email}</p>
        <p className="text-sm text-ink-700">Role: {user?.role}</p>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-ink-900">Privacy & location</h2>
        <p className="text-sm text-ink-500">
          Location is only tracked while a cardio activity is active. You can stop tracking at any time
          from the live activity screen, and you can delete any recorded activity from your cardio
          history.
        </p>
      </Card>

      <Card>
        <Button variant="danger" onClick={logout}>
          Log out
        </Button>
      </Card>
    </div>
  );
}
