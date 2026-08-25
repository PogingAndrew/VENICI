import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/asyncHandler";
import {
  computeCalorieTargetAndBMI,
  computeDaySummary,
  computeGoalCalorieAdjustment,
  computeWeekToDate,
  upsertSnapshot,
  WEIGHT_GOAL_TYPES,
} from "./progress.service";

const router = Router();
router.use(authenticate);

// Today's live summary — used by the Dashboard.
router.get(
  "/today",
  asyncHandler(async (req, res) => {
    const summary = await computeDaySummary(req.user!.id, new Date());
    const { calorieTarget, bmi, weightKg } = await computeCalorieTargetAndBMI(req.user!.id);

    // Only WEIGHT_LOSS/WEIGHT_GAIN/WEIGHT_MAINTENANCE goals feed the
    // weight-target and calorie-adjustment math — a FITNESS_IMPROVEMENT
    // goal's targetValue isn't a body weight and must never be used here.
    const activeGoal = await prisma.goal.findFirst({
      where: { userId: req.user!.id, status: "ACTIVE", type: { in: [...WEIGHT_GOAL_TYPES] } },
      orderBy: { createdAt: "desc" },
    });

    const adjustment = computeGoalCalorieAdjustment(weightKg, activeGoal);

    // The number the user should actually aim to eat: maintenance (TDEE)
    // plus a surplus if bulking, minus a deficit if cutting. Falls back to
    // plain maintenance calories if there's no active goal to adjust for.
    const recommendedDailyCalories =
      calorieTarget != null ? calorieTarget + adjustment.dailyKcalAdjustment : null;

    res.json({
      ...summary,
      calorieTarget,
      recommendedDailyCalories,
      bmi,
      activeGoal,
      goalPhase: adjustment.phase,
      dailyKcalAdjustment: adjustment.dailyKcalAdjustment,
    });
  })
);

// Weekly calorie balance: how much of a deficit/surplus the user has run
// so far this week vs. what's needed to hit their active goal on pace,
// using the ~7700 kcal-per-kg rule. Correctly handles BOTH directions —
// a goal to gain weight (bulking) needs a surplus, so running a deficit
// while bulking counts as moving AWAY from the goal, not toward it.
// Recomputed live (not cached) so it updates the moment new food or
// activity is logged.
router.get(
  "/weekly-balance",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { calorieTarget, weightKg } = await computeCalorieTargetAndBMI(userId);
    const { weekStart, daysElapsed, daysRemaining, trackedDaysElapsed, totalConsumed, totalBurned } =
      await computeWeekToDate(userId);

    const activeGoal = await prisma.goal.findFirst({
      where: { userId, status: "ACTIVE", type: { in: [...WEIGHT_GOAL_TYPES] } },
      orderBy: { createdAt: "desc" },
    });

    const adjustment = computeGoalCalorieAdjustment(weightKg, activeGoal);

    // Actual net calorie balance so far this week, in absolute terms:
    // positive = ran a deficit (burned more than consumed, relative to
    // maintenance); negative = ran a surplus. Uses trackedDaysElapsed (days
    // with real logged data), NOT calendar days elapsed — an untracked day
    // contributes nothing, so the balance starts at 0 until you actually
    // log something, rather than assuming zero calories eaten.
    const maintenanceSoFar = calorieTarget != null ? calorieTarget * trackedDaysElapsed : 0;
    const netKcalSoFar = Math.round(maintenanceSoFar + totalBurned - totalConsumed);
    const usedTdee = calorieTarget != null;

    // Converts the raw net into "progress toward the goal": positive means
    // moving in the direction the goal actually needs (a deficit while
    // cutting, or a surplus while bulking); negative means moving the
    // wrong way (e.g. a deficit while bulking, as in the 0-calories-logged
    // case that originally motivated this fix).
    const goalSign = adjustment.direction === "deficit" ? 1 : adjustment.direction === "surplus" ? -1 : 0;
    const achievedTowardGoalKcal = netKcalSoFar * goalSign;
    const remainingKcalNeeded =
      adjustment.weeklyTargetKcal > 0
        ? Math.round(adjustment.weeklyTargetKcal - achievedTowardGoalKcal)
        : 0;
    const onTrack = adjustment.weeklyTargetKcal === 0 || achievedTowardGoalKcal >= 0;
    const goalMet = adjustment.weeklyTargetKcal > 0 && remainingKcalNeeded <= 0;

    const avgDailyKcalNeeded =
      daysRemaining > 0 && adjustment.weeklyTargetKcal > 0
        ? Math.round(remainingKcalNeeded / daysRemaining)
        : null;

    res.json({
      weekStart,
      daysElapsed,
      daysRemaining,
      trackedDaysElapsed,
      totalConsumed: Math.round(totalConsumed),
      totalBurned: Math.round(totalBurned),
      netKcalSoFar,
      usedTdee,
      phase: adjustment.phase,
      direction: adjustment.direction,
      weeklyTargetKcal: adjustment.weeklyTargetKcal,
      targetWeeklyKgChange: adjustment.targetWeeklyKgChange,
      achievedTowardGoalKcal: Math.round(achievedTowardGoalKcal),
      remainingKcalNeeded,
      avgDailyKcalNeeded,
      onTrack,
      goalMet,
      hasActiveGoal: Boolean(activeGoal),
      hasWeight: weightKg != null,
    });
  })
);

// N-day trend, persisting a snapshot for "today" on the way so history
// accumulates for charts even without a background job configured.
router.get(
  "/history",
  asyncHandler(async (req, res) => {
    const days = Math.min(Number(req.query.days ?? 30), 180);

    await upsertSnapshot(req.user!.id, new Date());

    const since = new Date();
    since.setDate(since.getDate() - days);

    const snapshots = await prisma.progressSnapshot.findMany({
      where: { userId: req.user!.id, date: { gte: since } },
      orderBy: { date: "asc" },
    });
    res.json(snapshots);
  })
);

export default router;
