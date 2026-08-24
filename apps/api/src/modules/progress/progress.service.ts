import { prisma } from "../../lib/prisma";

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
