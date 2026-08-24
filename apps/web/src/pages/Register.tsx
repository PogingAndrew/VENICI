import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/EmptyState";

type Sex = "MALE" | "FEMALE" | "OTHER";
type ActivityLevel = "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE" | "VERY_ACTIVE";

export default function Register() {
  const { register, user } = useAuth();

  // Step 1: account
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2: fitness profile — everything BMI / TDEE / goal tracking needs
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState<Sex>("MALE");
  const [heightCm, setHeightCm] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("MODERATE");
  const [currentWeightKg, setCurrentWeightKg] = useState("");
  const [targetWeightKg, setTargetWeightKg] = useState("");

  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  function goToStep2(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStep(2);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({
        email,
        password,
        name,
        dateOfBirth: new Date(dateOfBirth).toISOString(),
        sex,
        heightCm: Number(heightCm),
        activityLevel,
        currentWeightKg: Number(currentWeightKg),
        targetWeightKg: Number(targetWeightKg),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-xl2 border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-lg font-bold text-white">
            F
          </div>
          <span className="text-lg font-bold text-ink-900">FitTrack</span>
        </div>

        <div className="mb-6 flex items-center gap-2 text-xs font-semibold text-ink-500">
          <span className={step === 1 ? "text-brand-700" : ""}>1. Account</span>
          <span className="flex-1 border-t border-dashed border-slate-200" />
          <span className={step === 2 ? "text-brand-700" : ""}>2. Fitness profile</span>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorState message={error} />
          </div>
        )}

        {step === 1 && (
          <form onSubmit={goToStep2} className="space-y-4">
            <Field label="Full name">
              <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
            </Field>
            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
              />
            </Field>
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-ink-500">
              This is used to calculate your BMI and a daily calorie target — it updates automatically
              over time instead of going stale like a fixed age would.
            </p>
            <Field label="Date of birth">
              <input
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Sex">
                <select value={sex} onChange={(e) => setSex(e.target.value as Sex)} className="input">
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Height (cm)">
                <input
                  type="number"
                  required
                  min={1}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="input"
                />
              </Field>
            </div>
            <Field label="Activity level">
              <select
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
                className="input"
              >
                <option value="SEDENTARY">Sedentary (little/no exercise)</option>
                <option value="LIGHT">Light (1–3 days/week)</option>
                <option value="MODERATE">Moderate (3–5 days/week)</option>
                <option value="ACTIVE">Active (6–7 days/week)</option>
                <option value="VERY_ACTIVE">Very active (physical job / 2x/day)</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Current weight (kg)">
                <input
                  type="number"
                  step="0.1"
                  required
                  min={1}
                  value={currentWeightKg}
                  onChange={(e) => setCurrentWeightKg(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Goal weight (kg)">
                <input
                  type="number"
                  step="0.1"
                  required
                  min={1}
                  value={targetWeightKg}
                  onChange={(e) => setTargetWeightKg(e.target.value)}
                  className="input"
                />
              </Field>
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Creating account…" : "Create account"}
              </Button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-ink-500">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-brand-700">
            Log in
          </Link>
        </p>

        <style>{`.input { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; }`}</style>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink-700">{label}</label>
      {children}
    </div>
  );
}
