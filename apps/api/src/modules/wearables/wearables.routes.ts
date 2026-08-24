import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../middleware/asyncHandler";
import { ApiError } from "../../middleware/errorHandler";
import { wearableProvider } from "./wearable.provider";

const router = Router();
router.use(authenticate);

router.get(
  "/devices",
  asyncHandler(async (req, res) => {
    const devices = await prisma.wearableDevice.findMany({ where: { userId: req.user!.id } });
    res.json(devices);
  })
);

router.post(
  "/devices",
  validate(z.object({ body: z.object({ deviceName: z.string().min(1) }) })),
  asyncHandler(async (req, res) => {
    const device = await prisma.wearableDevice.create({
      data: {
        userId: req.user!.id,
        provider: wearableProvider.name,
        deviceName: req.body.deviceName,
      },
    });
    res.status(201).json(device);
  })
);

router.delete(
  "/devices/:id",
  asyncHandler(async (req, res) => {
    const device = await prisma.wearableDevice.findUnique({ where: { id: req.params.id } });
    if (!device || device.userId !== req.user!.id) throw new ApiError(404, "Device not found");
    await prisma.wearableDevice.update({ where: { id: device.id }, data: { isActive: false } });
    res.status(204).send();
  })
);

// Pulls one day of activity from the (mock) provider and stores it as a
// WEARABLE-sourced record, clearly separated from MANUAL/GPS data.
router.post(
  "/sync",
  asyncHandler(async (req, res) => {
    const device = await prisma.wearableDevice.findFirst({
      where: { userId: req.user!.id, isActive: true },
    });
    if (!device) throw new ApiError(400, "No connected wearable device");

    const date = req.body?.date ? new Date(req.body.date) : new Date();
    date.setHours(0, 0, 0, 0);

    const sample = await wearableProvider.fetchDailyActivity(req.user!.id, date);

    const record = await prisma.wearableActivityRecord.upsert({
      where: { id: `${device.id}-${date.toISOString().slice(0, 10)}` },
      create: {
        id: `${device.id}-${date.toISOString().slice(0, 10)}`,
        userId: req.user!.id,
        deviceId: device.id,
        date,
        steps: sample.steps,
        caloriesBurned: sample.caloriesBurned,
        avgHeartRate: sample.avgHeartRate,
        activeMinutes: sample.activeMinutes,
      },
      update: {
        steps: sample.steps,
        caloriesBurned: sample.caloriesBurned,
        avgHeartRate: sample.avgHeartRate,
        activeMinutes: sample.activeMinutes,
      },
    });
    res.json(record);
  })
);

router.get(
  "/activity",
  asyncHandler(async (req, res) => {
    const records = await prisma.wearableActivityRecord.findMany({
      where: { userId: req.user!.id },
      orderBy: { date: "desc" },
      take: 30,
    });
    res.json(records);
  })
);

export default router;
