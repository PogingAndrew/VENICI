import { FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/apiClient";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { EmptyState, LoadingBlock, ErrorState } from "../components/ui/EmptyState";
import { PostComposerModal } from "../components/social/PostComposerModal";
import { PostCard, FeedPost } from "../components/social/PostCard";

interface Relationship {
  isSelf: boolean;
  isFollowing: boolean;
  isFollowedBy: boolean;
  hasPendingRequest: boolean;
}

interface SocialProfileData {
  userId: string;
  name: string;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  followers: number;
  following: number;
  relationship: Relationship;
  canMessage: boolean;
  messagingUnavailableReason: string | null;
}

interface FollowRequestItem {
  id: string;
  requesterId: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

const MESSAGING_PRIVACY_OPTIONS = [
  { value: "EVERYONE", label: "Everyone" },
  { value: "FOLLOWING", label: "People I follow" },
  { value: "MUTUALS", label: "Mutual followers only" },
  { value: "NO_ONE", label: "No one" },
];

function Avatar({ name, avatarUrl, size = 12 }: { name: string; avatarUrl: string | null; size?: number }) {
  const px = size * 4;
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: px, height: px }}
        className="rounded-full object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: px, height: px }}
      className="flex items-center justify-center rounded-full bg-ink-900 font-semibold text-white"
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function SocialProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [profile, setProfile] = useState<SocialProfileData | null>(null);
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [restricted, setRestricted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [editMessagingPrivacy, setEditMessagingPrivacy] = useState("EVERYONE");
  const [editError, setEditError] = useState<string | null>(null);

  const [requestsOpen, setRequestsOpen] = useState(false);
  const [requests, setRequests] = useState<FollowRequestItem[] | null>(null);

  function load() {
    if (!userId) return;
    setError(null);
    api
      .get<SocialProfileData>(`/profile/user/${userId}`)
      .then((p) => {
        setProfile(p);
        setEditName(p.name);
        setEditUsername(p.username ?? "");
        setEditBio(p.bio ?? "");
        setEditAvatarUrl(p.avatarUrl ?? "");
        setEditIsPrivate(p.isPrivate);
      })
      .catch((e) => setError(e.message));

    api
      .get<{ posts: FeedPost[]; restricted: boolean }>(`/posts/user/${userId}`)
      .then((r) => {
        setPosts(r.posts);
        setRestricted(r.restricted);
      });
  }

  useEffect(load, [userId]);

  // Sidebar's Create Post link (and any future deep link) can open the
  // composer directly via ?compose=1 on your own profile.
  useEffect(() => {
    if (searchParams.get("compose") === "1" && profile?.relationship.isSelf) {
      setComposerOpen(true);
      searchParams.delete("compose");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  function loadRequests() {
    api.get<FollowRequestItem[]>("/social/follow-requests").then(setRequests);
  }

  async function handleFollow() {
    if (!userId) return;
    setFollowBusy(true);
    try {
      await api.post(`/social/follow/${userId}`);
      load();
    } finally {
      setFollowBusy(false);
    }
  }

  async function handleUnfollow() {
    if (!userId) return;
    setFollowBusy(true);
    try {
      await api.post(`/social/unfollow/${userId}`);
      load();
    } finally {
      setFollowBusy(false);
    }
  }

  async function handleMessage() {
    if (!userId) return;
    setMessageError(null);
    try {
      const conversation = await api.post<{ id: string }>(`/messages/conversations/${userId}`);
      navigate(`/messages/${conversation.id}`);
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : "Could not start conversation");
    }
  }

  function handlePostDeleted(postId: string) {
    setPosts((prev) => prev?.filter((p) => p.id !== postId) ?? null);
  }

  async function handleEditSave(e: FormEvent) {
    e.preventDefault();
    setEditError(null);
    try {
      await api.put("/profile", {
        name: editName,
        username: editUsername || undefined,
        bio: editBio,
        avatarUrl: editAvatarUrl,
        isPrivate: editIsPrivate,
        messagingPrivacy: editMessagingPrivacy,
      });
      setEditOpen(false);
      load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Could not save changes");
    }
  }

  async function approveRequest(req: FollowRequestItem) {
    await api.post(`/social/follow-requests/${req.id}/approve`);
    loadRequests();
    load();
  }

  async function rejectRequest(req: FollowRequestItem) {
    await api.post(`/social/follow-requests/${req.id}/reject`);
    loadRequests();
  }

  // Your own social profile now lives merged into /profile alongside your
  // fitness data — redirect here so there's one canonical place instead of
  // two pages showing overlapping info. Placed after all hooks above so
  // this conditional return never skips a hook call.
  if (currentUser && userId === currentUser.id) {
    return <Navigate to="/profile" replace />;
  }

  if (error) return <ErrorState message={error} />;
  if (!profile) return <LoadingBlock />;

  const isSelf = profile.relationship.isSelf;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Avatar name={profile.name} avatarUrl={profile.avatarUrl} size={16} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-ink-900">{profile.name}</h1>
                {profile.isPrivate && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-ink-500">
                    🔒 Private
                  </span>
                )}
              </div>
              {profile.username && <p className="text-sm text-ink-500">@{profile.username}</p>}
              {profile.bio && <p className="mt-1 max-w-md text-sm text-ink-700">{profile.bio}</p>}
              <div className="mt-2 flex gap-4 text-sm">
                <span>
                  <span className="font-semibold text-ink-900">{profile.followers}</span>{" "}
                  <span className="text-ink-500">followers</span>
                </span>
                <span>
                  <span className="font-semibold text-ink-900">{profile.following}</span>{" "}
                  <span className="text-ink-500">following</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isSelf ? (
              <>
                <Button onClick={() => setComposerOpen(true)}>+ Create Post</Button>
                <Button variant="secondary" onClick={() => setEditOpen(true)}>
                  Edit profile
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRequestsOpen(true);
                    loadRequests();
                  }}
                >
                  Follow requests
                </Button>
              </>
            ) : (
              <>
                {profile.relationship.isFollowing ? (
                  <Button variant="secondary" onClick={handleUnfollow} disabled={followBusy}>
                    Following ✓
                  </Button>
                ) : profile.relationship.hasPendingRequest ? (
                  <Button variant="secondary" disabled>
                    Requested
                  </Button>
                ) : (
                  <Button onClick={handleFollow} disabled={followBusy}>
                    Follow
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={handleMessage}
                  disabled={!profile.canMessage}
                  title={profile.canMessage ? undefined : profile.messagingUnavailableReason ?? undefined}
                >
                  Message
                </Button>
              </>
            )}
          </div>
        </div>
        {!isSelf && !profile.canMessage && profile.messagingUnavailableReason && (
          <p className="mt-2 text-xs text-ink-500">{profile.messagingUnavailableReason}</p>
        )}
        {messageError && (
          <div className="mt-2">
            <ErrorState message={messageError} />
          </div>
        )}
      </Card>

      {!posts ? (
        <LoadingBlock />
      ) : restricted ? (
        <EmptyState icon="🔒" title="This account is private." hint="Follow this account to see their posts." />
      ) : posts.length === 0 ? (
        isSelf ? (
          <EmptyState icon="📝" title="You haven't posted anything yet.">
            <Button onClick={() => setComposerOpen(true)} className="mt-3">
              Create your first post
            </Button>
          </EmptyState>
        ) : (
          <EmptyState title="No posts yet." />
        )
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onDelete={isSelf ? handlePostDeleted : undefined}
            />
          ))}
        </div>
      )}

      <PostComposerModal open={composerOpen} onClose={() => setComposerOpen(false)} onCreated={load} />

      {/* Edit profile */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit profile">
        <form onSubmit={handleEditSave} className="space-y-4">
          {editError && <ErrorState message={editError} />}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Name</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Username</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-ink-500">@</span>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value.toLowerCase())}
              />
            </div>
            <p className="mt-1 text-xs text-ink-500">3-20 characters: letters, numbers, underscore.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Bio</label>
            <textarea
              rows={3}
              maxLength={280}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Avatar image URL</label>
            <input
              type="url"
              placeholder="https://…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={editAvatarUrl}
              onChange={(e) => setEditAvatarUrl(e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-500">Leave blank to use your initial as a placeholder.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={editIsPrivate}
              onChange={(e) => setEditIsPrivate(e.target.checked)}
            />
            Private account — only approved followers can see your posts
          </label>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Who can message you?</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={editMessagingPrivacy}
              onChange={(e) => setEditMessagingPrivacy(e.target.value)}
            >
              {MESSAGING_PRIVACY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className="w-full">
            Save changes
          </Button>
        </form>
      </Modal>

      {/* Follow requests inbox */}
      <Modal open={requestsOpen} onClose={() => setRequestsOpen(false)} title="Follow requests">
        {!requests ? (
          <LoadingBlock />
        ) : requests.length === 0 ? (
          <p className="text-sm text-ink-500">No pending requests.</p>
        ) : (
          <div className="space-y-2">
            {requests.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-3">
                  <Avatar name={req.name} avatarUrl={req.avatarUrl} size={8} />
                  <span className="text-sm font-medium text-ink-900">{req.name}</span>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => approveRequest(req)}>Approve</Button>
                  <Button variant="secondary" onClick={() => rejectRequest(req)}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
