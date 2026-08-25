import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/apiClient";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ProgressBar } from "../components/ui/ProgressBar";
import { EmptyState, LoadingBlock, ErrorState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";

interface Goal {
  id: string;
  type: string;
  startingValue: number;
  targetValue: number;
  currentValue: number;
  status: "ACTIVE" | "COMPLETED" | "ABANDONED";
  targetDate: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  WEIGHT_LOSS: "Weight loss",
  WEIGHT_GAIN: "Weight gain",
  WEIGHT_MAINTENANCE: "Weight maintenance",
  FITNESS_IMPROVEMENT: "Fitness improvement",
};

export default function Goals() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [currentWeightKg, setCurrentWeightKg] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [type, setType] = useState("WEIGHT_LOSS");
  const [targetValue, setTargetValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<Goal[]>("/goals").then(setGoals);
    api.get<{ currentWeightKg: number | null }>("/profile").then((p) => setCurrentWeightKg(p.currentWeightKg));
  }
  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      // No "starting value" field — the backend uses the current logged
      // weight as the starting point automatically.
      await api.post("/goals", { type, targetValue: Number(targetValue) });
      setModalOpen(false);
      setTargetValue("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create goal");
    }
  }

  async function updateCurrent(goal: Goal, value: number) {
    await api.patch(`/goals/${goal.id}`, { currentValue: value });
    load();
  }

  async function markStatus(goal: Goal, status: string) {
    await api.patch(`/goals/${goal.id}`, { status });
    load();
  }

  if (!goals) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Goals</h1>
          <p className="text-sm text-ink-500">Set a target and track your progress toward it.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ New goal</Button>
      </div>

      {goals.length === 0 ? (
        <EmptyState title="No goals yet" hint="Create a weight or fitness goal to start tracking progress." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {goals.map((goal) => {
            const total = Math.abs(goal.startingValue - goal.targetValue) || 1;
            const done = Math.abs(goal.startingValue - goal.currentValue);
            return (
              <Card key={goal.id}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                    {TYPE_LABELS[goal.type]}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      goal.status === "COMPLETED" ? "text-brand-700" : "text-ink-500"
                    }`}
                  >
                    {goal.status}
                  </span>
                </div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-lg font-bold text-ink-900">{goal.startingValue}</span>
                  <span className="text-ink-400">→</span>
                  <span className="text-lg font-bold text-brand-700">{goal.targetValue}</span>
                </div>
                <ProgressBar value={done} max={total} />
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    defaultValue={goal.currentValue}
                    onBlur={(e) => updateCurrent(goal, Number(e.target.value))}
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-ink-500">current value</span>
                  {goal.status === "ACTIVE" && (
                    <button
                      onClick={() => markStatus(goal, "COMPLETED")}
                      className="ml-auto text-xs font-semibold text-brand-700"
                    >
                      Mark complete
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create a goal">
        <form onSubmit={handleCreate} className="space-y-4">
          {error && <ErrorState message={error} />}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Goal type</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-ink-700">
            Starting point: <span className="font-semibold">
              {currentWeightKg != null ? `${currentWeightKg} kg (your current weight)` : "no weight logged yet"}
            </span>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Target value</label>
            <input
              type="number"
              step="0.1"
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={currentWeightKg == null}>
            Create goal
          </Button>
          {currentWeightKg == null && (
            <p className="text-xs text-ink-500">
              Log a weight on your profile first so we have a starting point.
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
}
