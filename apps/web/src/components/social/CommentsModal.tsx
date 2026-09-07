import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { LoadingBlock } from "../ui/EmptyState";
import { formatRelativeTime } from "../../lib/format";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function CommentsModal({
  open,
  onClose,
  postId,
  onCommentAdded,
}: {
  open: boolean;
  onClose: () => void;
  postId: string | null;
  onCommentAdded?: () => void;
}) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  function load() {
    if (!postId) return;
    api.get<Comment[]>(`/posts/${postId}/comments`).then(setComments);
  }

  useEffect(() => {
    if (open) load();
    else {
      setComments(null);
      setDraft("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, postId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!postId || !draft.trim()) return;
    setPosting(true);
    try {
      await api.post(`/posts/${postId}/comments`, { content: draft });
      setDraft("");
      load();
      onCommentAdded?.();
    } finally {
      setPosting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Comments">
      <div className="max-h-80 space-y-3 overflow-y-auto">
        {!comments ? (
          <LoadingBlock />
        ) : comments.length === 0 ? (
          <p className="text-sm text-ink-500">No comments yet. Be the first to reply.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Avatar name={c.authorName} avatarUrl={c.authorAvatarUrl} />
              <div className="min-w-0 flex-1 rounded-lg bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Link to={`/u/${c.authorId}`} className="text-xs font-semibold text-ink-900 hover:underline">
                    {c.authorName}
                  </Link>
                  <span className="text-[10px] text-ink-500">{formatRelativeTime(c.createdAt)}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-700">{c.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
        <input
          placeholder="Add a comment…"
          maxLength={500}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit" disabled={!draft.trim() || posting}>
          Post
        </Button>
      </form>
    </Modal>
  );
}
