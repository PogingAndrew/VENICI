import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/apiClient";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { LoadingBlock } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";

interface Food {
  id: string;
  name: string;
  servingSize: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  isCustom?: boolean;
}

interface MealItem {
  id: string;
  quantity: number;
  food: Food;
}

interface Meal {
  id: string;
  type: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  items: MealItem[];
}

const MEAL_TYPES: Meal["type"][] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];
const MEAL_LABELS: Record<Meal["type"], string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snacks",
};

export default function Nutrition() {
  const [meals, setMeals] = useState<Meal[] | null>(null);
  const [totals, setTotals] = useState({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [addingTo, setAddingTo] = useState<Meal["type"] | null>(null);

  const [myFoods, setMyFoods] = useState<Food[] | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [newFood, setNewFood] = useState({
    name: "",
    servingSize: "",
    calories: "",
    proteinG: "",
    carbsG: "",
    fatG: "",
    fiberG: "",
  });

  function load() {
    api.get<{ meals: Meal[]; totals: typeof totals }>("/meals").then((data) => {
      setMeals(data.meals);
      setTotals(data.totals);
    });
  }
  function loadMyFoods() {
    api.get<Food[]>("/foods?mine=true").then(setMyFoods);
  }
  useEffect(() => {
    load();
    loadMyFoods();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      api.get<Food[]>(`/foods?q=${encodeURIComponent(query)}`).then(setResults);
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  async function addFood(food: Food) {
    if (!addingTo) return;
    await api.post("/meals/items", { mealType: addingTo, foodId: food.id, quantity: 1 });
    setQuery("");
    setResults([]);
    setAddingTo(null);
    load();
  }

  async function updateQty(item: MealItem, quantity: number) {
    if (quantity <= 0) return;
    await api.patch(`/meals/items/${item.id}`, { quantity });
    load();
  }

  async function removeItem(item: MealItem) {
    await api.delete(`/meals/items/${item.id}`);
    load();
  }

  async function createCustomFood(e: FormEvent) {
    e.preventDefault();
    await api.post("/foods", {
      name: newFood.name,
      servingSize: newFood.servingSize,
      calories: Number(newFood.calories),
      proteinG: Number(newFood.proteinG),
      carbsG: newFood.carbsG ? Number(newFood.carbsG) : 0,
      fatG: Number(newFood.fatG),
      fiberG: Number(newFood.fiberG),
    });
    setNewFood({ name: "", servingSize: "", calories: "", proteinG: "", carbsG: "", fatG: "", fiberG: "" });
    setLibraryOpen(false);
    loadMyFoods();
  }

  async function deleteCustomFood(food: Food) {
    if (!confirm(`Delete "${food.name}" from your personal library?`)) return;
    await api.delete(`/foods/${food.id}`);
    loadMyFoods();
  }

  if (!meals) return <LoadingBlock />;

  const mealsByType = Object.fromEntries(MEAL_TYPES.map((t) => [t, meals.find((m) => m.type === t)]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Nutrition</h1>
        <p className="text-sm text-ink-500">Log meals and keep an eye on your macros.</p>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold text-ink-900">Today's totals</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Stat label="Calories" value={Math.round(totals.calories)} />
          <Stat label="Protein" value={`${Math.round(totals.proteinG)} g`} />
          <Stat label="Carbs" value={`${Math.round(totals.carbsG)} g`} />
          <Stat label="Fat" value={`${Math.round(totals.fatG)} g`} />
          <Stat label="Fiber" value={`${Math.round(totals.fiberG)} g`} />
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-ink-900">My food library</h2>
            <p className="text-xs text-ink-500">
              Custom foods you've added — only visible to you, and searchable when logging meals.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setLibraryOpen(true)}>
            + Add custom food
          </Button>
        </div>

        {!myFoods ? (
          <LoadingBlock />
        ) : myFoods.length === 0 ? (
          <p className="text-sm text-ink-500">
            No custom foods yet. Add one for anything not in the shared database.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {myFoods.map((food) => (
              <div
                key={food.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-ink-900">{food.name}</p>
                  <p className="text-xs text-ink-500">
                    {food.servingSize} · {food.calories} kcal · P{food.proteinG} C{food.carbsG} F
                    {food.fatG} Fib{food.fiberG}
                  </p>
                </div>
                <button
                  onClick={() => deleteCustomFood(food)}
                  className="text-xs font-semibold text-red-500"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="space-y-4">
        {MEAL_TYPES.map((type) => {
          const meal = mealsByType[type];
          return (
            <Card key={type}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-ink-900">{MEAL_LABELS[type]}</h3>
                <Button variant="secondary" onClick={() => setAddingTo(type)}>
                  + Add food
                </Button>
              </div>

              {!meal || meal.items.length === 0 ? (
                <p className="text-sm text-ink-500">No food logged yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {meal.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium text-ink-900">{item.food.name}</p>
                        <p className="text-xs text-ink-500">
                          {item.food.servingSize} × {item.quantity} ·{" "}
                          {Math.round(item.food.calories * item.quantity)} kcal
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          defaultValue={item.quantity}
                          onBlur={(e) => updateQty(item, Number(e.target.value))}
                          className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        />
                        <button onClick={() => removeItem(item)} className="text-xs text-red-500">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {addingTo === type && (
                <div className="mt-3 rounded-lg border border-slate-200 p-3">
                  <input
                    autoFocus
                    placeholder="Search foods…"
                    className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {results.length > 0 && (
                    <div className="max-h-56 space-y-1 overflow-y-auto">
                      {results.map((food) => (
                        <button
                          key={food.id}
                          onClick={() => addFood(food)}
                          className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
                        >
                          <span>
                            {food.name}
                            {food.isCustom && (
                              <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                                Personal
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-ink-500">
                            {food.calories} kcal / {food.servingSize}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setAddingTo(null);
                      setQuery("");
                      setResults([]);
                    }}
                    className="mt-2 text-xs text-ink-500"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Modal open={libraryOpen} onClose={() => setLibraryOpen(false)} title="Add a custom food">
        <form onSubmit={createCustomFood} className="space-y-3">
          <input
            required
            placeholder="Food name"
            className="input"
            value={newFood.name}
            onChange={(e) => setNewFood({ ...newFood, name: e.target.value })}
          />
          <input
            required
            placeholder="Serving size (e.g. 1 cup, 100 g)"
            className="input"
            value={newFood.servingSize}
            onChange={(e) => setNewFood({ ...newFood, servingSize: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              type="number"
              placeholder="Calories"
              className="input"
              value={newFood.calories}
              onChange={(e) => setNewFood({ ...newFood, calories: e.target.value })}
            />
            <input
              required
              type="number"
              placeholder="Protein (g)"
              className="input"
              value={newFood.proteinG}
              onChange={(e) => setNewFood({ ...newFood, proteinG: e.target.value })}
            />
            <input
              type="number"
              placeholder="Carbs (g)"
              className="input"
              value={newFood.carbsG}
              onChange={(e) => setNewFood({ ...newFood, carbsG: e.target.value })}
            />
            <input
              required
              type="number"
              placeholder="Fat (g)"
              className="input"
              value={newFood.fatG}
              onChange={(e) => setNewFood({ ...newFood, fatG: e.target.value })}
            />
            <input
              required
              type="number"
              placeholder="Fiber (g)"
              className="input"
              value={newFood.fiberG}
              onChange={(e) => setNewFood({ ...newFood, fiberG: e.target.value })}
            />
          </div>
          <Button type="submit" className="w-full">
            Save to my library
          </Button>
        </form>
        <style>{`.input { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; }`}</style>
      </Modal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-ink-500">{label}</p>
      <p className="text-lg font-bold text-ink-900">{value}</p>
    </div>
  );
}
