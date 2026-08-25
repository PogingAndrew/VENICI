import { prisma } from "../../lib/prisma";
import {
  calculateAge,
  calculateBMI,
  calculateBMR,
  calculateTDEE,
  DEFAULT_WEEKLY_KG_RATE,
  KCAL_PER_KG,
} from "../../utils/calories";

interface ActiveGoalLike {
  type: string;
  targetValue: number;
  targetDate: Date | null;
  status: string;
}

// Goal types that actually represent a body-weight target. A goal like
// FITNESS_IMPROVEMENT can have any arbitrary numeric target (reps, a score,
// whatever the user typed) — treating its targetValue as a target weight
// would silently corrupt the BMI/TDEE/bulking-cutting math, which is
// exactly what happened when a non-weight goal became the "latest active"
// one. Anything weight/calorie-related must filter to these three types.
export const WEIGHT_GOAL_TYPES = ["WEIGHT_LOSS", "WEIGHT_GAIN", "WEIGHT_MAINTENANCE"] as const;

export interface GoalCalorieAdjustment {
  phase: "bulking" | "cutting" | "maintaining";
  direction: "deficit" | "surplus" | "maintenance";
  // Magnitude (always >= 0) of the weekly calorie deficit/surplus needed.
  weeklyTargetKcal: number;
  // Magnitude (always >= 0) of the weekly kg change needed.
  targetWeeklyKgChange: number;
  // Signed: positive = add this many calories/day (bulking), negative =
  // subtract this many (cutting), 0 = maintaining.
  dailyKcalAdjustment: number;
}

// The single source of truth for "is this person bulking or cutting, and by
// how much" — derived from where their goal weight sits relative to their
// current weight. Shared by /today (daily calorie recommendation) and
// /weekly-balance (weekly deficit/surplus tracking) so the two can never
// disagree with each other.
export function computeGoalCalorieAdjustment(
  weightKg: number | null,
  activeGoal: ActiveGoalLike | null
): GoalCalorieAdjustment {
  const maintaining: GoalCalorieAdjustment = {
    phase: "maintaining",
    direction: "maintenance",
    weeklyTargetKcal: 0,
    targetWeeklyKgChange: 0,
    dailyKcalAdjustment: 0,
  };

  if (!activeGoal || activeGoal.status !== "ACTIVE" || weightKg == null) return maintaining;

  // Positive = goal weight is ABOVE current weight (bulking / gaining).
  // Negative = goal weight is BELOW current weight (cutting / losing).
  const weightDiff = activeGoal.targetValue - weightKg;

  if (activeGoal.type === "WEIGHT_MAINTENANCE" || Math.abs(weightDiff) < 0.1) return maintaining;

  const phase: "bulking" | "cutting" = weightDiff > 0 ? "bulking" : "cutting";
  const direction: "deficit" | "surplus" = phase === "cutting" ? "deficit" : "surplus";

  let weeklyKgChange: number; // signed, same sign as weightDiff
  if (activeGoal.targetDate) {
    const weeksRemaining = Math.max(
      1,
      (activeGoal.targetDate.getTime() - Date.now()) / (7 * 86400000)
    );
    weeklyKgChange = weightDiff / weeksRemaining;
  } else {
    // No target date — use a safe default pace, capped so we never
    // recommend a faster rate than standard guidance even for a large gap.
    const sign = weightDiff > 0 ? 1 : -1;
    weeklyKgChange = sign * Math.min(Math.abs(weightDiff), DEFAULT_WEEKLY_KG_RATE);
  }

  const weeklyCalorieChange = weeklyKgChange * KCAL_PER_KG; // signed: + = surplus needed, - = deficit needed
  const dailyKcalAdjustment = Math.round(weeklyCalorieChange / 7);

  return {
    phase,
    direction,
    weeklyTargetKcal: Math.round(Math.abs(weeklyCalorieChange)),
    targetWeeklyKgChange: Number(Math.abs(weeklyKgChange).toFixed(2)),
    dailyKcalAdjustment,
  };
}

// Shared by /today and /weekly-balance so both use the same maintenance-
// calorie (TDEE) and BMI figures rather than recomputing slightly differently.
export async function computeCalorieTargetAndBMI(userId: string) {
  const [profile, latestMeasurement] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.bodyMeasurement.findFirst({ where: { userId }, orderBy: { recordedAt: "desc" } }),
  ]);

  const weightKg = latestMeasurement?.weightKg ?? null;
  let calorieTarget: number | null = null;
  let bmi: number | null = null;

  if (profile?.dateOfBirth && profile.heightCm && weightKg) {
    const age = calculateAge(profile.dateOfBirth);
    const bmr = calculateBMR({ sex: profile.sex, weightKg, heightCm: profile.heightCm, age });
    calorieTarget = calculateTDEE(bmr, profile.activityLevel);
    bmi = calculateBMI(weightKg, profile.heightCm);
  }

  return { profile, weightKg, calorieTarget, bmi };
}

