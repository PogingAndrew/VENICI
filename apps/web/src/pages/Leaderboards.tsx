import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/apiClient";
import { Card } from "../components/ui/Card";
import { EmptyState, LoadingBlock } from "../components/ui/EmptyState";
import { formatPace } from "../lib/geolocation";

type Category = "volume" | "distance" | "pace" | "goals";
type Period = "all" | "month" | "week";

interface Entry {
  userId: string;
  name: string;
  value: number;
  rank: number;
}

interface LeaderboardResponse {
  category: Category;
  period: Period;
  entries: Entry[];
  you: Entry | null;
  totalRanked: number;
}

const CATEGORY_TABS: { id: Category; label: string; icon: string; supportsPeriod: boolean }[] = [
  { id: "volume", label: "Heaviest Lifted", icon: "🏋️", supportsPeriod: true },
  { id: "distance", label: "Cardio Distance", icon: "🏃", supportsPeriod: true },
  { id: "pace", label: "Fastest Pace", icon: "⚡", supportsPeriod: true },
  { id: "goals", label: "Goals Completed", icon: "🎯", supportsPeriod: false },
];

const PERIOD_LABELS: Record<Period, string> = { all: "All time", month: "This month", week: "This week" };

function formatValue(category: Category, value: number): string {
  switch (category) {
    case "volume":
      return `${value.toLocaleString()} kg`;
    case "distance":
      return `${value.toLocaleString()} km`;
    case "pace":
      return formatPace(value);
    case "goals":
      return `${value} goal${value === 1 ? "" : "s"}`;
  }
}

const MEDAL = ["🥇", "🥈", "🥉"];

export default function Leaderboards() {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category>("volume");
  const [period, setPeriod] = useState<Period>("all");
  const [data, setData] = useState<LeaderboardResponse | null>(null);

  useEffect(() => {
    setData(null);
    api
      .get<LeaderboardResponse>(`/leaderboard?category=${category}&period=${period}`)
      .then(setData);
  }, [category, period]);

  const activeTab = CATEGORY_TABS.find((t) => t.id === category)!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Leaderboards</h1>
        <p className="text-sm text-ink-500">See how your training stacks up against everyone else.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCategory(tab.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              category === tab.id
                ? "bg-brand-500 text-white"
                : "bg-white text-ink-500 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab.supportsPeriod && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-500">Period:</span>
          {(["all", "month", "week"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                period === p ? "bg-ink-900 text-white" : "bg-white text-ink-500 border border-slate-200"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      )}

      {!data ? (
        <LoadingBlock />
      ) : data.entries.length === 0 ? (
        <EmptyState
          icon={activeTab.icon}
          title="No data yet for this category."
          hint={
            category === "volume"
              ? "Log a workout with sets, reps, and weight to appear here."
              : category === "distance" || category === "pace"
                ? "Complete a running or cardio activity to appear here."
                : "Complete a weight-related goal to appear here."
          }
        />
      ) : (
        <>
          {data.you && data.you.rank > 20 && (
            <Card className="border-brand-200 bg-brand-50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Your rank</p>
                  <p className="text-lg font-bold text-ink-900">
                    #{data.you.rank} of {data.totalRanked}
                  </p>
                </div>
                <p className="text-lg font-bold text-brand-700">{formatValue(category, data.you.value)}</p>
              </div>
            </Card>
          )}

          <Card>
            <div className="divide-y divide-slate-100">
              {data.entries.map((entry) => {
                const isYou = entry.userId === user?.id;
                return (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between py-3 px-2 rounded-lg ${
                      isYou ? "bg-brand-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-center text-sm font-semibold text-ink-500">
                        {MEDAL[entry.rank - 1] ?? `#${entry.rank}`}
                      </span>
                      <span className={`text-sm ${isYou ? "font-bold text-brand-700" : "text-ink-900"}`}>
                        {entry.name}
                        {isYou && <span className="ml-2 text-xs font-semibold text-brand-700">(You)</span>}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-ink-900">
                      {formatValue(category, entry.value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
