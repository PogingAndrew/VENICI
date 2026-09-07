import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/asyncHandler";

const router = Router();
router.use(authenticate);

// A single aggregated feed of everything that deserves the user's
// attention: pending follow requests (the original ask — there was no
// place to see these at all), requests you SENT that were recently
// accepted, new posts from people they follow since they last checked,
// and conversations with unread messages. No separate Notification
// table/event log — each category is derived live from data that already
// exists, which keeps it always-accurate (no risk of a notification row
// going stale or duplicating) at the cost of not having a permanent
// notification history. Reasonable tradeoff for what this is.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const [followRequests, profile, following] = await Promise.all([
      prisma.followRequest.findMany({
        where: { targetId: userId, status: "PENDING" },
        include: { requester: { select: { profile: { select: { name: true, avatarUrl: true } } } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.profile.findUnique({ where: { userId }, select: { notificationsLastCheckedAt: true } }),
      prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
    ]);

    const followingIds = following.map((f) => f.followingId);
    const since = profile?.notificationsLastCheckedAt ?? new Date(0);

    // Requests I sent that the target approved since I last checked. Uses
    // the same "since" baseline as new posts — approving updates
    // FollowRequest.updatedAt automatically (the @updatedAt field), so no
    // extra bookkeeping is needed beyond the mark-seen call already used
    // for posts.
    const acceptedRequests = await prisma.followRequest.findMany({
      where: { requesterId: userId, status: "APPROVED", updatedAt: { gt: since } },
      include: { target: { select: { profile: { select: { name: true, avatarUrl: true } } } } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    const newPosts =
      followingIds.length > 0
        ? await prisma.post.findMany({
            where: { authorId: { in: followingIds }, createdAt: { gt: since } },
            include: { author: { select: { profile: { select: { name: true, avatarUrl: true } } } } },
            orderBy: { createdAt: "desc" },
            take: 20,
          })
        : [];

    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    const otherUserIds = conversations.map((c) => (c.userAId === userId ? c.userBId : c.userAId));
    const otherProfiles = await prisma.profile.findMany({
      where: { userId: { in: otherUserIds } },
      select: { userId: true, name: true, avatarUrl: true },
    });
    const profileMap = new Map<string, (typeof otherProfiles)[number]>(otherProfiles.map((p) => [p.userId, p]));

    const unreadConversations = conversations
      .map((c) => {
        const isA = c.userAId === userId;
        const myLastRead = isA ? c.lastReadByA : c.lastReadByB;
        const lastMessage = c.messages[0];
        if (!lastMessage || lastMessage.senderId === userId) return null;
        if (myLastRead && lastMessage.createdAt <= myLastRead) return null;

        const otherUserId = isA ? c.userBId : c.userAId;
        const otherProfile = profileMap.get(otherUserId);
        return {
          id: c.id,
          otherUserId,
          otherUserName: otherProfile?.name ?? "Unknown",
          otherUserAvatarUrl: otherProfile?.avatarUrl ?? null,
          lastMessage: lastMessage.content,
          createdAt: lastMessage.createdAt,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c != null);

    const serializedRequests = followRequests.map((r) => ({
      id: r.id,
      requesterId: r.requesterId,
      name: r.requester.profile?.name ?? "Unknown",
      avatarUrl: r.requester.profile?.avatarUrl ?? null,
      createdAt: r.createdAt,
    }));

    const serializedAcceptedRequests = acceptedRequests.map((r) => ({
      id: r.id,
      targetId: r.targetId,
      name: r.target.profile?.name ?? "Unknown",
      avatarUrl: r.target.profile?.avatarUrl ?? null,
      updatedAt: r.updatedAt,
    }));

    const serializedPosts = newPosts.map((p) => ({
      id: p.id,
      authorId: p.authorId,
      authorName: p.author.profile?.name ?? "Unknown",
      authorAvatarUrl: p.author.profile?.avatarUrl ?? null,
      content: p.content,
      createdAt: p.createdAt,
    }));

    res.json({
      followRequests: serializedRequests,
      acceptedFollowRequests: serializedAcceptedRequests,
      newPosts: serializedPosts,
      unreadConversations,
      totalCount:
        serializedRequests.length +
        serializedAcceptedRequests.length +
        serializedPosts.length +
        unreadConversations.length,
    });
  })
);

// Resets the "new posts" / "accepted requests" baseline to now. Pending
// follow requests clear themselves when approved/rejected; unread messages
// clear when their conversation is opened (see messages.routes.ts) — only
// posts and acceptances need this explicit "mark seen" action.
router.post(
  "/mark-seen",
  asyncHandler(async (req, res) => {
    await prisma.profile.update({
      where: { userId: req.user!.id },
      data: { notificationsLastCheckedAt: new Date() },
    });
    res.status(204).send();
  })
);

export default router;
