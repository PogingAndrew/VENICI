import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../middleware/asyncHandler";
import { ApiError } from "../../middleware/errorHandler";
import { canMessageUser, orderedPair } from "../social/social.service";

const router = Router();
router.use(authenticate);

// All conversations the current user is part of, with the other
// participant's name and the most recent message, newest activity first.
router.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    const otherUserIds = conversations.map((c) => (c.userAId === userId ? c.userBId : c.userAId));
    const profiles = await prisma.profile.findMany({
      where: { userId: { in: otherUserIds } },
      select: { userId: true, name: true, avatarUrl: true },
    });
    const profileMap = new Map<string, (typeof profiles)[number]>(profiles.map((p) => [p.userId, p]));

    const serialized = conversations
      .map((c) => {
        const otherUserId = c.userAId === userId ? c.userBId : c.userAId;
        const lastMessage = c.messages[0] ?? null;
        return {
          id: c.id,
          otherUserId,
          otherUserName: profileMap.get(otherUserId)?.name ?? "Unknown",
          otherUserAvatarUrl: profileMap.get(otherUserId)?.avatarUrl ?? null,
          lastMessage: lastMessage
            ? { content: lastMessage.content, createdAt: lastMessage.createdAt, senderId: lastMessage.senderId }
            : null,
          updatedAt: lastMessage?.createdAt ?? c.createdAt,
        };
      })
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    res.json(serialized);
  })
);

// Gets or creates the (single, deterministic) conversation with another
// user, without sending a message — used when the "Message" button is
// clicked from a profile, before anything has been typed yet.
router.post(
  "/conversations/:userId",
  asyncHandler(async (req, res) => {
    const otherUserId = req.params.userId;
    const myId = req.user!.id;
    if (otherUserId === myId) throw new ApiError(400, "You can't message yourself");

    const otherUser = await prisma.user.findUnique({ where: { id: otherUserId } });
    if (!otherUser) throw new ApiError(404, "User not found");

    const [userAId, userBId] = orderedPair(myId, otherUserId);
    const existing = await prisma.conversation.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    });

    // Only gate STARTING a new conversation — one that already exists
    // (e.g. from before the recipient tightened their messaging privacy)
    // stays usable rather than retroactively locking people out mid-thread.
    if (!existing) {
      const allowed = await canMessageUser(myId, otherUserId);
      if (!allowed) {
        throw new ApiError(403, "This user isn't accepting messages from you right now.");
      }
    }

    const conversation =
      existing ??
      (await prisma.conversation.create({ data: { userAId, userBId } }));
    res.json({ id: conversation.id });
  })
);

router.get(
  "/conversations/:id/messages",
  asyncHandler(async (req, res) => {
    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    if (!conversation) throw new ApiError(404, "Conversation not found");
    const isA = conversation.userAId === req.user!.id;
    if (!isA && conversation.userBId !== req.user!.id) {
      throw new ApiError(403, "Not a participant in this conversation");
    }

    // Opening a conversation marks it read for this participant — clears
    // it from their unread-messages notifications.
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: isA ? { lastReadByA: new Date() } : { lastReadByB: new Date() },
    });

    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      include: {
        sharedPost: {
          include: {
            author: { select: { profile: { select: { name: true, username: true, avatarUrl: true } } } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    const serialized = messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      content: m.content,
      createdAt: m.createdAt,
      sharedPost: m.sharedPost
        ? {
            id: m.sharedPost.id,
            content: m.sharedPost.content,
            authorId: m.sharedPost.authorId,
            authorName: m.sharedPost.author.profile?.name ?? "Unknown",
            authorUsername: m.sharedPost.author.profile?.username ?? null,
            authorAvatarUrl: m.sharedPost.author.profile?.avatarUrl ?? null,
          }
        : null,
    }));
    res.json(serialized);
  })
);

const sendSchema = z.object({ body: z.object({ content: z.string().min(1).max(2000) }) });

router.post(
  "/conversations/:id/messages",
  validate(sendSchema),
  asyncHandler(async (req, res) => {
    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    if (!conversation) throw new ApiError(404, "Conversation not found");
    if (conversation.userAId !== req.user!.id && conversation.userBId !== req.user!.id) {
      throw new ApiError(403, "Not a participant in this conversation");
    }

    const message = await prisma.message.create({
      data: { conversationId: conversation.id, senderId: req.user!.id, content: req.body.content },
    });
    res.status(201).json(message);
  })
);

export default router;
