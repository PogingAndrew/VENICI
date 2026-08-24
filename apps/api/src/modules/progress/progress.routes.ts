import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/asyncHandler";
import { computeDaySummary, upsertSnapshot } from "./progress.service";
import { calculateAge, calculateBMI, calculateBMR, calculateTDEE } from "../../utils/calories";

const router = Router();
router.use(authenticate);

// Today's live summary — used by the Dashboard.
router.get(
  "/today",
  asyncHandler(async (req, res) => {
    const summary = await computeDaySummary(req.user!.id, new Date());

    const profile = await prisma.profile.findUnique({ where: { userId: req.user!.id } });
    let calorieTarget: number | null = null;
    let bmi: number | null = null;

    if (profile?.dateOfBirth && profile.heightCm && summary.weightKg) {
      const age = calculateAge(profile.dateOfBirth);
      const bmr = calculateBMR({
        sex: profile.sex,
        weightKg: summary.weightKg,
        heightCm: profile.heightCm,
        age,
      });
      calorieTarget = calculateTDEE(bmr, profile.activityLevel);
      bmi = calculateBMI(summary.weightKg, profile.heightCm);
    }

    const activeGoal = await prisma.goal.findFirst({
      where: { userId: req.user!.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    res.json({ ...summary, calorieTarget, bmi, activeGoal });
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
