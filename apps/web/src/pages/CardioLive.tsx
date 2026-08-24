import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/apiClient";
import { GeoPoint, GeoWatcher, formatDuration, formatPace } from "../lib/geolocation";
import { RouteMap } from "../components/maps/RouteMap";
import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/EmptyState";

// How often buffered GPS points get flushed to the server (ms).
const SYNC_INTERVAL_MS = 5000;

export default function CardioLive() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { activityId?: string; type?: string } | null;

  const [status, setStatus] = useState<"ACTIVE" | "PAUSED" | "ENDED">("ACTIVE");
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [permissionNeeded, setPermissionNeeded] = useState(false);

  const watcherRef = useRef(new GeoWatcher());
  const pendingPointsRef = useRef<GeoPoint[]>([]);
  const startedAtRef = useRef(Date.now());
  const pausedAccumRef = useRef(0); // seconds accumulated while active, across pauses
  const lastResumeRef = useRef(Date.now());

  const activityId = state?.activityId;
  const activityType = state?.type ?? "RUNNING";

  // Guard: this screen requires an active activity started from /cardio.
  useEffect(() => {
    if (!activityId) {
      navigate("/cardio", { replace: true });
    }
  }, [activityId, navigate]);

  // Start watching location the moment this screen mounts; stop on unmount
  // no matter how the user leaves, so we never track in the background.
  useEffect(() => {
    if (!activityId) return;

    watcherRef.current.start(
      (point) => {
        setPermissionNeeded(false);
        pendingPointsRef.current.push(point);
        setPoints((prev) => [...prev, point]);
      },
      (message) => {
        setError(message);
        setPermissionNeeded(true);
      }
    );

    return () => watcherRef.current.stop();
  }, [activityId]);

  // Elapsed-time ticker.
  useEffect(() => {
    const interval = setInterval(() => {
      if (status === "ACTIVE") {
        const secondsSinceResume = (Date.now() - lastResumeRef.current) / 1000;
        setElapsedSec(pausedAccumRef.current + secondsSinceResume);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  // Periodic sync of buffered GPS points to the server.
  useEffect(() => {
    if (!activityId) return;
    const interval = setInterval(async () => {
      if (pendingPointsRef.current.length === 0 || status !== "ACTIVE") return;
      const batch = pendingPointsRef.current;
      pendingPointsRef.current = [];
      try {
        const res = await api.post<{ distanceMeters: number }>(`/cardio/${activityId}/route`, {
          points: batch,
        });
        setDistanceMeters(res.distanceMeters);
      } catch {
        // Re-queue on failure so points aren't silently lost.
        pendingPointsRef.current = [...batch, ...pendingPointsRef.current];
      }
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activityId, status]);

  async function handlePause() {
    if (!activityId) return;
    pausedAccumRef.current += (Date.now() - lastResumeRef.current) / 1000;
    await api.post(`/cardio/${activityId}/pause`);
    setStatus("PAUSED");
  }

  async function handleResume() {
    if (!activityId) return;
    lastResumeRef.current = Date.now();
    await api.post(`/cardio/${activityId}/resume`);
    setStatus("ACTIVE");
  }

  async function handleEnd() {
    if (!activityId) return;
    watcherRef.current.stop();
    // Flush any remaining buffered points before ending.
    if (pendingPointsRef.current.length > 0) {
      await api
        .post(`/cardio/${activityId}/route`, { points: pendingPointsRef.current })
        .catch(() => undefined);
      pendingPointsRef.current = [];
    }
    const finalDuration = Math.round(
      status === "ACTIVE"
        ? pausedAccumRef.current + (Date.now() - lastResumeRef.current) / 1000
        : pausedAccumRef.current
    );
    await api.post(`/cardio/${activityId}/end`, { durationSec: finalDuration });
    setStatus("ENDED");
    navigate("/cardio");
  }

  const distanceKm = distanceMeters / 1000;
  const currentPaceSecKm = distanceKm > 0 ? elapsedSec / distanceKm : null;
  const currentSpeedKmh = elapsedSec > 0 ? distanceKm / (elapsedSec / 3600) : 0;

  return (
    <div className="flex h-screen flex-col bg-ink-900">
      {/* Map fills most of the screen */}
      <div className="relative flex-1">
        <RouteMap points={points.map((p) => ({ lat: p.latitude, lng: p.longitude }))} />
        <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink-900 shadow">
          {status === "ACTIVE" ? "🔴 Recording" : status === "PAUSED" ? "⏸ Paused" : "Ended"} ·{" "}
          {activityType}
        </div>
        {permissionNeeded && (
          <div className="absolute inset-x-4 top-16">
            <ErrorState message={error ?? "Location permission is required to start GPS tracking."} />
          </div>
        )}
      </div>

      {/* Stats + controls — large, thumb-friendly, minimal distractions */}
      <div className="rounded-t-3xl bg-white p-5 shadow-2xl">
        <div className="mb-4 grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
          <Stat label="TIME" value={formatDuration(elapsedSec)} big />
          <Stat label="DISTANCE" value={`${distanceKm.toFixed(2)} km`} big />
          <Stat label="CURRENT PACE" value={formatPace(currentPaceSecKm)} />
          <Stat label="AVG PACE" value={formatPace(currentPaceSecKm)} />
          <Stat label="CURRENT SPEED" value={`${currentSpeedKmh.toFixed(1)} km/h`} />
          <Stat label="AVG SPEED" value={`${currentSpeedKmh.toFixed(1)} km/h`} />
        </div>

        <div className="flex gap-3">
          {status === "ACTIVE" ? (
            <Button onClick={handlePause} variant="secondary" className="flex-1 py-4 text-base">
              ⏸ PAUSE
            </Button>
          ) : (
            <Button onClick={handleResume} variant="secondary" className="flex-1 py-4 text-base">
              ▶ RESUME
            </Button>
          )}
          <Button onClick={handleEnd} variant="danger" className="flex-1 py-4 text-base">
            ⏹ END ACTIVITY
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className={big ? "text-xl font-bold text-ink-900" : "text-sm font-semibold text-ink-900"}>
        {value}
      </p>
    </div>
  );
}
