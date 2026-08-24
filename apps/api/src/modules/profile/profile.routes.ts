import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../middleware/asyncHandler";
import { calculateAge, calculateBMI, bmiCategory } from "../../utils/calories";

const router = Router();
router.use(authenticate);

const updateSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    dateOfBirth: z.string().datetime().optional(),
    sex: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    heightCm: z.number().positive().optional(),
    activityLevel: z
      .enum(["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"])
      .optional(),
  }),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const profile = await prisma.profile.findUnique({ where: { userId: req.user!.id } });
    const latestMeasurement = await prisma.bodyMeasurement.findFirst({
      where: { userId: req.user!.id },
      orderBy: { recordedAt: "desc" },
    });
    const currentWeightKg = latestMeasurement?.weightKg ?? null;

    const age = profile?.dateOfBirth ? calculateAge(profile.dateOfBirth) : null;
    const bmi =
      currentWeightKg && profile?.heightCm ? calculateBMI(currentWeightKg, profile.heightCm) : null;

    res.json({
      ...profile,
      currentWeightKg,
      age,
      bmi,
      bmiCategory: bmi != null ? bmiCategory(bmi) : null,
    });
  })
);

router.put(
  "/",
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const { dateOfBirth, ...rest } = req.body;
    const profile = await prisma.profile.update({
      where: { userId: req.user!.id },
      data: { ...rest, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined },
    });
    res.json(profile);
  })
);

// Body measurements are append-only history, not an update to a single row.
router.post(
  "/measurements",
  validate(
    z.object({
      body: z.object({
        weightKg: z.number().positive(),
        bodyFatPct: z.number().min(0).max(100).optional(),
        notes: z.string().optional(),
      }),
    })
  ),
  asyncHandler(async (req, res) => {
    const measurement = await prisma.bodyMeasurement.create({
      data: { userId: req.user!.id, ...req.body },
    });
    res.status(201).json(measurement);
  })
);

router.get(
  "/measurements",
  asyncHandler(async (req, res) => {
    const measurements = await prisma.bodyMeasurement.findMany({
      where: { userId: req.user!.id },
      orderBy: { recordedAt: "desc" },
      take: 90,
    });
    res.json(measurements);
  })
);

export default router;
