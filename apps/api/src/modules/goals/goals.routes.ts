import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../middleware/asyncHandler";
import { ApiError } from "../../middleware/errorHandler";

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  body: z.object({
    type: z.enum([
      "WEIGHT_LOSS",
      "WEIGHT_GAIN",
      "WEIGHT_MAINTENANCE",
      "FITNESS_IMPROVEMENT",
    ]),
    targetValue: z.number(),
    targetDate: z.string().datetime().optional(),
  }),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const goals = await prisma.goal.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(goals);
  })
);

// No "starting value" input — the user's current logged weight IS the
// starting point, fetched server-side so it can't drift from what's
// actually on their profile.
router.post(
  "/",
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const { type, targetValue, targetDate } = req.body;

    const latestMeasurement = await prisma.bodyMeasurement.findFirst({
      where: { userId: req.user!.id },
      orderBy: { recordedAt: "desc" },
    });
    if (!latestMeasurement) {
      throw new ApiError(
        400,
        "Log a current weight on your profile before creating a goal."
      );
    }

    const startingValue = latestMeasurement.weightKg;
    const goal = await prisma.goal.create({
      data: {
        userId: req.user!.id,
        type,
        startingValue,
        targetValue,
        currentValue: startingValue,
        targetDate: targetDate ? new Date(targetDate) : undefined,
      },
    });
    res.status(201).json(goal);
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const goal = await prisma.goal.findUnique({ where: { id: req.params.id } });
    if (!goal || goal.userId !== req.user!.id) throw new ApiError(404, "Goal not found");

    const updated = await prisma.goal.update({
      where: { id: goal.id },
      data: {
        currentValue: req.body.currentValue ?? goal.currentValue,
        status: req.body.status ?? goal.status,
      },
    });
    res.json(updated);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const goal = await prisma.goal.findUnique({ where: { id: req.params.id } });
    if (!goal || goal.userId !== req.user!.id) throw new ApiError(404, "Goal not found");
    await prisma.goal.delete({ where: { id: goal.id } });
    res.status(204).send();
  })
);

export default router;
