import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../lib/apiClient";
import { Card, StatCard } from "../components/ui/Card";
import { ProgressBar } from "../components/ui/ProgressBar";
import { LoadingBlock, ErrorState } from "../components/ui/EmptyState";
import { Link } from "react-router-dom";

interface TodaySummary {
  date: string;
  weightKg: number | null;
  caloriesConsumed: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  caloriesBurned: number;
  cardioDistanceM: number;
  workoutMinutes: number;
  steps: number;
  cardioSessions: number;
  workoutSessions: number;
  calorieTarget: number | null;
  bmi: number | null;
  activeGoal: {
    startingValue: number;
    targetValue: number;
    currentValue: number;
  } | null;
}

interface SnapshotPoint {
  date: string;
  weightKg: number | null;
  caloriesConsumed: number;
  caloriesBurned: number;
  cardioDistanceM: number;
  workoutMinutes: number;
}

const MACRO_TARGETS = { proteinG: 140, carbsG: 250, fatG: 70, fiberG: 30 };

export default function Dashboard() {
  const [today, setToday] = useState<TodaySummary | null>(null);
  const [history, setHistory] = useState<SnapshotPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<TodaySummary>("/progress/today"),
      api.get<SnapshotPoint[]>("/progress/history?days=14"),
    ])
      .then(([t, h]) => {
        setToday(t);
        setHistory(h);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!today) return <LoadingBlock />;

  const goal = today.activeGoal;
  const goalProgressPct = goal
    ? Math.min(
        100,
        Math.round(
          (Math.abs(goal.startingValue - goal.currentValue) /
            Math.max(0.01, Math.abs(goal.startingValue - goal.targetValue))) *
            100
        )
      )
    : null;

  const chartData = history.map((h) => ({
    date: new Date(h.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    calories: Math.round(h.caloriesConsumed),
    burned: Math.round(h.caloriesBurned),
    weight: h.weightKg,
    cardioKm: Number((h.cardioDistanceM / 1000).toFixed(1)),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Dashboard</h1>
        <p className="text-sm text-ink-500">Here's where things stand today.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Current weight" value={today.weightKg ? `${today.weightKg} kg` : "—"} />
        <StatCard label="Target weight" value={goal ? `${goal.targetValue} kg` : "No goal set"} />
        <StatCard
          label="Calories consumed"
          value={`${Math.round(today.caloriesConsumed)}`}
          sub={today.calorieTarget ? `of ${today.calorieTarget} target` : undefined}
        />
        <StatCard label="Calories burned" value={`${Math.round(today.caloriesBurned)} kcal`} accent="ink" />
        <StatCard label="BMI" value={today.bmi != null ? `${today.bmi}` : "—"} accent="ink" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Nutrition section */}
        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-semibold text-ink-900">Nutrition today</h2>
          <div className="space-y-4">
            <ProgressBar
              label="Calories"
              value={today.caloriesConsumed}
              max={today.calorieTarget ?? 2200}
            />
            <ProgressBar
              label="Protein (g)"
              value={today.proteinG}
              max={MACRO_TARGETS.proteinG}
              color="bg-sky-500"
            />
            <ProgressBar
              label="Carbohydrates (g)"
              value={today.carbsG}
              max={MACRO_TARGETS.carbsG}
              color="bg-amber-500"
            />
            <ProgressBar label="Fat (g)" value={today.fatG} max={MACRO_TARGETS.fatG} color="bg-rose-500" />
            <ProgressBar
              label="Fiber (g)"
              value={today.fiberG}
              max={MACRO_TARGETS.fiberG}
              color="bg-emerald-500"
            />
          </div>
          <Link to="/nutrition" className="mt-4 inline-block text-sm font-semibold text-brand-700">
            Log food →
          </Link>
        </Card>

        {/* Goal section */}
        <Card>
          <h2 className="mb-4 font-semibold text-ink-900">Goal progress</h2>
          {goal ? (
            <>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold text-ink-900">{goal.startingValue} kg</span>
                <span className="text-ink-500">→</span>
                <span className="font-semibold text-brand-700">{goal.targetValue} kg</span>
              </div>
              <ProgressBar value={goalProgressPct ?? 0} max={100} />
              <p className="mt-2 text-xs text-ink-500">
                Current: {goal.currentValue} kg · {goalProgressPct}% of the way there
              </p>
            </>
          ) : (
            <div className="text-sm text-ink-500">
              No active goal yet.{" "}
              <Link to="/goals" className="font-semibold text-brand-700">
                Set one →
              </Link>
            </div>
          )}
        </Card>
      </div>

      {/* Activity section */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Steps" value={`${today.steps}`} />
        <StatCard label="Workout minutes" value={`${today.workoutMinutes} min`} />
        <StatCard label="Cardio distance" value={`${(today.cardioDistanceM / 1000).toFixed(2)} km`} />
        <StatCard label="Sessions today" value={`${today.cardioSessions + today.workoutSessions}`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold text-ink-900">Weight history</h2>
          {chartData.some((d) => d.weight) ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16c98a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#16c98a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={["dataMin - 2", "dataMax + 2"]} />
                <Tooltip />
                <Area type="monotone" dataKey="weight" stroke="#0ea36e" fill="url(#weightGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-ink-500">Log a body measurement to see this chart.</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold text-ink-900">Calories consumed vs. burned</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="calories" fill="#16c98a" radius={[4, 4, 0, 0]} name="Consumed" />
              <Bar dataKey="burned" fill="#26313d" radius={[4, 4, 0, 0]} name="Burned" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
