import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/asyncHandler";
import { ApiError } from "../../middleware/errorHandler";
import { getFollowCounts, getRelationship } from "./social.service";

const router = Router();
router.use(authenticate);

router.get(
  "/:userId/relationship",
  asyncHandler(async (req, res) => {
    const relationship = await getRelationship(req.user!.id, req.params.userId);
    res.json(relationship);
  })
);

router.get(
  "/:userId/counts",
  asyncHandler(async (req, res) => {
    const counts = await getFollowCounts(req.params.userId);
    res.json(counts);
  })
);

// Follows directly for a public account; creates a pending FollowRequest
// for a private one — enforced server-side regardless of what the client
// believes the target's privacy setting is.
router.post(
  "/follow/:userId",
  asyncHandler(async (req, res) => {
    const targetId = req.params.userId;
    const followerId = req.user!.id;
    if (targetId === followerId) throw new ApiError(400, "You can't follow yourself");

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { profile: { select: { isPrivate: true } } },
    });
    if (!target) throw new ApiError(404, "User not found");

    const alreadyFollowing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId: targetId } },
    });
    if (alreadyFollowing) return res.json({ status: "following" });

    if (target.profile?.isPrivate) {
      await prisma.followRequest.upsert({
        where: { requesterId_targetId: { requesterId: followerId, targetId } },
        create: { requesterId: followerId, targetId, status: "PENDING" },
        update: { status: "PENDING" },
      });
      return res.json({ status: "pending" });
    }

    await prisma.follow.create({ data: { followerId, followingId: targetId } });
    res.json({ status: "following" });
  })
);

router.post(
  "/unfollow/:userId",
  asyncHandler(async (req, res) => {
    const targetId = req.params.userId;
    const followerId = req.user!.id;

    await prisma.follow.deleteMany({ where: { followerId, followingId: targetId } });
    // Clear any pending/rejected request too, so a re-follow starts clean.
    await prisma.followRequest.deleteMany({ where: { requesterId: followerId, targetId } });

    res.status(204).send();
  })
);

// Pending requests TO the current user (i.e. people asking to follow them).
router.get(
  "/follow-requests",
  asyncHandler(async (req, res) => {
    const requests = await prisma.followRequest.findMany({
      where: { targetId: req.user!.id, status: "PENDING" },
      include: { requester: { select: { id: true, profile: { select: { name: true, avatarUrl: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(
      requests.map((r) => ({
        id: r.id,
        requesterId: r.requesterId,
        name: r.requester.profile?.name ?? "Unknown",
        avatarUrl: r.requester.profile?.avatarUrl ?? null,
        createdAt: r.createdAt,
      }))
    );
  })
);

router.post(
  "/follow-requests/:id/approve",
  asyncHandler(async (req, res) => {
    const request = await prisma.followRequest.findUnique({ where: { id: req.params.id } });
    if (!request || request.targetId !== req.user!.id) throw new ApiError(404, "Request not found");
    if (request.status !== "PENDING") throw new ApiError(409, "Request already resolved");

    await prisma.$transaction([
      prisma.followRequest.update({ where: { id: request.id }, data: { status: "APPROVED" } }),
      prisma.follow.create({
        data: { followerId: request.requesterId, followingId: request.targetId },
      }),
    ]);
    res.json({ status: "approved" });
  })
);

router.post(
  "/follow-requests/:id/reject",
  asyncHandler(async (req, res) => {
    const request = await prisma.followRequest.findUnique({ where: { id: req.params.id } });
    if (!request || request.targetId !== req.user!.id) throw new ApiError(404, "Request not found");
    if (request.status !== "PENDING") throw new ApiError(409, "Request already resolved");

    await prisma.followRequest.update({ where: { id: request.id }, data: { status: "REJECTED" } });
    res.json({ status: "rejected" });
  })
);

export default router;
