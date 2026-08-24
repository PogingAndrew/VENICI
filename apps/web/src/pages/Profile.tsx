import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/apiClient";
import { Card, StatCard } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { LoadingBlock, ErrorState } from "../components/ui/EmptyState";

interface ProfileData {
  name: string;
  dateOfBirth: string | null;
  sex: "MALE" | "FEMALE" | "OTHER" | null;
  heightCm: number | null;
  activityLevel: string;
  currentWeightKg: number | null;
  age: number | null;
  bmi: number | null;
  bmiCategory: string | null;
}

export default function Profile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [form, setForm] = useState<Partial<ProfileData>>({});
  const [newWeight, setNewWeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function load() {
    api
      .get<ProfileData>("/profile")
      .then((p) => {
        setProfile(p);
        setForm(p);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await api.put("/profile", {
        name: form.name,
        dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth).toISOString() : undefined,
        sex: form.sex ?? undefined,
        heightCm: form.heightCm ? Number(form.heightCm) : undefined,
        activityLevel: form.activityLevel,
      });
      setSaved(true);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    }
  }

  async function handleAddWeight(e: FormEvent) {
    e.preventDefault();
    if (!newWeight) return;
    await api.post("/profile/measurements", { weightKg: Number(newWeight) });
    setNewWeight("");
    load();
  }

  if (error) return <ErrorState message={error} />;
  if (!profile) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Profile</h1>
        <p className="text-sm text-ink-500">Keep your details current so calorie and BMI targets stay accurate.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Age" value={profile.age != null ? `${profile.age}` : "—"} />
        <StatCard
          label="BMI"
          value={profile.bmi != null ? `${profile.bmi}` : "—"}
          sub={profile.bmiCategory ?? undefined}
        />
        <StatCard label="Height" value={profile.heightCm ? `${profile.heightCm} cm` : "—"} />
        <StatCard label="Current weight" value={profile.currentWeightKg ? `${profile.currentWeightKg} kg` : "—"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name">
                <input
                  className="input"
                  value={form.name ?? ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Date of birth">
                <input
                  type="date"
                  className="input"
                  max={new Date().toISOString().slice(0, 10)}
                  value={form.dateOfBirth ? form.dateOfBirth.slice(0, 10) : ""}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                />
              </Field>
              <Field label="Sex">
                <select
                  className="input"
                  value={form.sex ?? ""}
                  onChange={(e) => setForm({ ...form, sex: e.target.value as ProfileData["sex"] })}
                >
                  <option value="">—</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Height (cm)">
                <input
                  type="number"
                  className="input"
                  value={form.heightCm ?? ""}
                  onChange={(e) => setForm({ ...form, heightCm: Number(e.target.value) })}
                />
              </Field>
              <Field label="Activity level" full>
                <select
                  className="input"
                  value={form.activityLevel ?? "MODERATE"}
                  onChange={(e) => setForm({ ...form, activityLevel: e.target.value })}
                >
                  <option value="SEDENTARY">Sedentary (little/no exercise)</option>
                  <option value="LIGHT">Light (1–3 days/week)</option>
                  <option value="MODERATE">Moderate (3–5 days/week)</option>
                  <option value="ACTIVE">Active (6–7 days/week)</option>
                  <option value="VERY_ACTIVE">Very active (physical job / 2x/day)</option>
                </select>
              </Field>
            </div>
            {error && <ErrorState message={error} />}
            {saved && <p className="text-sm text-brand-700">Profile updated.</p>}
            <Button type="submit">Save changes</Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold text-ink-900">Log current weight</h2>
          <p className="mb-4 text-3xl font-bold text-brand-700">
            {profile.currentWeightKg ? `${profile.currentWeightKg} kg` : "—"}
          </p>
          <form onSubmit={handleAddWeight} className="flex gap-2">
            <input
              type="number"
              step="0.1"
              placeholder="New weight (kg)"
              className="input"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
            />
            <Button type="submit" variant="secondary">
              Log
            </Button>
          </form>
          <p className="mt-3 text-xs text-ink-500">
            This feeds your BMI, calorie target, and goal progress automatically.
          </p>
        </Card>
      </div>

      <style>{`.input { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; }`}</style>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <label className="mb-1 block text-sm font-medium text-ink-700">{label}</label>
      {children}
    </div>
  );
}
