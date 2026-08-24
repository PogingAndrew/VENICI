import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../middleware/asyncHandler";
import { ApiError } from "../../middleware/errorHandler";

const router = Router();
router.use(authenticate, requireRole("ADMIN"));

// System-wide stats for the admin dashboard (section 26 of the spec).
router.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const since30d = new Date();
    since30d.setDate(since30d.getDate() - 30);

    const [totalUsers, activeUsers, foods, exercises, workouts, cardioActivities] = await Promise.all(
      [
        prisma.user.count(),
        prisma.user.count({
          where: {
            OR: [
              { workouts: { some: { performedAt: { gte: since30d } } } },
              { cardioActivities: { some: { startedAt: { gte: since30d } } } },
              { meals: { some: { loggedAt: { gte: since30d } } } },
            ],
          },
        }),
        prisma.food.count(),
        prisma.exercise.count(),
        prisma.workout.count(),
        prisma.cardioActivity.count(),
      ]
    );

    res.json({ totalUsers, activeUsers, foods, exercises, workouts, cardioActivities });
  })
);

router.patch(
  "/users/:id/role",
  validate(z.object({ body: z.object({ role: z.enum(["USER", "ADMIN"]) }) })),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: req.body.role },
      select: { id: true, email: true, role: true },
    });
    res.json(user);
  })
);

router.delete(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new ApiError(404, "User not found");
    await prisma.user.delete({ where: { id: user.id } });
    res.status(204).send();
  })
);

export default router;
