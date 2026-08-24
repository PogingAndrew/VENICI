// Wearable integration is designed behind a provider interface so a real
// OAuth-based provider (Fitbit, Garmin, Apple Health) can be dropped in
// later without touching the routes, DB schema, or frontend.

export interface DailyActivitySample {
  date: Date;
  steps: number;
  caloriesBurned: number;
  avgHeartRate: number;
  activeMinutes: number;
}

export interface WearableProvider {
  name: string;
  fetchDailyActivity(userId: string, date: Date): Promise<DailyActivitySample>;
}

// Deterministic-ish mock so repeated syncs for the same day return
// plausible, stable-looking numbers instead of pure random noise.
export class MockWearableProvider implements WearableProvider {
  name = "mock";

  async fetchDailyActivity(_userId: string, date: Date): Promise<DailyActivitySample> {
    const seed = date.getDate();
    const steps = 4000 + ((seed * 137) % 6000);
    return {
      date,
      steps,
      caloriesBurned: Math.round(steps * 0.045),
      avgHeartRate: 68 + (seed % 15),
      activeMinutes: 20 + (seed % 40),
    };
  }
}

export const wearableProvider: WearableProvider = new MockWearableProvider();
