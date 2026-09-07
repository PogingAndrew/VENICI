import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../middleware/asyncHandler";
import { ApiError } from "../../middleware/errorHandler";

const router = Router();
router.use(authenticate);

const foodSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    servingSize: z.string().min(1),
    gramsPerServing: z.number().positive().optional(),
    calories: z.number().nonnegative(),
    proteinG: z.number().nonnegative(),
    carbsG: z.number().nonnegative().default(0),
    fatG: z.number().nonnegative(),
    fiberG: z.number().nonnegative(),
  }),
});

// Returns the shared, admin-managed food library plus the caller's own
// personal foods. Pass ?mine=true to see only the caller's personal library.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = (req.query.q as string | undefined)?.trim();
    const mineOnly = req.query.mine === "true";

    const scope = mineOnly
      ? { createdByUserId: req.user!.id }
      : { OR: [{ createdByUserId: null }, { createdByUserId: req.user!.id }] };

    const foods = await prisma.food.findMany({
      where: {
        ...scope,
        ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      },
      orderBy: { name: "asc" },
      take: 100,
    });

    res.json(foods.map((f) => ({ ...f, isCustom: f.createdByUserId != null })));
  })
);

// Any authenticated user can add to their own personal library — this is
// the default and ALWAYS what happens regardless of role, so an admin using
// the personal "My food library" form on the Nutrition page gets a personal
// food like anyone else. Only the dedicated Admin Panel food form should
// create a shared library entry, and only by explicitly passing
// shared:true (silently ignored for non-admins).
router.post(
  "/",
  validate(foodSchema),
  asyncHandler(async (req, res) => {
    const wantsShared = req.body.shared === true && req.user!.role === "ADMIN";
    const food = await prisma.food.create({
      data: {
        ...req.body,
        createdByUserId: wantsShared ? null : req.user!.id,
      },
    });
    res.status(201).json({ ...food, isCustom: food.createdByUserId != null });
  })
);

async function assertCanModify(foodId: string, req: { user?: { id: string; role: string } }) {
  const food = await prisma.food.findUnique({ where: { id: foodId } });
  if (!food) throw new ApiError(404, "Food not found");
  const isOwner = food.createdByUserId === req.user!.id;
  const isAdminOverSharedFood = req.user!.role === "ADMIN" && food.createdByUserId === null;
  if (!isOwner && !isAdminOverSharedFood) {
    throw new ApiError(403, "You can only edit foods you created");
  }
  return food;
}

router.put(
  "/:id",
  validate(foodSchema),
  asyncHandler(async (req, res) => {
    await assertCanModify(req.params.id, req);
    const food = await prisma.food.update({ where: { id: req.params.id }, data: req.body });
    res.json({ ...food, isCustom: food.createdByUserId != null });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await assertCanModify(req.params.id, req);
    await prisma.food.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
