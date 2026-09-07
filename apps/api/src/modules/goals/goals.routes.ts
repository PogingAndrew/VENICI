import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../middleware/asyncHandler";
import { ApiError } from "../../middleware/errorHandler";
import { WEIGHT_GOAL_TYPES } from "../progress/progress.service";

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

// Enforces a single active goal at a time — creating a new one while one is
// already active is blocked rather than silently allowed, since multiple
// simultaneous active goals is what caused the dashboard to pick the wrong
// one for weight/calorie math (see progress module).
router.post(
  "/",
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const { type, targetValue, targetDate } = req.body;

    const existingActive = await prisma.goal.findFirst({
      where: { userId: req.user!.id, status: "ACTIVE" },
    });
    if (existingActive) {
      throw new ApiError(
        409,
        "You already have an active goal. Complete, delete, or update it before creating a new one."
      );
    }

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

const updateSchema = z.object({
  body: z.object({
    type: z
      .enum(["WEIGHT_LOSS", "WEIGHT_GAIN", "WEIGHT_MAINTENANCE", "FITNESS_IMPROVEMENT"])
      .optional(),
    targetValue: z.number().optional(),
    targetDate: z.string().datetime().nullable().optional(),
    currentValue: z.number().optional(),
    status: z.enum(["ACTIVE", "COMPLETED", "ABANDONED"]).optional(),
    // When completing a weight goal, optionally log the target weight as a
    // new current-weight measurement in the same request — this is what
    // powers the "set this as my new current weight?" prompt on completion.
    syncCurrentWeight: z.boolean().optional(),
  }),
});

router.patch(
  "/:id",
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const goal = await prisma.goal.findUnique({ where: { id: req.params.id } });
    if (!goal || goal.userId !== req.user!.id) throw new ApiError(404, "Goal not found");

    const { type, targetValue, targetDate, currentValue, status, syncCurrentWeight } = req.body;

    const updated = await prisma.goal.update({
      where: { id: goal.id },
      data: {
        type: type ?? goal.type,
        targetValue: targetValue ?? goal.targetValue,
        targetDate:
          targetDate === undefined ? goal.targetDate : targetDate === null ? null : new Date(targetDate),
        currentValue: currentValue ?? goal.currentValue,
        status: status ?? goal.status,
      },
    });

    if (syncCurrentWeight && status === "COMPLETED" && WEIGHT_GOAL_TYPES.includes(updated.type as any)) {
      await prisma.bodyMeasurement.create({
        data: { userId: req.user!.id, weightKg: updated.targetValue },
      });
    }

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
