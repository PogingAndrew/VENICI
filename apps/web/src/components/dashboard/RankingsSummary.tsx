import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/apiClient";
import { Card } from "../ui/Card";
import { LoadingBlock } from "../ui/EmptyState";
import { formatPace } from "../../lib/geolocation";

interface RankInfo {
  you: { rank: number; value: number } | null;
  totalRanked: number;
}

interface Summary {
  volume: RankInfo;
  distance: RankInfo;
  pace: RankInfo;
  goals: RankInfo;
}

const CATEGORIES: { key: keyof Summary; label: string; icon: string; format: (v: number) => string }[] = [
  { key: "volume", label: "Heaviest lifted", icon: "🏋️", format: (v) => `${v.toLocaleString()} kg` },
  { key: "distance", label: "Cardio distance", icon: "🏃", format: (v) => `${v.toLocaleString()} km` },
  { key: "pace", label: "Fastest pace", icon: "⚡", format: (v) => formatPace(v) },
  { key: "goals", label: "Goals completed", icon: "🎯", format: (v) => `${v}` },
];

export function RankingsSummary() {
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    api.get<Summary>("/leaderboard/summary").then(setData);
  }, []);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-ink-900">Your Rankings</h2>
        <Link to="/leaderboards" className="text-sm font-semibold text-brand-700">
          View leaderboards →
        </Link>
      </div>

      {!data ? (
        <LoadingBlock />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {CATEGORIES.map(({ key, label, icon, format }) => {
            const info = data[key];
            return (
              <div key={key}>
                <p className="text-xs text-ink-500">
                  {icon} {label}
                </p>
                {info.you ? (
                  <>
                    <p className="text-lg font-bold text-brand-700">#{info.you.rank}</p>
                    <p className="text-xs text-ink-500">
                      {format(info.you.value)} · of {info.totalRanked}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-ink-500">Not ranked yet</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
