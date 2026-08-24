import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../middleware/asyncHandler";
import { ApiError } from "../../middleware/errorHandler";

const router = Router();
router.use(authenticate);

function dayRange(dateStr?: string) {
  const date = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// Returns meals (with items+food) for a given day, grouped by meal type,
// plus totals — this is what the Nutrition page renders directly.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { start, end } = dayRange(req.query.date as string | undefined);
    const meals = await prisma.meal.findMany({
      where: { userId: req.user!.id, loggedAt: { gte: start, lte: end } },
      include: { items: { include: { food: true } } },
      orderBy: { loggedAt: "asc" },
    });

    const totals = meals.reduce(
      (acc, meal) => {
        for (const item of meal.items) {
          acc.calories += item.food.calories * item.quantity;
          acc.proteinG += item.food.proteinG * item.quantity;
          acc.carbsG += item.food.carbsG * item.quantity;
          acc.fatG += item.food.fatG * item.quantity;
          acc.fiberG += item.food.fiberG * item.quantity;
        }
        return acc;
      },
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }
    );

    res.json({ meals, totals });
  })
);

const addItemSchema = z.object({
  body: z.object({
    mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
    foodId: z.string(),
    quantity: z.number().positive().default(1),
    date: z.string().datetime().optional(),
  }),
});

// Finds-or-creates the meal bucket for (user, type, day) then appends the item —
// this is the "quick and easy food logging" flow from the spec.
router.post(
  "/items",
  validate(addItemSchema),
  asyncHandler(async (req, res) => {
    const { mealType, foodId, quantity, date } = req.body;
    const { start, end } = dayRange(date);

    let meal = await prisma.meal.findFirst({
      where: {
        userId: req.user!.id,
        type: mealType,
        loggedAt: { gte: start, lte: end },
      },
    });
    if (!meal) {
      meal = await prisma.meal.create({
        data: { userId: req.user!.id, type: mealType, loggedAt: date ? new Date(date) : new Date() },
      });
    }

    const item = await prisma.mealItem.create({
      data: { mealId: meal.id, foodId, quantity },
      include: { food: true },
    });
    res.status(201).json(item);
  })
);

router.patch(
  "/items/:id",
  validate(z.object({ body: z.object({ quantity: z.number().positive() }) })),
  asyncHandler(async (req, res) => {
    const item = await prisma.mealItem.findUnique({
      where: { id: req.params.id },
      include: { meal: true },
    });
    if (!item || item.meal.userId !== req.user!.id) throw new ApiError(404, "Item not found");

    const updated = await prisma.mealItem.update({
      where: { id: item.id },
      data: { quantity: req.body.quantity },
      include: { food: true },
    });
    res.json(updated);
  })
);

router.delete(
  "/items/:id",
  asyncHandler(async (req, res) => {
    const item = await prisma.mealItem.findUnique({
      where: { id: req.params.id },
      include: { meal: true },
    });
    if (!item || item.meal.userId !== req.user!.id) throw new ApiError(404, "Item not found");
    await prisma.mealItem.delete({ where: { id: item.id } });
    res.status(204).send();
  })
);

export default router;
