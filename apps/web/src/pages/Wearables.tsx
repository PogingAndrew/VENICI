import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/apiClient";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState, LoadingBlock } from "../components/ui/EmptyState";

interface Device {
  id: string;
  provider: string;
  deviceName: string;
  connectedAt: string;
  isActive: boolean;
}

interface ActivityRecord {
  id: string;
  date: string;
  steps: number | null;
  caloriesBurned: number | null;
  avgHeartRate: number | null;
  activeMinutes: number | null;
}

export default function Wearables() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [records, setRecords] = useState<ActivityRecord[] | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [syncing, setSyncing] = useState(false);

  function load() {
    api.get<Device[]>("/wearables/devices").then((d) => setDevices(d.filter((x) => x.isActive)));
    api.get<ActivityRecord[]>("/wearables/activity").then(setRecords);
  }
  useEffect(load, []);

  async function connect(e: FormEvent) {
    e.preventDefault();
    if (!deviceName.trim()) return;
    await api.post("/wearables/devices", { deviceName });
    setDeviceName("");
    load();
  }

  async function disconnect(device: Device) {
    await api.delete(`/wearables/devices/${device.id}`);
    load();
  }

  async function sync() {
    setSyncing(true);
    try {
      await api.post("/wearables/sync");
      load();
    } finally {
      setSyncing(false);
    }
  }

  if (!devices || !records) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Wearables</h1>
        <p className="text-sm text-ink-500">
          Connect a device to bring in steps, heart rate, and daily activity automatically. This uses a
          mock data provider in development — clearly separate from manually entered or GPS data.
        </p>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold text-ink-900">Connected devices</h2>
        {devices.length === 0 ? (
          <form onSubmit={connect} className="flex gap-2">
            <input
              placeholder="Device name, e.g. FitBand X1"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
            />
            <Button type="submit">Connect</Button>
          </form>
        ) : (
          <div className="space-y-2">
            {devices.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">{d.deviceName}</p>
                  <p className="text-xs text-ink-500">
                    Provider: {d.provider} · Connected {new Date(d.connectedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={sync} disabled={syncing}>
                    {syncing ? "Syncing…" : "Sync now"}
                  </Button>
                  <Button variant="danger" onClick={() => disconnect(d)}>
                    Disconnect
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-ink-900">Wearable activity history</h2>
        {records.length === 0 ? (
          <EmptyState title="No wearable data yet." hint="Connect a device and sync to pull in daily activity." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-500">
                <th className="pb-2">Date</th>
                <th className="pb-2">Steps</th>
                <th className="pb-2">Calories</th>
                <th className="pb-2">Avg HR</th>
                <th className="pb-2">Active min.</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="py-2">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="py-2">{r.steps ?? "—"}</td>
                  <td className="py-2">{r.caloriesBurned ?? "—"} kcal</td>
                  <td className="py-2">{r.avgHeartRate ?? "—"} bpm</td>
                  <td className="py-2">{r.activeMinutes ?? "—"} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
