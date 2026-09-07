import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/asyncHandler";

const router = Router();
router.use(authenticate);

const PAGE_SIZE = 20;

// The feed shows posts from everyone you follow, PLUS posts from any
// public account (even if you don't follow them) — a discovery feed, not
// strictly a "following only" one. Private accounts you don't follow are
// still excluded entirely; that privacy boundary never bends here, only
// the "must follow to see" boundary does, for public accounts specifically.
//
// Cursor-based (pass the createdAt ISO timestamp of the last post you saw)
// rather than offset-based, so pagination stays correct even as new posts
// are created between page loads.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const cursor = req.query.cursor as string | undefined;

    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = new Set(following.map((f) => f.followingId));

    const posts = await prisma.post.findMany({
      where: {
        createdAt: cursor ? { lt: new Date(cursor) } : undefined,
        OR: [
          { authorId: { in: [...followingIds] } },
          { author: { profile: { isPrivate: false } } },
        ],
      },
      include: {
        author: { select: { profile: { select: { name: true, username: true, avatarUrl: true } } } },
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    });

    const postIds = posts.map((p) => p.id);
    const myLikes =
      postIds.length > 0
        ? await prisma.like.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } })
        : [];
    const likedSet = new Set(myLikes.map((l) => l.postId));

    const serialized = posts.map((post) => ({
      id: post.id,
      content: post.content,
      createdAt: post.createdAt,
      authorId: post.authorId,
      authorName: post.author.profile?.name ?? "Unknown",
      authorUsername: post.author.profile?.username ?? null,
      authorAvatarUrl: post.author.profile?.avatarUrl ?? null,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      likedByViewer: likedSet.has(post.id),
      isFollowingAuthor: followingIds.has(post.authorId),
      isOwnPost: post.authorId === userId,
    }));

    const nextCursor =
      posts.length === PAGE_SIZE ? posts[posts.length - 1].createdAt.toISOString() : null;

    res.json({ posts: serialized, nextCursor });
  })
);

export default router;
