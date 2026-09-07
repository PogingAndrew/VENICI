import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/apiClient";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState, LoadingBlock } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";

interface Exercise {
  id: string;
  name: string;
  category: string;
}

interface WorkoutExercise {
  id: string;
  sets: number;
  reps: number;
  weightKg: number | null;
  exercise: Exercise;
}

interface Workout {
  id: string;
  name: string;
  performedAt: string;
  durationMin: number | null;
  caloriesBurned: number | null;
  notes: string | null;
  exercises: WorkoutExercise[];
}

interface DraftExercise {
  exerciseId: string;
  sets: string;
  reps: string;
  weightKg: string;
}

export default function Workouts() {
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [caloriesBurned, setCaloriesBurned] = useState("");
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([]);

  function load() {
    api.get<Workout[]>("/workouts").then(setWorkouts);
    api.get<Exercise[]>("/exercises").then(setExercises);
  }
  useEffect(load, []);

  function addDraftExercise() {
    setDraftExercises([
      ...draftExercises,
      { exerciseId: exercises[0]?.id ?? "", sets: "3", reps: "10", weightKg: "" },
    ]);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    await api.post("/workouts", {
      name,
      durationMin: durationMin ? Number(durationMin) : undefined,
      caloriesBurned: caloriesBurned ? Number(caloriesBurned) : undefined,
      exercises: draftExercises
        .filter((d) => d.exerciseId)
        .map((d) => ({
          exerciseId: d.exerciseId,
          sets: Number(d.sets),
          reps: Number(d.reps),
          weightKg: d.weightKg ? Number(d.weightKg) : undefined,
        })),
    });
    setModalOpen(false);
    setName("");
    setDurationMin("");
    setCaloriesBurned("");
    setDraftExercises([]);
    load();
  }

  async function remove(workout: Workout) {
    await api.delete(`/workouts/${workout.id}`);
    load();
  }

  if (!workouts) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Workouts</h1>
          <p className="text-sm text-ink-500">Log strength training sessions and track your history.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Log workout</Button>
      </div>

      {workouts.length === 0 ? (
        <EmptyState title="No workouts recorded yet." hint="Log your first strength session to see it here." />
      ) : (
        <div className="space-y-3">
          {workouts.map((w) => (
            <Card key={w.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-ink-900">{w.name}</p>
                  <p className="text-xs text-ink-500">
                    {new Date(w.performedAt).toLocaleDateString()} ·{" "}
                    {w.durationMin ? `${w.durationMin} min · ` : ""}
                    {w.caloriesBurned ? `${w.caloriesBurned} kcal` : "no calories logged"}
                  </p>
                </div>
                <button onClick={() => remove(w)} className="text-xs text-red-500">
                  Delete
                </button>
              </div>
              {w.exercises.length > 0 && (
                <div className="mt-3 grid grid-cols-1 gap-1 border-t border-slate-100 pt-3 sm:grid-cols-2">
                  {w.exercises.map((we) => (
                    <div key={we.id} className="text-sm text-ink-700">
                      <span className="font-medium">{we.exercise.name}</span> — {we.sets} × {we.reps}
                      {we.weightKg ? ` @ ${we.weightKg}kg` : ""}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log a workout">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Workout name</label>
            <input
              required
              placeholder="e.g. Push Day"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-700">Duration (min)</label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-700">Calories burned</label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={caloriesBurned}
                onChange={(e) => setCaloriesBurned(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-ink-700">Exercises</label>
              <button type="button" onClick={addDraftExercise} className="text-xs font-semibold text-brand-700">
                + Add exercise
              </button>
            </div>
            <div className="space-y-2">
              {draftExercises.map((d, i) => (
                <div key={i}>
                  <div className="grid grid-cols-5 gap-2">
                  <select
                    className="col-span-2 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                    value={d.exerciseId}
                    onChange={(e) => {
                      const copy = [...draftExercises];
                      copy[i].exerciseId = e.target.value;
                      setDraftExercises(copy);
                    }}
                  >
                    {exercises.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Sets"
                    className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                    value={d.sets}
                    onChange={(e) => {
                      const copy = [...draftExercises];
                      copy[i].sets = e.target.value;
                      setDraftExercises(copy);
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Reps"
                    className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                    value={d.reps}
                    onChange={(e) => {
                      const copy = [...draftExercises];
                      copy[i].reps = e.target.value;
                      setDraftExercises(copy);
                    }}
                  />
                  <input
                    type="number"
                    step="0.5"
                    placeholder="Weight (kg)"
                    className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                    value={d.weightKg}
                    onChange={(e) => {
                      const copy = [...draftExercises];
                      copy[i].weightKg = e.target.value;
                      setDraftExercises(copy);
                    }}
                  />
                  </div>
                  {Number(d.sets) > 0 && Number(d.reps) > 0 && Number(d.weightKg) > 0 && (
                    <p className="mt-1 text-xs text-ink-500">
                      Volume: {d.sets} × {d.reps} × {d.weightKg}kg ={" "}
                      <span className="font-semibold text-brand-700">
                        {(Number(d.sets) * Number(d.reps) * Number(d.weightKg)).toLocaleString()} kg
                      </span>{" "}
                      lifted
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full">
            Save workout
          </Button>
        </form>
      </Modal>
    </div>
  );
}
