import { prisma } from "../../lib/prisma";

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  });
  return follow != null;
}

// The single source of truth for "can viewerId see targetUserId's posts?" —
// used by both the posts module (viewing a profile) and the feed module
// (nothing in a feed should bypass this). Public accounts and the owner
// themself can always see; private accounts require an approved follow.
export async function canViewPosts(viewerId: string, targetUserId: string): Promise<boolean> {
  if (viewerId === targetUserId) return true;

  const profile = await prisma.profile.findUnique({
    where: { userId: targetUserId },
    select: { isPrivate: true },
  });
  if (!profile?.isPrivate) return true;

  return isFollowing(viewerId, targetUserId);
}

export async function getFollowCounts(userId: string) {
  const [followers, following] = await Promise.all([
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.follow.count({ where: { followerId: userId } }),
  ]);
  return { followers, following };
}

export interface Relationship {
  isSelf: boolean;
  isFollowing: boolean; // viewer follows target
  isFollowedBy: boolean; // target follows viewer
  hasPendingRequest: boolean; // viewer has a pending request to follow target
}

export async function getRelationship(viewerId: string, targetUserId: string): Promise<Relationship> {
  if (viewerId === targetUserId) {
    return { isSelf: true, isFollowing: false, isFollowedBy: false, hasPendingRequest: false };
  }

  const [following, followedBy, pendingRequest] = await Promise.all([
    isFollowing(viewerId, targetUserId),
    isFollowing(targetUserId, viewerId),
    prisma.followRequest.findUnique({
      where: { requesterId_targetId: { requesterId: viewerId, targetId: targetUserId } },
    }),
  ]);

  return {
    isSelf: false,
    isFollowing: following,
    isFollowedBy: followedBy,
    hasPendingRequest: pendingRequest?.status === "PENDING",
  };
}

// Always returns [smaller, larger] so a conversation between two users has
// exactly one deterministic row regardless of who initiated it.
export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export type MessagingPrivacy = "EVERYONE" | "FOLLOWING" | "MUTUALS" | "NO_ONE";

// Enforces the target's "who can message me" setting. This only gates
// STARTING a new conversation — an existing conversation is grandfathered
// in even if the setting changes afterward (checked by the caller, not
// here, since this function only knows about the relationship).
export async function canMessageUser(senderId: string, targetId: string): Promise<boolean> {
  if (senderId === targetId) return false;

  const profile = await prisma.profile.findUnique({
    where: { userId: targetId },
    select: { messagingPrivacy: true },
  });
  const policy: MessagingPrivacy = (profile?.messagingPrivacy as MessagingPrivacy) ?? "EVERYONE";

  if (policy === "EVERYONE") return true;
  if (policy === "NO_ONE") return false;

  const [senderFollowsTarget, targetFollowsSender] = await Promise.all([
    isFollowing(senderId, targetId),
    isFollowing(targetId, senderId),
  ]);

  if (policy === "MUTUALS") return senderFollowsTarget && targetFollowsSender;
  // FOLLOWING: the target only accepts messages from people THEY follow.
  if (policy === "FOLLOWING") return targetFollowsSender;

  return false;
}
