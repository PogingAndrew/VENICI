import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/apiClient";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ProgressBar } from "../components/ui/ProgressBar";
import { EmptyState, LoadingBlock, ErrorState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { WEIGHT_GOAL_TYPES } from "../lib/goalTypes";

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

  const [createOpen, setCreateOpen] = useState(false);
  const [type, setType] = useState("WEIGHT_LOSS");
  const [targetValue, setTargetValue] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [editTargetValue, setEditTargetValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const [weightPrompt, setWeightPrompt] = useState<Goal | null>(null);

  function load() {
    api.get<Goal[]>("/goals").then(setGoals);
    api
      .get<{ currentWeightKg: number | null }>("/profile")
      .then((p) => setCurrentWeightKg(p.currentWeightKg));
  }
  useEffect(load, []);

  const hasActiveGoal = goals?.some((g) => g.status === "ACTIVE") ?? false;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      await api.post("/goals", { type, targetValue: Number(targetValue) });
      setCreateOpen(false);
      setTargetValue("");
      load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create goal");
    }
  }

  function openEdit(goal: Goal) {
    setEditGoal(goal);
    setEditTargetValue(String(goal.targetValue));
    setEditError(null);
  }

  async function handleEditSave(e: FormEvent) {
    e.preventDefault();
    if (!editGoal) return;
    setEditError(null);
    try {
      await api.patch(`/goals/${editGoal.id}`, { targetValue: Number(editTargetValue) });
      setEditGoal(null);
      load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Could not update goal");
    }
  }

  async function updateCurrent(goal: Goal, value: number) {
    await api.patch(`/goals/${goal.id}`, { currentValue: value });
    load();
  }

  // Marking a weight-type goal complete offers to log the target weight as
  // the new current weight, rather than silently leaving it stale.
  async function markComplete(goal: Goal) {
    if (WEIGHT_GOAL_TYPES.includes(goal.type)) {
      setWeightPrompt(goal);
    } else {
      await api.patch(`/goals/${goal.id}`, { status: "COMPLETED" });
      load();
    }
  }

  async function confirmCompleteWithWeightSync(sync: boolean) {
    if (!weightPrompt) return;
    await api.patch(`/goals/${weightPrompt.id}`, {
      status: "COMPLETED",
      syncCurrentWeight: sync,
    });
    setWeightPrompt(null);
    load();
  }

  async function removeGoal(goal: Goal) {
    if (!confirm(`Delete this ${TYPE_LABELS[goal.type].toLowerCase()} goal? This can't be undone.`)) return;
    await api.delete(`/goals/${goal.id}`);
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
        <Button onClick={() => setCreateOpen(true)} disabled={hasActiveGoal} title={
          hasActiveGoal ? "Complete, delete, or update your active goal before creating a new one" : undefined
        }>
          + New goal
        </Button>
      </div>

      {hasActiveGoal && (
        <p className="text-xs text-ink-500">
          Only one active goal at a time — complete, delete, or edit your current one to start a new one.
        </p>
      )}

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
                </div>
                <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3 text-xs font-semibold">
                  {goal.status === "ACTIVE" && (
                    <>
                      <button onClick={() => markComplete(goal)} className="text-brand-700">
                        Mark complete
                      </button>
                      <button onClick={() => openEdit(goal)} className="text-ink-500">
                        Edit
                      </button>
                    </>
                  )}
                  <button onClick={() => removeGoal(goal)} className="ml-auto text-red-500">
                    Delete
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create goal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a goal">
        <form onSubmit={handleCreate} className="space-y-4">
          {createError && <ErrorState message={createError} />}
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
            Starting point:{" "}
            <span className="font-semibold">
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

      {/* Edit goal */}
      <Modal open={editGoal != null} onClose={() => setEditGoal(null)} title="Edit goal">
        <form onSubmit={handleEditSave} className="space-y-4">
          {editError && <ErrorState message={editError} />}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Target value</label>
            <input
              type="number"
              step="0.1"
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={editTargetValue}
              onChange={(e) => setEditTargetValue(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full">
            Save changes
          </Button>
        </form>
      </Modal>

      {/* Weight-sync prompt on completing a weight-type goal */}
      <Modal
        open={weightPrompt != null}
        onClose={() => confirmCompleteWithWeightSync(false)}
        title="Goal completed 🎉"
      >
        <p className="mb-4 text-sm text-ink-700">
          Update your current weight to{" "}
          <span className="font-semibold">{weightPrompt?.targetValue} kg</span> to match this goal?
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => confirmCompleteWithWeightSync(false)}>
            No, keep as is
          </Button>
          <Button className="flex-1" onClick={() => confirmCompleteWithWeightSync(true)}>
            Yes, update weight
          </Button>
        </div>
      </Modal>
    </div>
  );
}
