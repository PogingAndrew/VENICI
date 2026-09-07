import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../lib/apiClient";
import { Card } from "../components/ui/Card";
import { LoadingBlock } from "../components/ui/EmptyState";

interface Snapshot {
  date: string;
  weightKg: number | null;
  caloriesConsumed: number;
  caloriesBurned: number;
  cardioDistanceM: number;
  workoutMinutes: number;
}

export default function Progress() {
  const [days, setDays] = useState(30);
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);

  useEffect(() => {
    api.get<Snapshot[]>(`/progress/history?days=${days}`).then(setSnapshots);
  }, [days]);

  if (!snapshots) return <LoadingBlock />;

  const data = snapshots.map((s) => ({
    date: new Date(s.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    weight: s.weightKg,
    consumed: Math.round(s.caloriesConsumed),
    burned: Math.round(s.caloriesBurned),
    cardioKm: Number((s.cardioDistanceM / 1000).toFixed(2)),
    workoutMinutes: s.workoutMinutes,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Progress</h1>
          <p className="text-sm text-ink-500">Trends across weight, nutrition, workouts, and cardio.</p>
        </div>
        <select
          className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Weight">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={["dataMin - 2", "dataMax + 2"]} />
            <Tooltip />
            <Area type="monotone" dataKey="weight" stroke="#ea580c" fill="#ffedd5" strokeWidth={2} />
          </AreaChart>
        </ChartCard>

        <ChartCard title="Calories consumed vs burned">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="consumed" fill="#f97316" radius={[4, 4, 0, 0]} />
            <Bar dataKey="burned" fill="#262626" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Cardio distance (km)">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="cardioKm" stroke="#ea580c" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Workout minutes">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="workoutMinutes" fill="#6b7280" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <Card>
      <h2 className="mb-4 font-semibold text-ink-900">{title}</h2>
      <ResponsiveContainer width="100%" height={240}>
        {children}
      </ResponsiveContainer>
    </Card>
  );
}
