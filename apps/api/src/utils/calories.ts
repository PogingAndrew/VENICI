// Shared calorie/energy calculations used by profile, cardio, and progress modules.

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
