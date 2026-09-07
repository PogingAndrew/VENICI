import { prisma } from "../../lib/prisma";
import { WEIGHT_GOAL_TYPES } from "../progress/progress.service";

export type LeaderboardPeriod = "all" | "month" | "week";
export type LeaderboardCategory = "volume" | "distance" | "pace" | "goals";

export interface LeaderboardEntry {
  userId: string;
  name: string;
  value: number;
}

function periodStart(period: LeaderboardPeriod): Date | undefined {
  if (period === "all") return undefined;
  const d = new Date();
  if (period === "week") d.setDate(d.getDate() - 7);
  else d.setMonth(d.getMonth() - 1);
  return d;
}

async function namesByUserId(userIds: string[]): Promise<Map<string, string>> {
  const profiles = await prisma.profile.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, name: true },
  });
  return new Map(profiles.map((p) => [p.userId, p.name]));
}

// "Heaviest lifted" — total training volume (sets × reps × weight), Hevy-
// style, summed across every WorkoutExercise in the period. Bodyweight
// exercises logged with no weight don't contribute (there's no lifted load
// to sum), so they're skipped rather than counted as zero.
export async function getVolumeLeaderboard(period: LeaderboardPeriod): Promise<LeaderboardEntry[]> {
  const since = periodStart(period);

  const workoutExercises = await prisma.workoutExercise.findMany({
    where: since ? { workout: { performedAt: { gte: since } } } : undefined,
    select: {
      sets: true,
      reps: true,
      weightKg: true,
      workout: { select: { userId: true } },
    },
  });

  const totals = new Map<string, number>();
  for (const we of workoutExercises) {
    if (!we.weightKg) continue;
    const userId = we.workout.userId;
    const volume = we.sets * we.reps * we.weightKg;
    totals.set(userId, (totals.get(userId) ?? 0) + volume);
  }

  const names = await namesByUserId([...totals.keys()]);
  return [...totals.entries()]
    .map(([userId, value]) => ({ userId, name: names.get(userId) ?? "Anonymous", value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);
}

// Total cardio distance (km) covered in completed activities during the period.
export async function getDistanceLeaderboard(period: LeaderboardPeriod): Promise<LeaderboardEntry[]> {
  const since = periodStart(period);

  const grouped = await prisma.cardioActivity.groupBy({
    by: ["userId"],
    where: { status: "COMPLETED", startedAt: since ? { gte: since } : undefined },
    _sum: { distanceMeters: true },
  });

  const names = await namesByUserId(grouped.map((g) => g.userId));
  return grouped
    .map((g) => ({
      userId: g.userId,
      name: names.get(g.userId) ?? "Anonymous",
      value: Number(((g._sum.distanceMeters ?? 0) / 1000).toFixed(2)),
    }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value);
}

// Fastest personal-best pace (lower seconds/km = faster), from RUNNING
// activities only — pace isn't a fair comparison across activity types
// (walking/cycling pace means something different), so those are excluded.
export async function getPaceLeaderboard(period: LeaderboardPeriod): Promise<LeaderboardEntry[]> {
  const since = periodStart(period);

  const grouped = await prisma.cardioActivity.groupBy({
    by: ["userId"],
    where: {
      status: "COMPLETED",
      type: "RUNNING",
      avgPaceSecKm: { not: null },
      startedAt: since ? { gte: since } : undefined,
    },
    _min: { avgPaceSecKm: true },
  });

  const names = await namesByUserId(grouped.map((g) => g.userId));
  return grouped
    .map((g) => ({
      userId: g.userId,
      name: names.get(g.userId) ?? "Anonymous",
      value: g._min.avgPaceSecKm ?? 0,
    }))
    .filter((e) => e.value > 0)
    .sort((a, b) => a.value - b.value); // ascending — lower pace is better
}

// Count of weight-related goals (loss/gain/maintenance) marked COMPLETED.
// FITNESS_IMPROVEMENT goals aren't included — this ranking is specifically
// about weight-goal follow-through, consistent with WEIGHT_GOAL_TYPES used
// elsewhere for weight/calorie logic.
export async function getGoalsCompletedLeaderboard(): Promise<LeaderboardEntry[]> {
  const grouped = await prisma.goal.groupBy({
    by: ["userId"],
    where: { status: "COMPLETED", type: { in: [...WEIGHT_GOAL_TYPES] } },
    _count: { id: true },
  });

  const names = await namesByUserId(grouped.map((g) => g.userId));
  return grouped
    .map((g) => ({ userId: g.userId, name: names.get(g.userId) ?? "Anonymous", value: g._count.id }))
    .sort((a, b) => b.value - a.value);
}

export async function getLeaderboard(
  category: LeaderboardCategory,
  period: LeaderboardPeriod
): Promise<LeaderboardEntry[]> {
  switch (category) {
    case "volume":
      return getVolumeLeaderboard(period);
    case "distance":
      return getDistanceLeaderboard(period);
    case "pace":
      return getPaceLeaderboard(period);
    case "goals":
      return getGoalsCompletedLeaderboard();
  }
}
