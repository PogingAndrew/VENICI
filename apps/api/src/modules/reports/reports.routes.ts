import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../middleware/asyncHandler";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const reports = await prisma.report.findMany({
      where: { userId: req.user!.id },
      orderBy: { periodStart: "desc" },
      take: 24,
    });
    res.json(reports);
  })
);

const generateSchema = z.object({
  body: z.object({
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
  }),
});

// Builds a weekly/monthly summary from ProgressSnapshot rows in the period
// and stores it, matching section 19 of the spec.
router.post(
  "/generate",
  validate(generateSchema),
  asyncHandler(async (req, res) => {
    const periodStart = new Date(req.body.periodStart);
    const periodEnd = new Date(req.body.periodEnd);

    const snapshots = await prisma.progressSnapshot.findMany({
      where: { userId: req.user!.id, date: { gte: periodStart, lte: periodEnd } },
      orderBy: { date: "asc" },
    });

    const workouts = await prisma.workout.count({
      where: { userId: req.user!.id, performedAt: { gte: periodStart, lte: periodEnd } },
    });
    const cardioActivities = await prisma.cardioActivity.findMany({
      where: {
        userId: req.user!.id,
        status: "COMPLETED",
        startedAt: { gte: periodStart, lte: periodEnd },
      },
    });

    const n = snapshots.length || 1;
    const weights = snapshots.map((s) => s.weightKg).filter((w): w is number => w != null);

    const summary = {
      weightChangeKg:
        weights.length >= 2 ? Number((weights[weights.length - 1] - weights[0]).toFixed(1)) : null,
      avgCaloriesConsumed: Math.round(snapshots.reduce((s, x) => s + x.caloriesConsumed, 0) / n),
      avgProteinG: Math.round(snapshots.reduce((s, x) => s + x.proteinG, 0) / n),
      totalWorkouts: workouts,
      totalCardioSessions: cardioActivities.length,
      totalCardioDistanceKm: Number(
        (cardioActivities.reduce((s, c) => s + c.distanceMeters, 0) / 1000).toFixed(2)
      ),
      totalCaloriesBurned: Math.round(snapshots.reduce((s, x) => s + x.caloriesBurned, 0)),
      avgDailyActivityMinutes: Math.round(snapshots.reduce((s, x) => s + x.workoutMinutes, 0) / n),
    };

    const report = await prisma.report.create({
      data: { userId: req.user!.id, periodStart, periodEnd, summaryJson: summary },
    });
    res.status(201).json(report);
  })
);

export default router;
