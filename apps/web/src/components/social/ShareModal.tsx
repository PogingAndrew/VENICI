import { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface SearchResult {
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
}

interface ShareResult {
  results: { userId: string; success: boolean; error?: string }[];
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="h-8 w-8 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// "Share" is explicitly scoped to sending the post to someone as a
// message — not a generic repost. This just wraps the search endpoint as a
// recipient picker and calls POST /posts/:id/share.
export function ShareModal({
  open,
  onClose,
  postId,
}: {
  open: boolean;
  onClose: () => void;
  postId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelected(null);
      setFeedback(null);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      api.get<SearchResult[]>(`/users/search?q=${encodeURIComponent(query)}`).then(setResults);
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  async function send() {
    if (!postId || !selected) return;
    setSending(true);
    setFeedback(null);
    try {
      const res = await api.post<ShareResult>(`/posts/${postId}/share`, { toUserIds: [selected.userId] });
      const result = res.results[0];
      if (result.success) {
        setFeedback(`Sent to ${selected.name}!`);
        setSelected(null);
        setQuery("");
      } else {
        setFeedback(result.error ?? "Couldn't send.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Share post">
      <div className="space-y-3">
        {feedback && <p className="text-sm text-brand-700">{feedback}</p>}

        {selected ? (
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <Avatar name={selected.name} avatarUrl={selected.avatarUrl} />
              <span className="text-sm font-medium text-ink-900">{selected.name}</span>
            </div>
            <button onClick={() => setSelected(null)} className="text-xs text-ink-500">
              Change
            </button>
          </div>
        ) : (
          <input
            autoFocus
            placeholder="Search people to send to…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}

        {!selected && results.length > 0 && (
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.userId}
                onClick={() => setSelected(r)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
              >
                <Avatar name={r.name} avatarUrl={r.avatarUrl} />
                <div>
                  <p className="font-medium text-ink-900">{r.name}</p>
                  {r.username && <p className="text-xs text-ink-500">@{r.username}</p>}
                </div>
              </button>
            ))}
          </div>
        )}

        <Button onClick={send} disabled={!selected || sending} className="w-full">
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </Modal>
  );
}
