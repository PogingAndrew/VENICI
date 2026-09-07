import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/apiClient";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { formatCount, formatRelativeTime } from "../../lib/format";
import { CommentsModal } from "./CommentsModal";
import { ShareModal } from "./ShareModal";
import { PostComposerModal, CreatedPost } from "./PostComposerModal";

export interface FeedPost {
  id: string;
  content: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  likesCount: number;
  commentsCount: number;
  likedByViewer: boolean;
  isFollowingAuthor?: boolean;
  isOwnPost?: boolean;
}

function Avatar({ name, avatarUrl, size = 10 }: { name: string; avatarUrl: string | null; size?: number }) {
  const px = size * 4;
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: px, height: px }}
        className="flex-shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: px, height: px }}
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-ink-900 font-semibold text-white"
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function PostCard({
  post,
  showFollowButton = false,
  onDelete,
}: {
  post: FeedPost;
  showFollowButton?: boolean;
  onDelete?: (postId: string) => void;
}) {
  const { user } = useAuth();
  const [content, setContent] = useState(post.content);
  const [removed, setRemoved] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [liked, setLiked] = useState(post.likedByViewer);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [following, setFollowing] = useState(post.isFollowingAuthor ?? false);
  const [followBusy, setFollowBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const isOwn = post.isOwnPost ?? post.authorId === user?.id;

  if (removed) return null;

  async function toggleLike() {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikesCount((c) => c + (wasLiked ? -1 : 1));
    try {
      const res = await api.post<{ liked: boolean; likesCount: number }>(`/posts/${post.id}/like`);
      setLiked(res.liked);
      setLikesCount(res.likesCount);
    } catch {
      setLiked(wasLiked);
      setLikesCount((c) => c + (wasLiked ? 1 : -1));
    }
  }

  async function toggleFollow() {
    setFollowBusy(true);
    try {
      if (following) {
        await api.post(`/social/unfollow/${post.authorId}`);
        setFollowing(false);
      } else {
        await api.post(`/social/follow/${post.authorId}`);
        setFollowing(true);
      }
    } finally {
      setFollowBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this post?")) return;
    await api.delete(`/posts/${post.id}`);
    setRemoved(true);
    onDelete?.(post.id);
  }

  function handleEdited(updated: CreatedPost) {
    setContent(updated.content);
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <Link to={`/u/${post.authorId}`} className="flex min-w-0 items-center gap-3">
          <Avatar name={post.authorName} avatarUrl={post.authorAvatarUrl} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900 hover:underline">{post.authorName}</p>
            <div className="flex items-center gap-1 text-xs text-ink-500">
              {post.authorUsername && <span className="truncate">@{post.authorUsername}</span>}
              <span>·</span>
              <span className="flex-shrink-0">{formatRelativeTime(post.createdAt)}</span>
            </div>
          </div>
        </Link>
        <div className="flex flex-shrink-0 items-center gap-2">
          {showFollowButton && !isOwn && (
            <Button
              variant={following ? "secondary" : "primary"}
              onClick={toggleFollow}
              disabled={followBusy}
              className="px-3 py-1 text-xs"
            >
              {following ? "Following" : "Follow"}
            </Button>
          )}
          {isOwn && (
            <>
              <button onClick={() => setEditOpen(true)} className="text-xs font-semibold text-ink-500 hover:text-ink-900">
                Edit
              </button>
              <button onClick={handleDelete} className="text-xs font-semibold text-red-500">
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-ink-700">{content}</p>

      <div className="mt-4 flex items-center gap-6 border-t border-slate-100 pt-3 text-sm">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 font-medium transition-colors ${
            liked ? "text-brand-600" : "text-ink-500 hover:text-ink-900"
          }`}
        >
          <span aria-hidden>{liked ? "❤️" : "🤍"}</span> {formatCount(likesCount)}
        </button>
        <button
          onClick={() => setCommentsOpen(true)}
          className="flex items-center gap-1.5 font-medium text-ink-500 hover:text-ink-900"
        >
          <span aria-hidden>💬</span> {formatCount(commentsCount)}
        </button>
        <button
          onClick={() => setShareOpen(true)}
          className="flex items-center gap-1.5 font-medium text-ink-500 hover:text-ink-900"
        >
          <span aria-hidden>📤</span> Share
        </button>
      </div>

      <CommentsModal
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        postId={post.id}
        onCommentAdded={() => setCommentsCount((c) => c + 1)}
      />
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} postId={post.id} />

      {isOwn && (
        <PostComposerModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onCreated={handleEdited}
          editingPost={{ id: post.id, content }}
        />
      )}
    </Card>
  );
}
