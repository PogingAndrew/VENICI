import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../middleware/asyncHandler";
import { ApiError } from "../../middleware/errorHandler";
import { estimateCardioCalories, haversineDistanceMeters } from "../../utils/calories";

const router = Router();
router.use(authenticate);

const CARDIO_TYPES = ["RUNNING", "JOGGING", "WALKING", "CYCLING", "OTHER"] as const;

// ---- history / detail -------------------------------------------------

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { type, from, to } = req.query as Record<string, string | undefined>;
    const activities = await prisma.cardioActivity.findMany({
      where: {
        userId: req.user!.id,
        status: "COMPLETED",
        type: type ? (type as (typeof CARDIO_TYPES)[number]) : undefined,
        startedAt: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      orderBy: { startedAt: "desc" },
    });
    res.json(activities);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const activity = await prisma.cardioActivity.findUnique({
      where: { id: req.params.id },
      include: { routePoints: { orderBy: { recordedAt: "asc" } } },
    });
    if (!activity || activity.userId !== req.user!.id) {
      throw new ApiError(404, "Activity not found");
    }
    res.json(activity);
  })
);

// ---- start / live tracking ---------------------------------------------

router.post(
  "/start",
  validate(z.object({ body: z.object({ type: z.enum(CARDIO_TYPES) }) })),
  asyncHandler(async (req, res) => {
    // Guard against starting a second activity while one is already active.
    const existing = await prisma.cardioActivity.findFirst({
      where: { userId: req.user!.id, status: { in: ["ACTIVE", "PAUSED"] } },
    });
    if (existing) throw new ApiError(409, "An activity is already in progress");

    const activity = await prisma.cardioActivity.create({
      data: { userId: req.user!.id, type: req.body.type, status: "ACTIVE" },
    });
    res.status(201).json(activity);
  })
);

// Client batches GPS points (e.g. every few seconds) and posts them here.
// Distance/pace/speed are recomputed server-side from the accumulated points
// so the stored totals can't be spoofed by the client.
const pointsSchema = z.object({
  body: z.object({
    points: z
      .array(
        z.object({
          latitude: z.number(),
          longitude: z.number(),
          elevationM: z.number().optional(),
          recordedAt: z.string().datetime(),
        })
      )
      .min(1),
  }),
});

router.post(
  "/:id/route",
  validate(pointsSchema),
  asyncHandler(async (req, res) => {
    const found = await prisma.cardioActivity.findUnique({ where: { id: req.params.id } });
    if (!found || found.userId !== req.user!.id) throw new ApiError(404, "Activity not found");
    if (found.status === "COMPLETED") throw new ApiError(409, "Activity already ended");

    const lastPoint = await prisma.routePoint.findFirst({
      where: { activityId: found.id },
      orderBy: { recordedAt: "desc" },
    });

    await prisma.routePoint.createMany({
      data: req.body.points.map((p: any) => ({ activityId: found.id, ...p, recordedAt: new Date(p.recordedAt) })),
    });

    let addedDistance = 0;
    let prev = lastPoint;
    for (const p of req.body.points) {
      if (prev) {
        addedDistance += haversineDistanceMeters(prev, p);
      }
      prev = { ...p, recordedAt: new Date(p.recordedAt) } as any;
    }

    const updated = await prisma.cardioActivity.update({
      where: { id: found.id },
      data: { distanceMeters: { increment: addedDistance } },
    });

    res.json({
      distanceMeters: updated.distanceMeters,
      addedDistanceMeters: addedDistance,
    });
  })
);

router.post(
  "/:id/pause",
  asyncHandler(async (req, res) => {
    const activity = await prisma.cardioActivity.findUnique({ where: { id: req.params.id } });
    if (!activity || activity.userId !== req.user!.id) throw new ApiError(404, "Activity not found");
    const updated = await prisma.cardioActivity.update({
      where: { id: activity.id },
      data: { status: "PAUSED" },
    });
    res.json(updated);
  })
);

router.post(
  "/:id/resume",
  asyncHandler(async (req, res) => {
    const activity = await prisma.cardioActivity.findUnique({ where: { id: req.params.id } });
    if (!activity || activity.userId !== req.user!.id) throw new ApiError(404, "Activity not found");
    const updated = await prisma.cardioActivity.update({
      where: { id: activity.id },
      data: { status: "ACTIVE" },
    });
    res.json(updated);
  })
);

const endSchema = z.object({
  body: z.object({ durationSec: z.number().int().nonnegative() }),
});

router.post(
  "/:id/end",
  validate(endSchema),
  asyncHandler(async (req, res) => {
    const activity = await prisma.cardioActivity.findUnique({ where: { id: req.params.id } });
    if (!activity || activity.userId !== req.user!.id) throw new ApiError(404, "Activity not found");
    if (activity.status === "COMPLETED") throw new ApiError(409, "Activity already ended");

    const measurement = await prisma.bodyMeasurement.findFirst({
      where: { userId: req.user!.id },
      orderBy: { recordedAt: "desc" },
    });
    const weightKg = measurement?.weightKg ?? 70;

    const durationSec = req.body.durationSec;
    const distanceKm = activity.distanceMeters / 1000;
    const avgPaceSecKm = distanceKm > 0 ? durationSec / distanceKm : null;
    const avgSpeedKmh = durationSec > 0 ? distanceKm / (durationSec / 3600) : null;
    const caloriesBurned = estimateCardioCalories({
      type: activity.type,
      durationSec,
      weightKg,
    });

    const updated = await prisma.cardioActivity.update({
      where: { id: activity.id },
      data: {
        status: "COMPLETED",
        endedAt: new Date(),
        durationSec,
        avgPaceSecKm,
        avgSpeedKmh,
        caloriesBurned,
      },
    });
    res.json(updated);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const activity = await prisma.cardioActivity.findUnique({ where: { id: req.params.id } });
    if (!activity || activity.userId !== req.user!.id) throw new ApiError(404, "Activity not found");
    await prisma.cardioActivity.delete({ where: { id: activity.id } });
    res.status(204).send();
  })
);

export default router;
