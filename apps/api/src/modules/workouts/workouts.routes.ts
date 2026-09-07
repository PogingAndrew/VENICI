import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../middleware/asyncHandler";
import { ApiError } from "../../middleware/errorHandler";
import { calculateAge, estimateWorkoutCalories } from "../../utils/calories";

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    performedAt: z.string().datetime().optional(),
    durationMin: z.number().int().positive().optional(),
    // Optional manual override — if omitted, calories are auto-calculated
    // from duration, total weight lifted, and the user's profile.
    caloriesBurned: z.number().nonnegative().optional(),
    notes: z.string().optional(),
    exercises: z
      .array(
        z.object({
          exerciseId: z.string(),
          sets: z.number().int().positive(),
          reps: z.number().int().positive(),
          weightKg: z.number().nonnegative().optional(),
        })
      )
      .default([]),
  }),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const workouts = await prisma.workout.findMany({
      where: { userId: req.user!.id },
      include: { exercises: { include: { exercise: true } } },
      orderBy: { performedAt: "desc" },
      take: 100,
    });
    res.json(workouts);
  })
);

router.post(
  "/",
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const { name, performedAt, durationMin, caloriesBurned, notes, exercises } = req.body;

    const totalVolumeKg = exercises.reduce(
      (sum: number, e: { sets: number; reps: number; weightKg?: number }) =>
        sum + e.sets * e.reps * (e.weightKg ?? 0),
      0
    );

    // Auto-calculate calories when the user didn't manually provide a
    // value and we have enough profile data to estimate from (duration is
    // required — no session length, no estimate).
    let finalCaloriesBurned = caloriesBurned;
    if (finalCaloriesBurned == null && durationMin) {
      const [profile, measurement] = await Promise.all([
        prisma.profile.findUnique({ where: { userId: req.user!.id } }),
        prisma.bodyMeasurement.findFirst({
          where: { userId: req.user!.id },
          orderBy: { recordedAt: "desc" },
        }),
      ]);

      if (profile?.dateOfBirth && profile.heightCm && measurement?.weightKg) {
        finalCaloriesBurned = estimateWorkoutCalories({
          durationMin,
          totalVolumeKg,
          weightKg: measurement.weightKg,
          age: calculateAge(profile.dateOfBirth),
          sex: profile.sex,
          heightCm: profile.heightCm,
        });
      }
    }

    const workout = await prisma.workout.create({
      data: {
        userId: req.user!.id,
        name,
        performedAt: performedAt ? new Date(performedAt) : undefined,
        durationMin,
        caloriesBurned: finalCaloriesBurned,
        totalVolumeKg,
        notes,
        exercises: { create: exercises },
      },
      include: { exercises: { include: { exercise: true } } },
    });
    res.status(201).json(workout);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const workout = await prisma.workout.findUnique({
      where: { id: req.params.id },
      include: { exercises: { include: { exercise: true } } },
    });
    if (!workout || workout.userId !== req.user!.id) throw new ApiError(404, "Workout not found");
    res.json(workout);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const workout = await prisma.workout.findUnique({ where: { id: req.params.id } });
    if (!workout || workout.userId !== req.user!.id) throw new ApiError(404, "Workout not found");
    await prisma.workout.delete({ where: { id: workout.id } });
    res.status(204).send();
  })
);

export default router;
