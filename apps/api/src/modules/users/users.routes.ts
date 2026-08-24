import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { asyncHandler } from "../../middleware/asyncHandler";
import { prisma } from "../../lib/prisma";

// Thin, admin-facing listing of accounts. Deeper per-user management lives
// under /api/admin so this module stays small and single-purpose.
const router = Router();
router.use(authenticate, requireRole("ADMIN"));

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true, createdAt: true, profile: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(users);
  })
);

export default router;
