import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { asyncHandler } from "../../middleware/asyncHandler";
import { prisma } from "../../lib/prisma";
import { canMessageUser, getRelationship } from "../social/social.service";

const router = Router();
router.use(authenticate);

// User discovery — search by name or @username, case-insensitive partial
// match. Deliberately does NOT load the whole user table: the query itself
// filters in the database and caps results, so this stays cheap regardless
// of how many accounts exist. Each result includes the viewer's
// relationship to that user (and whether messaging is allowed) so the UI
// can render the right Follow/Following/Requested/Message state without a
// second round-trip per result.
router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const q = ((req.query.q as string) ?? "").trim();
    if (!q) return res.json([]);

    const profiles = await prisma.profile.findMany({
      where: {
        userId: { not: req.user!.id },
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { username: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { userId: true, name: true, username: true, avatarUrl: true, bio: true, isPrivate: true },
      take: 20,
      orderBy: { name: "asc" },
    });

    const results = await Promise.all(
      profiles.map(async (p) => ({
        userId: p.userId,
        name: p.name,
        username: p.username,
        avatarUrl: p.avatarUrl,
        bio: p.bio,
        isPrivate: p.isPrivate,
        relationship: await getRelationship(req.user!.id, p.userId),
        canMessage: await canMessageUser(req.user!.id, p.userId),
      }))
    );

    res.json(results);
  })
);

// Thin, admin-facing listing of accounts. Deeper per-user management lives
// under /api/admin so this module stays small and single-purpose.
router.get(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true, createdAt: true, profile: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(users);
  })
);

export default router;
