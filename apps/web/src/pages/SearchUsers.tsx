import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/apiClient";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState, LoadingBlock, ErrorState } from "../components/ui/EmptyState";

interface Relationship {
  isSelf: boolean;
  isFollowing: boolean;
  isFollowedBy: boolean;
  hasPendingRequest: boolean;
}

interface SearchResult {
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isPrivate: boolean;
  relationship: Relationship;
  canMessage: boolean;
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="h-11 w-11 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-900 text-sm font-semibold text-white">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function SearchUsers() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      setError(null);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      api
        .get<SearchResult[]>(`/users/search?q=${encodeURIComponent(q)}`)
        .then((r) => {
          setResults(r);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Search failed"))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  async function follow(result: SearchResult) {
    setBusyUserId(result.userId);
    try {
      await api.post(`/social/follow/${result.userId}`);
      setResults(
        (prev) =>
          prev?.map((r) =>
            r.userId === result.userId
              ? {
                  ...r,
                  relationship: {
                    ...r.relationship,
                    isFollowing: !r.isPrivate,
                    hasPendingRequest: r.isPrivate,
                  },
                }
              : r
          ) ?? null
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function unfollow(result: SearchResult) {
    setBusyUserId(result.userId);
    try {
      await api.post(`/social/unfollow/${result.userId}`);
      setResults(
        (prev) =>
          prev?.map((r) =>
            r.userId === result.userId
              ? { ...r, relationship: { ...r.relationship, isFollowing: false, hasPendingRequest: false } }
              : r
          ) ?? null
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleMessage(result: SearchResult) {
    const conversation = await api.post<{ id: string }>(`/messages/conversations/${result.userId}`);
    navigate(`/messages/${conversation.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Search</h1>
        <p className="text-sm text-ink-500">Find people by name or username.</p>
      </div>

      <input
        autoFocus
        placeholder="Search by name or @username…"
        className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {error && <ErrorState message={error} />}

      {!query.trim() ? (
        <EmptyState icon="🔍" title="Search for people by name or username." />
      ) : loading ? (
        <LoadingBlock />
      ) : results && results.length === 0 ? (
        <EmptyState icon="🙁" title="No users found." hint="Try a different name or username." />
      ) : results && results.length > 0 ? (
        <div className="space-y-2">
          {results.map((result) => (
            <Card key={result.userId}>
              <div className="flex items-center justify-between gap-3">
                <Link to={`/u/${result.userId}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={result.name} avatarUrl={result.avatarUrl} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-ink-900">{result.name}</p>
                      {result.isPrivate && <span className="text-xs text-ink-500">🔒</span>}
                    </div>
                    {result.username && <p className="text-xs text-ink-500">@{result.username}</p>}
                    {result.bio && <p className="mt-0.5 truncate text-xs text-ink-500">{result.bio}</p>}
                  </div>
                </Link>
                <div className="flex flex-shrink-0 gap-2">
                  {result.relationship.isFollowing ? (
                    <Button variant="secondary" onClick={() => unfollow(result)} disabled={busyUserId === result.userId}>
                      Following ✓
                    </Button>
                  ) : result.relationship.hasPendingRequest ? (
                    <Button variant="secondary" disabled>
                      Requested
                    </Button>
                  ) : (
                    <Button onClick={() => follow(result)} disabled={busyUserId === result.userId}>
                      Follow
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => handleMessage(result)}
                    disabled={!result.canMessage}
                    title={result.canMessage ? undefined : "This user isn't accepting messages from you right now."}
                  >
                    Message
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
