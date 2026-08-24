import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../middleware/asyncHandler";

const router = Router();
router.use(authenticate);

const CATEGORIES = [
  "CHEST",
  "BACK",
  "LEGS",
  "SHOULDERS",
  "ARMS",
  "CORE",
  "FULL_BODY",
  "CARDIO",
] as const;

const exerciseSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    category: z.enum(CATEGORIES),
    description: z.string().optional(),
  }),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const category = req.query.category as string | undefined;
    const exercises = await prisma.exercise.findMany({
      where: category ? { category: category as (typeof CATEGORIES)[number] } : undefined,
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    res.json(exercises);
  })
);

router.post(
  "/",
  requireRole("ADMIN"),
  validate(exerciseSchema),
  asyncHandler(async (req, res) => {
    const exercise = await prisma.exercise.create({ data: req.body });
    res.status(201).json(exercise);
  })
);

router.put(
  "/:id",
  requireRole("ADMIN"),
  validate(exerciseSchema),
  asyncHandler(async (req, res) => {
    const exercise = await prisma.exercise.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(exercise);
  })
);

router.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    await prisma.exercise.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