// Aggregates all raw sources (meals, workouts, cardio, wearables, body
// measurements) for one user/day into a single snapshot shape. Used live by
// the dashboard/progress pages and persisted nightly via upsertSnapshot.
export async function computeDaySummary(userId: string, date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const [meals, workouts, cardio, wearable, measurement] = await Promise.all([
    prisma.meal.findMany({
      where: { userId, loggedAt: { gte: start, lte: end } },
      include: { items: { include: { food: true } } },
    }),
    prisma.workout.findMany({ where: { userId, performedAt: { gte: start, lte: end } } }),
    prisma.cardioActivity.findMany({
      where: { userId, status: "COMPLETED", startedAt: { gte: start, lte: end } },
    }),
    prisma.wearableActivityRecord.findFirst({ where: { userId, date: { gte: start, lte: end } } }),
    prisma.bodyMeasurement.findFirst({
      where: { userId, recordedAt: { lte: end } },
      orderBy: { recordedAt: "desc" },
    }),
  ]);

  const nutrition = meals.reduce(
    (acc, meal) => {
      for (const item of meal.items) {
        acc.caloriesConsumed += item.food.calories * item.quantity;
        acc.proteinG += item.food.proteinG * item.quantity;
        acc.carbsG += item.food.carbsG * item.quantity;
        acc.fatG += item.food.fatG * item.quantity;
        acc.fiberG += item.food.fiberG * item.quantity;
      }
      return acc;
    },
    { caloriesConsumed: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }
  );

  const workoutCalories = workouts.reduce((sum, w) => sum + (w.caloriesBurned ?? 0), 0);
  const workoutMinutes = workouts.reduce((sum, w) => sum + (w.durationMin ?? 0), 0);
  const cardioCalories = cardio.reduce((sum, c) => sum + c.caloriesBurned, 0);
  const cardioDistanceM = cardio.reduce((sum, c) => sum + c.distanceMeters, 0);
  const wearableCalories = wearable?.caloriesBurned ?? 0;

  return {
    date: start,
    weightKg: measurement?.weightKg ?? null,
    ...nutrition,
    caloriesBurned: workoutCalories + cardioCalories + wearableCalories,
    cardioDistanceM,
    workoutMinutes,
    steps: wearable?.steps ?? 0,
    cardioSessions: cardio.length,
    workoutSessions: workouts.length,
    // Whether the user actually logged *anything* this day (a meal, a
    // workout, a cardio session, or a wearable sync). A day with no logged
    // data isn't "zero calories eaten" — it's untracked, and must not be
    // treated as maintenance-calories-worth of deficit.
    hasLoggedData: meals.length > 0 || workouts.length > 0 || cardio.length > 0 || wearable != null,
  };
}

// Returns the Monday of the calendar week containing `date`, at midnight.
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

// Sums caloriesConsumed/caloriesBurned across every day from the start of
// the current calendar week through today (inclusive). Used to power the
// weekly calorie balance widget — recomputed live rather than cached, so it
// updates immediately as the user logs food or activity.
//
// Only days with actual logged data (a meal, workout, cardio session, or
// wearable sync) contribute to the totals. Without this, a day where the
// user simply hasn't opened the app yet would be silently treated as "ate
// zero calories" and counted as a full day of maintenance-calorie deficit —
// which is a phantom number, not something the user actually did.
export async function computeWeekToDate(userId: string, referenceDate: Date = new Date()) {
  const weekStart = startOfWeek(referenceDate);
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const daysElapsed = Math.floor((today.getTime() - weekStart.getTime()) / 86400000) + 1;

  const days = await Promise.all(
    Array.from({ length: daysElapsed }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return computeDaySummary(userId, d);
    })
  );

  const loggedDays = days.filter((d) => d.hasLoggedData);

  const totalConsumed = loggedDays.reduce((sum, d) => sum + d.caloriesConsumed, 0);
  const totalBurned = loggedDays.reduce((sum, d) => sum + d.caloriesBurned, 0);

  return {
    weekStart,
    daysElapsed,
    daysRemaining: 7 - daysElapsed,
    trackedDaysElapsed: loggedDays.length,
    totalConsumed,
    totalBurned,
  };
}

export async function upsertSnapshot(userId: string, date: Date) {
  const summary = await computeDaySummary(userId, date);
  return prisma.progressSnapshot.upsert({
    where: { userId_date: { userId, date: summary.date } },
    create: {
      userId,
      date: summary.date,
      weightKg: summary.weightKg ?? undefined,
      caloriesConsumed: summary.caloriesConsumed,
      proteinG: summary.proteinG,
      carbsG: summary.carbsG,
      fatG: summary.fatG,
      fiberG: summary.fiberG,
      caloriesBurned: summary.caloriesBurned,
      cardioDistanceM: summary.cardioDistanceM,
      workoutMinutes: summary.workoutMinutes,
    },
    update: {
      weightKg: summary.weightKg ?? undefined,
      caloriesConsumed: summary.caloriesConsumed,
      proteinG: summary.proteinG,
      carbsG: summary.carbsG,
      fatG: summary.fatG,
      fiberG: summary.fiberG,
      caloriesBurned: summary.caloriesBurned,
      cardioDistanceM: summary.cardioDistanceM,
      workoutMinutes: summary.workoutMinutes,
    },
  });
}
