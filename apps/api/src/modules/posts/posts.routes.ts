import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../middleware/asyncHandler";
import { ApiError } from "../../middleware/errorHandler";
import { canMessageUser, canViewPosts, orderedPair } from "../social/social.service";

const router = Router();
router.use(authenticate);

interface RawPost {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  author: { profile: { name: string; username: string | null; avatarUrl: string | null } | null };
  _count: { likes: number; comments: number };
}

// Shared shape for a post as returned to the client — includes counts and,
// when `viewerId` is provided, whether the viewer has liked it. Used by
// posts.routes.ts, feed.routes.ts, and the share-preview in messages.
function serializePost(post: RawPost, likedByViewer: boolean) {
  return {
    id: post.id,
    content: post.content,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    authorId: post.authorId,
    authorName: post.author.profile?.name ?? "Unknown",
    authorUsername: post.author.profile?.username ?? null,
    authorAvatarUrl: post.author.profile?.avatarUrl ?? null,
    likesCount: post._count.likes,
    commentsCount: post._count.comments,
    likedByViewer,
  };
}

const postInclude = {
  author: { select: { profile: { select: { name: true, username: true, avatarUrl: true } } } },
  _count: { select: { likes: true, comments: true } },
} as const;

async function likedPostIds(viewerId: string, postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const likes = await prisma.like.findMany({
    where: { userId: viewerId, postId: { in: postIds } },
    select: { postId: true },
  });
  return new Set(likes.map((l) => l.postId));
}

// Posts by one user, gated by canViewPosts (private accounts hide posts
// from non-approved followers) — enforced here at the API level, not just
// hidden in the UI. Returns `restricted: true` with an empty list rather
// than a bare 403, so the frontend can distinguish "private account" from
// "no posts yet".
router.get(
  "/user/:userId",
  asyncHandler(async (req, res) => {
    const allowed = await canViewPosts(req.user!.id, req.params.userId);
    if (!allowed) return res.json({ posts: [], restricted: true });

    const posts = await prisma.post.findMany({
      where: { authorId: req.params.userId },
      include: postInclude,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const liked = await likedPostIds(req.user!.id, posts.map((p) => p.id));
    res.json({ posts: posts.map((p) => serializePost(p, liked.has(p.id))), restricted: false });
  })
);

const createSchema = z.object({
  body: z.object({ content: z.string().min(1).max(2000) }),
});

router.post(
  "/",
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const post = await prisma.post.create({
      data: { authorId: req.user!.id, content: req.body.content },
      include: postInclude,
    });
    res.status(201).json(serializePost(post, false));
  })
);

router.patch(
  "/:id",
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post || post.authorId !== req.user!.id) throw new ApiError(404, "Post not found");

    const updated = await prisma.post.update({
      where: { id: post.id },
      data: { content: req.body.content },
      include: postInclude,
    });
    const liked = await likedPostIds(req.user!.id, [updated.id]);
    res.json(serializePost(updated, liked.has(updated.id)));
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post || post.authorId !== req.user!.id) throw new ApiError(404, "Post not found");
    await prisma.post.delete({ where: { id: post.id } });
    res.status(204).send();
  })
);

// Toggle like: unlikes if already liked, likes otherwise. Idempotent-ish
// from the client's perspective — a double-click just toggles twice.
router.post(
  "/:id/like",
  asyncHandler(async (req, res) => {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) throw new ApiError(404, "Post not found");
    if (!(await canViewPosts(req.user!.id, post.authorId))) {
      throw new ApiError(403, "You can't interact with this post");
    }

    const existing = await prisma.like.findUnique({
      where: { postId_userId: { postId: post.id, userId: req.user!.id } },
    });

    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
    } else {
      await prisma.like.create({ data: { postId: post.id, userId: req.user!.id } });
    }

    const likesCount = await prisma.like.count({ where: { postId: post.id } });
    res.json({ liked: !existing, likesCount });
  })
);

router.get(
  "/:id/comments",
  asyncHandler(async (req, res) => {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) throw new ApiError(404, "Post not found");
    if (!(await canViewPosts(req.user!.id, post.authorId))) {
      throw new ApiError(403, "You can't view comments on this post");
    }

    const comments = await prisma.comment.findMany({
      where: { postId: post.id },
      include: { author: { select: { profile: { select: { name: true, username: true, avatarUrl: true } } } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    res.json(
      comments.map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        authorId: c.authorId,
        authorName: c.author.profile?.name ?? "Unknown",
        authorUsername: c.author.profile?.username ?? null,
        authorAvatarUrl: c.author.profile?.avatarUrl ?? null,
      }))
    );
  })
);

const commentSchema = z.object({ body: z.object({ content: z.string().min(1).max(500) }) });

router.post(
  "/:id/comments",
  validate(commentSchema),
  asyncHandler(async (req, res) => {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) throw new ApiError(404, "Post not found");
    if (!(await canViewPosts(req.user!.id, post.authorId))) {
      throw new ApiError(403, "You can't comment on this post");
    }

    const comment = await prisma.comment.create({
      data: { postId: post.id, authorId: req.user!.id, content: req.body.content },
      include: { author: { select: { profile: { select: { name: true, username: true, avatarUrl: true } } } } },
    });

    res.status(201).json({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      authorId: comment.authorId,
      authorName: comment.author.profile?.name ?? "Unknown",
      authorUsername: comment.author.profile?.username ?? null,
      authorAvatarUrl: comment.author.profile?.avatarUrl ?? null,
    });
  })
);

router.delete(
  "/comments/:commentId",
  asyncHandler(async (req, res) => {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
    if (!comment || comment.authorId !== req.user!.id) throw new ApiError(404, "Comment not found");
    await prisma.comment.delete({ where: { id: comment.id } });
    res.status(204).send();
  })
);

// Sharing a post is explicitly scoped to "send it to someone as a
// message" — not a generic repost/reshare. Each recipient gets their own
// Message row with sharedPostId set; the client renders a mini post-card
// for those. Respects both the post's privacy (can the sharer even see
// it) and each recipient's messaging-privacy setting individually, so one
// blocked recipient doesn't fail the whole request.
const shareSchema = z.object({
  body: z.object({ toUserIds: z.array(z.string()).min(1).max(20) }),
});

router.post(
  "/:id/share",
  validate(shareSchema),
  asyncHandler(async (req, res) => {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) throw new ApiError(404, "Post not found");
    if (!(await canViewPosts(req.user!.id, post.authorId))) {
      throw new ApiError(403, "You can't share this post");
    }

    const myId = req.user!.id;
    const results = await Promise.all(
      (req.body.toUserIds as string[]).map(async (toUserId: string) => {
        if (toUserId === myId) return { userId: toUserId, success: false, error: "Can't share with yourself" };

        const [userAId, userBId] = orderedPair(myId, toUserId);
        const existingConversation = await prisma.conversation.findUnique({
          where: { userAId_userBId: { userAId, userBId } },
        });

        if (!existingConversation) {
          const allowed = await canMessageUser(myId, toUserId);
          if (!allowed) {
            return { userId: toUserId, success: false, error: "This user isn't accepting messages from you" };
          }
        }

        const conversation =
          existingConversation ?? (await prisma.conversation.create({ data: { userAId, userBId } }));

        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderId: myId,
            content: "Shared a post",
            sharedPostId: post.id,
          },
        });
        return { userId: toUserId, success: true };
      })
    );

    res.json({ results });
  })
);

export default router;
