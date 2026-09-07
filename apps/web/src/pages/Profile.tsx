import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/apiClient";
import { Card, StatCard } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { LoadingBlock, ErrorState, EmptyState } from "../components/ui/EmptyState";
import { PostComposerModal } from "../components/social/PostComposerModal";
import { PostCard, FeedPost } from "../components/social/PostCard";

interface ProfileData {
  name: string;
  dateOfBirth: string | null;
  sex: "MALE" | "FEMALE" | "OTHER" | null;
  heightCm: number | null;
  activityLevel: string;
  currentWeightKg: number | null;
  age: number | null;
  bmi: number | null;
  bmiCategory: string | null;
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

function Avatar({ name, avatarUrl, size = 16 }: { name: string; avatarUrl: string | null; size?: number }) {
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
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-brand-500 font-semibold text-white"
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [social, setSocial] = useState<SocialProfileData | null>(null);
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [form, setForm] = useState<Partial<ProfileData>>({});
  const [newWeight, setNewWeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [composerOpen, setComposerOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [editMessagingPrivacy, setEditMessagingPrivacy] = useState("EVERYONE");
  const [editError, setEditError] = useState<string | null>(null);

  const [requestsOpen, setRequestsOpen] = useState(false);
  const [requests, setRequests] = useState<FollowRequestItem[] | null>(null);

  function load() {
    api
      .get<ProfileData>("/profile")
      .then((p) => {
        setProfile(p);
        setForm(p);
      })
      .catch((e) => setError(e.message));

    if (!user) return;
    api.get<SocialProfileData>(`/profile/user/${user.id}`).then((s) => {
      setSocial(s);
      setEditUsername(s.username ?? "");
      setEditBio(s.bio ?? "");
      setEditAvatarUrl(s.avatarUrl ?? "");
      setEditIsPrivate(s.isPrivate);
    });
    api
      .get<{ posts: FeedPost[]; restricted: boolean }>(`/posts/user/${user.id}`)
      .then((r) => setPosts(r.posts));
  }

  useEffect(load, [user]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await api.put("/profile", {
        name: form.name,
        dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth).toISOString() : undefined,
        sex: form.sex ?? undefined,
        heightCm: form.heightCm ? Number(form.heightCm) : undefined,
        activityLevel: form.activityLevel,
      });
      setSaved(true);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    }
  }

  async function handleAddWeight(e: FormEvent) {
    e.preventDefault();
    if (!newWeight) return;
    await api.post("/profile/measurements", { weightKg: Number(newWeight) });
    setNewWeight("");
    load();
  }

  async function handleEditSave(e: FormEvent) {
    e.preventDefault();
    setEditError(null);
    try {
      await api.put("/profile", {
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

  function loadRequests() {
    api.get<FollowRequestItem[]>("/social/follow-requests").then(setRequests);
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

  function handlePostDeleted(postId: string) {
    setPosts((prev) => prev?.filter((p) => p.id !== postId) ?? null);
  }

  if (error) return <ErrorState message={error} />;
  if (!profile || !social) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      {/* Social header — avatar, bio, followers/following, like a social profile */}
      <Card>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Avatar name={social.name} avatarUrl={social.avatarUrl} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-ink-900">{social.name}</h1>
                {social.isPrivate && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-ink-500">
                    🔒 Private
                  </span>
                )}
              </div>
              {social.username && <p className="text-sm text-ink-500">@{social.username}</p>}
              {social.bio && <p className="mt-1 max-w-md text-sm text-ink-700">{social.bio}</p>}
              <div className="mt-2 flex gap-4 text-sm">
                <span>
                  <span className="font-semibold text-ink-900">{social.followers}</span>{" "}
                  <span className="text-ink-500">followers</span>
                </span>
                <span>
                  <span className="font-semibold text-ink-900">{social.following}</span>{" "}
                  <span className="text-ink-500">following</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setComposerOpen(true)}>+ Create Post</Button>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Edit social profile
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
          </div>
        </div>
      </Card>

      <div>
        <p className="text-sm text-ink-500">Keep your fitness details current so calorie and BMI targets stay accurate.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Age" value={profile.age != null ? `${profile.age}` : "—"} />
        <StatCard
          label="BMI"
          value={profile.bmi != null ? `${profile.bmi}` : "—"}
          sub={profile.bmiCategory ?? undefined}
        />
        <StatCard label="Height" value={profile.heightCm ? `${profile.heightCm} cm` : "—"} />
        <StatCard label="Current weight" value={profile.currentWeightKg ? `${profile.currentWeightKg} kg` : "—"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name">
                <input
                  className="input"
                  value={form.name ?? ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Date of birth">
                <input
                  type="date"
                  className="input"
                  max={new Date().toISOString().slice(0, 10)}
                  value={form.dateOfBirth ? form.dateOfBirth.slice(0, 10) : ""}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                />
              </Field>
              <Field label="Sex">
                <select
                  className="input"
                  value={form.sex ?? ""}
                  onChange={(e) => setForm({ ...form, sex: e.target.value as ProfileData["sex"] })}
                >
                  <option value="">—</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Height (cm)">
                <input
                  type="number"
                  className="input"
                  value={form.heightCm ?? ""}
                  onChange={(e) => setForm({ ...form, heightCm: Number(e.target.value) })}
                />
              </Field>
              <Field label="Activity level" full>
                <select
                  className="input"
                  value={form.activityLevel ?? "MODERATE"}
                  onChange={(e) => setForm({ ...form, activityLevel: e.target.value })}
                >
                  <option value="SEDENTARY">Sedentary (little/no exercise)</option>
                  <option value="LIGHT">Light (1–3 days/week)</option>
                  <option value="MODERATE">Moderate (3–5 days/week)</option>
                  <option value="ACTIVE">Active (6–7 days/week)</option>
                  <option value="VERY_ACTIVE">Very active (physical job / 2x/day)</option>
                </select>
              </Field>
            </div>
            {error && <ErrorState message={error} />}
            {saved && <p className="text-sm text-brand-700">Profile updated.</p>}
            <Button type="submit">Save changes</Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold text-ink-900">Log current weight</h2>
          <p className="mb-4 text-3xl font-bold text-brand-700">
            {profile.currentWeightKg ? `${profile.currentWeightKg} kg` : "—"}
          </p>
          <form onSubmit={handleAddWeight} className="flex gap-2">
            <input
              type="number"
              step="0.1"
              placeholder="New weight (kg)"
              className="input"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
            />
            <Button type="submit" variant="secondary">
              Log
            </Button>
          </form>
          <p className="mt-3 text-xs text-ink-500">
            This feeds your BMI, calorie target, and goal progress automatically.
          </p>
        </Card>
      </div>

      {/* Posts */}
      <div>
        <h2 className="mb-3 text-lg font-bold text-ink-900">Posts</h2>
        {!posts ? (
          <LoadingBlock />
        ) : posts.length === 0 ? (
          <EmptyState icon="📝" title="You haven't posted anything yet.">
            <Button onClick={() => setComposerOpen(true)} className="mt-3">
              Create your first post
            </Button>
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onDelete={handlePostDeleted} />
            ))}
          </div>
        )}
      </div>

      <PostComposerModal open={composerOpen} onClose={() => setComposerOpen(false)} onCreated={load} />

      {/* Edit social profile */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit social profile">
        <form onSubmit={handleEditSave} className="space-y-4">
          {editError && <ErrorState message={editError} />}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Username</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-ink-500">@</span>
              <input
                className="input"
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
              className="input"
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Avatar image URL</label>
            <input
              type="url"
              placeholder="https://…"
              className="input"
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
              className="input"
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

      <style>{`.input { width: 100%; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; }`}</style>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <label className="mb-1 block text-sm font-medium text-ink-700">{label}</label>
      {children}
    </div>
  );
}
