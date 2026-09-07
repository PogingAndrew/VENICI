import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { api } from "../lib/apiClient";
import { Card } from "../components/ui/Card";
import { EmptyState, LoadingBlock } from "../components/ui/EmptyState";
import { PostComposerModal } from "../components/social/PostComposerModal";
import { PostCard, FeedPost } from "../components/social/PostCard";

interface FeedResponse {
  posts: FeedPost[];
  nextCursor: string | null;
}

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [justPosted, setJustPosted] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async (afterCursor: string | null) => {
    setLoadingMore(true);
    try {
      const res = await api.get<FeedResponse>(
        `/feed${afterCursor ? `?cursor=${encodeURIComponent(afterCursor)}` : ""}`
      );
      setPosts((prev) => (prev ? [...prev, ...res.posts] : res.posts));
      setCursor(res.nextCursor);
      setHasMore(res.nextCursor != null);
    } finally {
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadMore(null);
  }, [loadMore]);

  // Infinite scroll: load the next page when the sentinel div scrolls into view.
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore(cursor);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [cursor, hasMore, loadingMore, loadMore]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Feed</h1>
        <p className="text-sm text-ink-500">Public posts and updates from people you follow.</p>
      </div>

      <Card>
        <button
          onClick={() => setComposerOpen(true)}
          className="w-full rounded-lg border border-slate-200 px-4 py-3 text-left text-sm text-ink-500 hover:bg-slate-50"
        >
          What's on your mind?
        </button>
      </Card>

      {justPosted && (
        <div className="rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-700">
          Post published!{" "}
          {user && (
            <Link to={`/u/${user.id}`} className="font-semibold underline">
              View on your profile →
            </Link>
          )}
        </div>
      )}

      {!posts ? (
        <LoadingBlock />
      ) : posts.length === 0 ? (
        <EmptyState
          icon="📰"
          title="Your feed is empty."
          hint="Search for people to follow, or check back once more public posts are shared."
        />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} showFollowButton />
          ))}
          <div ref={sentinelRef} />
          {loadingMore && <LoadingBlock />}
          {!hasMore && <p className="py-4 text-center text-xs text-ink-500">You're all caught up.</p>}
        </div>
      )}

      <PostComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={() => {
          setJustPosted(true);
          setTimeout(() => setJustPosted(false), 6000);
        }}
      />
    </div>
  );
}
