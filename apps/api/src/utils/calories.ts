// Shared calorie/energy calculations used by profile, cardio, and progress modules.

// Widely-used approximation: ~7700 kcal of sustained deficit/surplus
// corresponds to roughly 1 kg of body weight change. Used to translate a
// weight goal into a weekly calorie deficit/surplus target.
export const KCAL_PER_KG = 7700;

// Default, safe weekly rate of change (kg/week) used when a goal has no
// target date to derive a pace from — matches common healthy-weight-loss
// guidance (0.5–1 kg/week).
export const DEFAULT_WEEKLY_KG_RATE = 0.5;

export type Sex = "MALE" | "FEMALE" | "OTHER";
export type ActivityLevel = "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE" | "VERY_ACTIVE";

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

export function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > dateOfBirth.getMonth() ||
    (today.getMonth() === dateOfBirth.getMonth() && today.getDate() >= dateOfBirth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}

export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal weight";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

// Mifflin-St Jeor equation.
export function calculateBMR(opts: {
  sex: Sex | null | undefined;
  weightKg: number;
  heightCm: number;
  age: number;
}): number {
  const { sex, weightKg, heightCm, age } = opts;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === "FEMALE") return base - 161;
  return base + 5; // MALE and OTHER default to the male-offset baseline
}

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Resistance-training MET (metabolic equivalent) by effort level, from the
// Compendium of Physical Activities. Chosen by how much weight the person
// moved per minute relative to their own bodyweight — moving a lot of
// weight quickly (short rest, big lifts) is vigorous; low volume per minute
// (long rests, light weight) is light effort.
const RESISTANCE_MET = { light: 3.5, moderate: 5.0, vigorous: 6.0 };

// Estimates calories burned for a strength workout from session duration,
// total volume lifted (sum of sets × reps × weight across all exercises),
// and the person's weight/age/sex/height — improvising on the standard MET
// formula (kcal = MET × weight(kg) × hours) in two ways:
//  1. MET itself is chosen dynamically from lifting intensity (volume per
//     minute per kg of bodyweight) instead of a single fixed number, so a
//     dense, heavy session reads as more vigorous than a light one of the
//     same duration.
//  2. The result is scaled by the ratio of the person's own BMR to a
//     generic "1 MET ≈ 1 kcal/kg/hour" baseline, which is how age, sex,
//     and height feed in — an individual with a higher BMR for their
//     weight (e.g. younger) burns modestly more for the same effort.
export function estimateWorkoutCalories(opts: {
  durationMin: number;
  totalVolumeKg: number;
  weightKg: number;
  age: number;
  sex: Sex | null | undefined;
  heightCm: number;
}): number {
  const { durationMin, totalVolumeKg, weightKg, age, sex, heightCm } = opts;
  if (durationMin <= 0 || weightKg <= 0) return 0;

  const volumePerMinutePerKgBodyweight = totalVolumeKg / durationMin / weightKg;
  let met = RESISTANCE_MET.light;
  if (volumePerMinutePerKgBodyweight > 0.35) met = RESISTANCE_MET.vigorous;
  else if (volumePerMinutePerKgBodyweight > 0.15) met = RESISTANCE_MET.moderate;

  const bmr = calculateBMR({ sex, weightKg, heightCm, age });
  const standardHourlyBurn = weightKg * 1.0; // the "1 kcal/kg/hour" baseline that defines 1 MET
  const individualAdjustment = clamp(bmr / 24 / standardHourlyBurn, 0.85, 1.15);

  const hours = durationMin / 60;
  return Math.round(met * weightKg * hours * individualAdjustment);
}

// Rough MET-based estimate for cardio calories burned, used as a fallback
// when a wearable isn't providing a direct measurement.
const MET_BY_ACTIVITY: Record<string, number> = {
  RUNNING: 9.8,
  JOGGING: 7.0,
  WALKING: 3.8,
  CYCLING: 7.5,
  OTHER: 5.0,
};

export function estimateCardioCalories(opts: {
  type: string;
  durationSec: number;
  weightKg: number;
}): number {
  const met = MET_BY_ACTIVITY[opts.type] ?? MET_BY_ACTIVITY.OTHER;
  const hours = opts.durationSec / 3600;
  return Math.round(met * opts.weightKg * hours);
}

// Haversine distance in meters between two GPS points.
export function haversineDistanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}
