import { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import { Card } from "../../components/ui/Card";
import { LoadingBlock } from "../../components/ui/EmptyState";

interface AdminUser {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  createdAt: string;
  profile: { name: string } | null;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);

  function load() {
    api.get<AdminUser[]>("/users").then(setUsers);
  }
  useEffect(load, []);

  async function toggleRole(u: AdminUser) {
    const newRole = u.role === "ADMIN" ? "USER" : "ADMIN";
    await api.patch(`/admin/users/${u.id}/role`, { role: newRole });
    load();
  }

  async function remove(u: AdminUser) {
    if (!confirm(`Delete ${u.email}? This cannot be undone.`)) return;
    await api.delete(`/admin/users/${u.id}`);
    load();
  }

  if (!users) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-sm text-white/60">{users.length} registered accounts.</p>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-500">
              <th className="pb-2">Name</th>
              <th className="pb-2">Email</th>
              <th className="pb-2">Role</th>
              <th className="pb-2">Joined</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="py-2">{u.profile?.name ?? "—"}</td>
                <td className="py-2">{u.email}</td>
                <td className="py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      u.role === "ADMIN" ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-ink-500"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="py-2">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="py-2 text-right">
                  <button onClick={() => toggleRole(u)} className="mr-3 text-xs font-semibold text-brand-700">
                    {u.role === "ADMIN" ? "Revoke admin" : "Make admin"}
                  </button>
                  <button onClick={() => remove(u)} className="text-xs font-semibold text-red-500">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
