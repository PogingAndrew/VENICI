// Wraps the browser Geolocation API for the live cardio tracker.
// Location is only ever watched while this is explicitly started, and the
// caller (CardioLive) is responsible for calling stop() on pause/end/unmount
// so the app never tracks location in the background.

export interface GeoPoint {
  latitude: number;
  longitude: number;
  elevationM?: number;
  recordedAt: string; // ISO timestamp
}

export class GeoWatcher {
  private watchId: number | null = null;

  start(onPoint: (point: GeoPoint) => void, onError: (message: string) => void) {
    if (!("geolocation" in navigator)) {
      onError("Geolocation is not supported on this device.");
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        onPoint({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          elevationM: pos.coords.altitude ?? undefined,
          recordedAt: new Date(pos.timestamp).toISOString(),
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          onError("Location permission is required to start GPS tracking.");
        } else {
          onError("Unable to get your location. Check your device's GPS settings.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
  }

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  get isActive() {
    return this.watchId !== null;
  }
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function formatPace(secPerKm: number | null): string {
  if (!secPerKm || !Number.isFinite(secPerKm)) return "—";
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")} /km`;
}
