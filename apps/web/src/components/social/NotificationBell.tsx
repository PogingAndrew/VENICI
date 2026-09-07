import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/apiClient";
import { formatRelativeTime } from "../../lib/format";

interface FollowRequestItem {
  id: string;
  requesterId: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

interface AcceptedRequestItem {
  id: string;
  targetId: string;
  name: string;
  avatarUrl: string | null;
  updatedAt: string;
}

interface NewPostItem {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  content: string;
  createdAt: string;
}

interface UnreadConversationItem {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatarUrl: string | null;
  lastMessage: string;
  createdAt: string;
}

interface NotificationsResponse {
  followRequests: FollowRequestItem[];
  acceptedFollowRequests: AcceptedRequestItem[];
  newPosts: NewPostItem[];
  unreadConversations: UnreadConversationItem[];
  totalCount: number;
}

const POLL_INTERVAL_MS = 30000;

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  function load() {
    api.get<NotificationsResponse>("/notifications").then(setData);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    // Opening clears the "new posts" baseline — follow requests clear via
    // approve/reject, unread messages clear via opening the conversation,
    // so only posts need an explicit "seen" call here.
    if (next) api.post("/notifications/mark-seen").then(load);
  }

  async function approve(req: FollowRequestItem) {
    await api.post(`/social/follow-requests/${req.id}/approve`);
    load();
  }

  async function reject(req: FollowRequestItem) {
    await api.post(`/social/follow-requests/${req.id}/reject`);
    load();
  }

  const count = data?.totalCount ?? 0;
  const nothingToShow =
    data &&
    data.followRequests.length === 0 &&
    data.acceptedFollowRequests.length === 0 &&
    data.newPosts.length === 0 &&
    data.unreadConversations.length === 0;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={toggleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
        aria-label={count > 0 ? `Notifications (${count} unread)` : "Notifications"}
      >
        <span aria-hidden className="text-lg">
          🔔
        </span>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-50 max-h-96 w-80 overflow-y-auto rounded-xl bg-white text-ink-900 shadow-xl ring-1 ring-black/10">
          {!data ? (
            <p className="p-4 text-sm text-ink-500">Loading…</p>
          ) : nothingToShow ? (
            <p className="p-4 text-sm text-ink-500">You're all caught up.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.followRequests.length > 0 && (
                <div className="p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Follow requests
                  </p>
                  <div className="space-y-2">
                    {data.followRequests.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-2">
                        <Link
                          to={`/u/${r.requesterId}`}
                          onClick={() => setOpen(false)}
                          className="flex min-w-0 items-center gap-2"
                        >
                          <Avatar name={r.name} avatarUrl={r.avatarUrl} />
                          <span className="truncate text-sm font-medium">{r.name}</span>
                        </Link>
                        <div className="flex flex-shrink-0 gap-1">
                          <button
                            onClick={() => approve(r)}
                            className="rounded-md bg-brand-500 px-2 py-1 text-xs font-semibold text-white hover:bg-brand-600"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => reject(r)}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-ink-700 hover:bg-slate-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.acceptedFollowRequests.length > 0 && (
                <div className="p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Accepted
                  </p>
                  <div className="space-y-2">
                    {data.acceptedFollowRequests.map((r) => (
                      <Link
                        key={r.id}
                        to={`/u/${r.targetId}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-50"
                      >
                        <Avatar name={r.name} avatarUrl={r.avatarUrl} />
                        <div className="min-w-0">
                          <p className="text-sm">
                            <span className="font-semibold">{r.name}</span> accepted your follow request
                          </p>
                          <p className="text-[10px] text-ink-400">{formatRelativeTime(r.updatedAt)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {data.newPosts.length > 0 && (
                <div className="p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">New posts</p>
                  <div className="space-y-2">
                    {data.newPosts.map((p) => (
                      <Link
                        key={p.id}
                        to={`/u/${p.authorId}`}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-2 rounded-lg p-1 hover:bg-slate-50"
                      >
                        <Avatar name={p.authorName} avatarUrl={p.authorAvatarUrl} />
                        <div className="min-w-0">
                          <p className="text-sm">
                            <span className="font-semibold">{p.authorName}</span> posted
                          </p>
                          <p className="truncate text-xs text-ink-500">{p.content}</p>
                          <p className="text-[10px] text-ink-400">{formatRelativeTime(p.createdAt)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {data.unreadConversations.length > 0 && (
                <div className="p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Messages</p>
                  <div className="space-y-2">
                    {data.unreadConversations.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setOpen(false);
                          navigate(`/messages/${c.id}`);
                        }}
                        className="flex w-full items-start gap-2 rounded-lg p-1 text-left hover:bg-slate-50"
                      >
                        <Avatar name={c.otherUserName} avatarUrl={c.otherUserAvatarUrl} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{c.otherUserName}</p>
                          <p className="truncate text-xs text-ink-500">
                            {c.lastMessage === "Shared a post" ? "📤 Shared a post" : c.lastMessage}
                          </p>
                          <p className="text-[10px] text-ink-400">{formatRelativeTime(c.createdAt)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
