import { FormEvent, useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { LoadingBlock } from "../../components/ui/EmptyState";

interface Exercise {
  id: string;
  name: string;
  category: string;
  description: string | null;
}

const CATEGORIES = ["CHEST", "BACK", "LEGS", "SHOULDERS", "ARMS", "CORE", "FULL_BODY", "CARDIO"];

export default function AdminExercises() {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [filter, setFilter] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);

  function load(cat = "") {
    api.get<Exercise[]>(`/exercises${cat ? `?category=${cat}` : ""}`).then(setExercises);
  }
  useEffect(() => load(), []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await api.post("/exercises", { name, category });
    setName("");
    load(filter);
  }

  async function remove(ex: Exercise) {
    if (!confirm(`Delete ${ex.name}?`)) return;
    await api.delete(`/exercises/${ex.id}`);
    load(filter);
  }

  if (!exercises) return <LoadingBlock />;

  const grouped = CATEGORIES.map((cat) => ({
    cat,
    items: exercises.filter((e) => e.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Exercise Database</h1>
        <p className="text-sm text-white/60">Manage the exercises users can add to workouts.</p>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold text-ink-900">Add an exercise</h2>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-3">
          <input
            placeholder="Exercise name"
            required
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Button type="submit">Add</Button>
        </form>
      </Card>

      <div className="flex gap-2">
        <button
          onClick={() => {
            setFilter("");
            load("");
          }}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            !filter ? "bg-brand-500 text-white" : "bg-white text-ink-500"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => {
              setFilter(c);
              load(c);
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              filter === c ? "bg-brand-500 text-white" : "bg-white text-ink-500"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {grouped.map((g) => (
          <Card key={g.cat}>
            <h3 className="mb-2 text-sm font-semibold text-ink-900">{g.cat.replace("_", " ")}</h3>
            <div className="divide-y divide-slate-100">
              {g.items.map((ex) => (
                <div key={ex.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{ex.name}</span>
                  <button onClick={() => remove(ex)} className="text-xs font-semibold text-red-500">
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
