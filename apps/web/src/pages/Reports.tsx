import { useEffect, useState } from "react";
import { api } from "../lib/apiClient";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState, LoadingBlock } from "../components/ui/EmptyState";

interface ReportSummary {
  weightChangeKg: number | null;
  avgCaloriesConsumed: number;
  avgProteinG: number;
  totalWorkouts: number;
  totalCardioSessions: number;
  totalCardioDistanceKm: number;
  totalCaloriesBurned: number;
  avgDailyActivityMinutes: number;
}

interface Report {
  id: string;
  periodStart: string;
  periodEnd: string;
  summaryJson: ReportSummary;
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export default function Reports() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [generating, setGenerating] = useState(false);

  function load() {
    api.get<Report[]>("/reports").then(setReports);
  }
  useEffect(load, []);

  async function generate(periodDays: number) {
    setGenerating(true);
    try {
      await api.post("/reports/generate", {
        periodStart: isoDaysAgo(periodDays),
        periodEnd: new Date().toISOString(),
      });
      load();
    } finally {
      setGenerating(false);
    }
  }

  if (!reports) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Reports</h1>
          <p className="text-sm text-ink-500">Generate a weekly or monthly summary of your activity.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={generating} onClick={() => generate(7)}>
            Generate weekly
          </Button>
          <Button disabled={generating} onClick={() => generate(30)}>
            Generate monthly
          </Button>
        </div>
      </div>

      {reports.length === 0 ? (
        <EmptyState title="No reports yet." hint="Generate a weekly or monthly report to see a summary here." />
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <Card key={r.id}>
              <p className="mb-3 text-sm font-semibold text-ink-900">
                {new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Metric label="Weight change" value={r.summaryJson.weightChangeKg != null ? `${r.summaryJson.weightChangeKg} kg` : "—"} />
                <Metric label="Avg calories" value={`${r.summaryJson.avgCaloriesConsumed}`} />
                <Metric label="Avg protein" value={`${r.summaryJson.avgProteinG} g`} />
                <Metric label="Total workouts" value={`${r.summaryJson.totalWorkouts}`} />
                <Metric label="Cardio sessions" value={`${r.summaryJson.totalCardioSessions}`} />
                <Metric label="Cardio distance" value={`${r.summaryJson.totalCardioDistanceKm} km`} />
                <Metric label="Calories burned" value={`${r.summaryJson.totalCaloriesBurned}`} />
                <Metric label="Avg activity/day" value={`${r.summaryJson.avgDailyActivityMinutes} min`} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-500">{label}</p>
      <p className="text-lg font-bold text-ink-900">{value}</p>
    </div>
  );
}
