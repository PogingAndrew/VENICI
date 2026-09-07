import { FormEvent, useEffect, useState } from "react";
import { api } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

export interface CreatedPost {
  id: string;
  content: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
}

export function PostComposerModal({
  open,
  onClose,
  onCreated,
  editingPost,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (post: CreatedPost) => void;
  // When provided, this modal edits that post (PATCH) instead of creating
  // a new one (POST) — same form, same validation, reused rather than
  // duplicating a near-identical "edit post" modal.
  editingPost?: { id: string; content: string } | null;
}) {
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const isEditing = editingPost != null;

  // Pre-fill (or clear) the textarea whenever the modal is opened for a
  // different post, or opened fresh for creating.
  useEffect(() => {
    if (open) setContent(editingPost?.content ?? "");
  }, [open, editingPost]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    try {
      const post = isEditing
        ? await api.patch<CreatedPost>(`/posts/${editingPost!.id}`, { content })
        : await api.post<CreatedPost>("/posts", { content });
      setContent("");
      onCreated(post);
      onClose();
    } finally {
      setPosting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit post" : "Create post"}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          autoFocus
          rows={4}
          maxLength={2000}
          placeholder="What's on your mind?"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <Button type="submit" className="w-full" disabled={!content.trim() || posting}>
          {posting ? "Saving…" : isEditing ? "Save changes" : "Post"}
        </Button>
      </form>
    </Modal>
  );
}
