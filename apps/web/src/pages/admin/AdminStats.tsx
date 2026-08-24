import { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import { StatCard } from "../../components/ui/Card";
import { LoadingBlock } from "../../components/ui/EmptyState";

interface Stats {
  totalUsers: number;
  activeUsers: number;
  foods: number;
  exercises: number;
  workouts: number;
  cardioActivities: number;
}

export default function AdminStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get<Stats>("/admin/stats").then(setStats);
  }, []);

  if (!stats) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">System Statistics</h1>
        <p className="text-sm text-white/60">Overview of platform-wide activity.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Total users" value={`${stats.totalUsers}`} />
        <StatCard label="Active users (30d)" value={`${stats.activeUsers}`} />
        <StatCard label="Food records" value={`${stats.foods}`} />
        <StatCard label="Exercise records" value={`${stats.exercises}`} />
        <StatCard label="Workout records" value={`${stats.workouts}`} />
        <StatCard label="Cardio activities" value={`${stats.cardioActivities}`} />
      </div>
    </div>
  );
}
