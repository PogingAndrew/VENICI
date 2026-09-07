import { FormEvent, useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { LoadingBlock } from "../../components/ui/EmptyState";

interface Food {
  id: string;
  name: string;
  servingSize: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

const EMPTY = { name: "", servingSize: "", calories: "", proteinG: "", carbsG: "", fatG: "", fiberG: "" };

export default function AdminFoods() {
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(EMPTY);

  function load(q = "") {
    api.get<Food[]>(`/foods${q ? `?q=${encodeURIComponent(q)}` : ""}`).then(setFoods);
  }
  useEffect(() => load(), []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    await api.post("/foods", {
      name: form.name,
      servingSize: form.servingSize,
      calories: Number(form.calories),
      proteinG: Number(form.proteinG),
      carbsG: Number(form.carbsG),
      fatG: Number(form.fatG),
      fiberG: Number(form.fiberG),
      shared: true,
    });
    setForm(EMPTY);
    load(query);
  }

  async function remove(food: Food) {
    if (!confirm(`Delete ${food.name}?`)) return;
    await api.delete(`/foods/${food.id}`);
    load(query);
  }

  if (!foods) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Food Database</h1>
        <p className="text-sm text-white/60">Manage the shared foods users log meals from.</p>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold text-ink-900">Add a food</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <input placeholder="Name" required className="input col-span-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Serving size" required className="input" value={form.servingSize} onChange={(e) => setForm({ ...form, servingSize: e.target.value })} />
          <input placeholder="Calories" type="number" required className="input" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} />
          <input placeholder="Protein (g)" type="number" required className="input" value={form.proteinG} onChange={(e) => setForm({ ...form, proteinG: e.target.value })} />
          <input placeholder="Carbs (g)" type="number" required className="input" value={form.carbsG} onChange={(e) => setForm({ ...form, carbsG: e.target.value })} />
          <input placeholder="Fat (g)" type="number" required className="input" value={form.fatG} onChange={(e) => setForm({ ...form, fatG: e.target.value })} />
          <input placeholder="Fiber (g)" type="number" required className="input" value={form.fiberG} onChange={(e) => setForm({ ...form, fiberG: e.target.value })} />
          <Button type="submit" className="col-span-2 md:col-span-1">Add food</Button>
        </form>
      </Card>

      <Card>
        <input
          placeholder="Search foods…"
          className="input mb-3"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            load(e.target.value);
          }}
        />
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-500">
              <th className="pb-2">Name</th>
              <th className="pb-2">Serving</th>
              <th className="pb-2">Cal</th>
              <th className="pb-2">P</th>
              <th className="pb-2">C</th>
              <th className="pb-2">F</th>
              <th className="pb-2">Fiber</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {foods.map((f) => (
              <tr key={f.id} className="border-t border-slate-100">
                <td className="py-2">{f.name}</td>
                <td className="py-2">{f.servingSize}</td>
                <td className="py-2">{f.calories}</td>
                <td className="py-2">{f.proteinG}</td>
                <td className="py-2">{f.carbsG}</td>
                <td className="py-2">{f.fatG}</td>
                <td className="py-2">{f.fiberG}</td>
                <td className="py-2 text-right">
                  <button onClick={() => remove(f)} className="text-xs font-semibold text-red-500">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <style>{`.input { border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; width: 100%; }`}</style>
    </div>
  );
}
