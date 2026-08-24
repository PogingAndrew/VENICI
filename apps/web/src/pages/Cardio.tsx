import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/apiClient";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState, LoadingBlock, ErrorState } from "../components/ui/EmptyState";
import { formatDuration, formatPace } from "../lib/geolocation";
import { RouteMap } from "../components/maps/RouteMap";

interface CardioActivity {
  id: string;
  type: "RUNNING" | "JOGGING" | "WALKING" | "CYCLING" | "OTHER";
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
  startedAt: string;
  durationSec: number;
  distanceMeters: number;
  avgPaceSecKm: number | null;
  caloriesBurned: number;
}

const TYPES: CardioActivity["type"][] = ["RUNNING", "JOGGING", "WALKING", "CYCLING", "OTHER"];
const ICONS: Record<CardioActivity["type"], string> = {
  RUNNING: "🏃",
  JOGGING: "🏃‍♂️",
  WALKING: "🚶",
  CYCLING: "🚴",
  OTHER: "🤸",
};

export default function Cardio() {
  const [activities, setActivities] = useState<CardioActivity[] | null>(null);
  const [filterType, setFilterType] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CardioActivity | null>(null);
  const [route, setRoute] = useState<{ latitude: number; longitude: number }[]>([]);
  const navigate = useNavigate();

  function load() {
    api
      .get<CardioActivity[]>(`/cardio${filterType ? `?type=${filterType}` : ""}`)
      .then(setActivities)
      .catch((e) => setError(e.message));
  }
  useEffect(load, [filterType]);

  async function startActivity(type: CardioActivity["type"]) {
    try {
      const activity = await api.post<{ id: string }>("/cardio/start", { type });
      navigate("/cardio/live", { state: { activityId: activity.id, type } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start activity");
    }
  }

  async function openActivity(a: CardioActivity) {
    const detail = await api.get<{ routePoints: { latitude: number; longitude: number }[] }>(
      `/cardio/${a.id}`
    );
    setSelected(a);
    setRoute(detail.routePoints);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Cardio</h1>
        <p className="text-sm text-ink-500">Start a GPS-tracked activity or review your history.</p>
      </div>

      {error && <ErrorState message={error} />}

      <Card>
        <h2 className="mb-3 font-semibold text-ink-900">Start an activity</h2>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <Button key={t} variant="secondary" onClick={() => startActivity(t)}>
              {ICONS[t]} {t.charAt(0) + t.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
      </Card>

      {selected && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">
              {ICONS[selected.type]} {selected.type} — {new Date(selected.startedAt).toLocaleString()}
            </h2>
            <button onClick={() => setSelected(null)} className="text-sm text-ink-500">
              Close
            </button>
          </div>
          <div className="mb-3 h-72 overflow-hidden rounded-xl2">
            <RouteMap points={route.map((p) => ({ lat: p.latitude, lng: p.longitude }))} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MiniStat label="Distance" value={`${(selected.distanceMeters / 1000).toFixed(2)} km`} />
            <MiniStat label="Duration" value={formatDuration(selected.durationSec)} />
            <MiniStat label="Avg pace" value={formatPace(selected.avgPaceSecKm)} />
            <MiniStat label="Calories" value={`${Math.round(selected.caloriesBurned)} kcal`} />
          </div>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <span className="text-sm text-ink-500">Filter:</span>
        <select
          className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">All activity types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {!activities ? (
        <LoadingBlock />
      ) : activities.length === 0 ? (
        <EmptyState title="No cardio activities yet." hint="Start an activity above to begin GPS tracking." />
      ) : (
        <div className="space-y-3">
          {activities.map((a) => (
            <button key={a.id} onClick={() => openActivity(a)} className="block w-full text-left">
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-ink-900">
                      {ICONS[a.type]} {a.type.charAt(0) + a.type.slice(1).toLowerCase()}
                    </p>
                    <p className="text-xs text-ink-500">{new Date(a.startedAt).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-6 text-right">
                    <MiniStat label="Distance" value={`${(a.distanceMeters / 1000).toFixed(2)} km`} />
                    <MiniStat label="Duration" value={formatDuration(a.durationSec)} />
                    <MiniStat label="Calories" value={`${Math.round(a.caloriesBurned)} kcal`} />
                  </div>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-500">{label}</p>
      <p className="text-sm font-semibold text-ink-900">{value}</p>
    </div>
  );
}
