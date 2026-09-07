import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/apiClient";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState, LoadingBlock } from "../components/ui/EmptyState";
import { formatMessageTimestamp, shouldShowMessageTimestamp } from "../lib/format";

interface ConversationSummary {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatarUrl: string | null;
  lastMessage: { content: string; createdAt: string; senderId: string } | null;
  updatedAt: string;
}

interface SharedPost {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sharedPost: SharedPost | null;
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

function SharedPostCard({ post }: { post: SharedPost }) {
  return (
    <Link
      to={`/u/${post.authorId}`}
      className="mt-2 block rounded-lg border border-slate-200 bg-white p-3 text-ink-900 hover:bg-slate-50"
    >
      <div className="flex items-center gap-2">
        <Avatar name={post.authorName} avatarUrl={post.authorAvatarUrl} size={6} />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{post.authorName}</p>
          {post.authorUsername && <p className="text-[10px] text-ink-500">@{post.authorUsername}</p>}
        </div>
      </div>
      <p className="mt-2 line-clamp-3 text-xs text-ink-700">{post.content}</p>
    </Link>
  );
}

export default function Messages() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  function loadConversations() {
    api.get<ConversationSummary[]>("/messages/conversations").then(setConversations);
  }
  useEffect(loadConversations, []);

  useEffect(() => {
    if (!conversationId) {
      setMessages(null);
      return;
    }
    api.get<Message[]>(`/messages/conversations/${conversationId}/messages`).then(setMessages);
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!conversationId || !draft.trim()) return;
    const message = await api.post<Message>(`/messages/conversations/${conversationId}/messages`, {
      content: draft,
    });
    setMessages((prev) => (prev ? [...prev, message] : [message]));
    setDraft("");
    loadConversations();
  }

  const activeConversation = conversations?.find((c) => c.id === conversationId) ?? null;

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      {/* Conversation list — on mobile, hidden once a thread is open (use
          the back button to return); always visible from md breakpoint up. */}
      <div
        className={`w-full flex-shrink-0 overflow-y-auto md:w-72 ${
          conversationId ? "hidden md:block" : "block"
        }`}
      >
        <h1 className="mb-3 text-lg font-bold text-ink-900">Messages</h1>
        {!conversations ? (
          <LoadingBlock />
        ) : conversations.length === 0 ? (
          <EmptyState icon="✉️" title="No conversations yet." hint="Message someone from their profile." />
        ) : (
          <div className="space-y-1">
            {conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => navigate(`/messages/${c.id}`)}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-slate-50 ${
                  c.id === conversationId ? "bg-brand-50" : ""
                }`}
              >
                {/* The avatar and name are their own links to the profile —
                    stopPropagation keeps a click there from also opening
                    the conversation underneath. */}
                <Link to={`/u/${c.otherUserId}`} onClick={(e) => e.stopPropagation()}>
                  <Avatar name={c.otherUserName} avatarUrl={c.otherUserAvatarUrl} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/u/${c.otherUserId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="block truncate text-sm font-semibold text-ink-900 hover:underline"
                  >
                    {c.otherUserName}
                  </Link>
                  <p className="truncate text-xs text-ink-500">
                    {c.lastMessage
                      ? c.lastMessage.content === "Shared a post"
                        ? "📤 Shared a post"
                        : c.lastMessage.content
                      : "No messages yet"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active thread — hidden on mobile until a conversation is selected,
          since the list panel occupies the full width until then. */}
      <div className={`flex-1 flex-col ${conversationId ? "flex" : "hidden md:flex"}`}>
        {!conversationId ? (
          <Card className="flex flex-1 items-center justify-center text-sm text-ink-500">
            Select a conversation to start messaging.
          </Card>
        ) : (
          <>
            <Card className="mb-3 flex items-center gap-3">
              <button
                onClick={() => navigate("/messages")}
                className="text-ink-500 hover:text-ink-900 md:hidden"
                aria-label="Back to conversations"
              >
                ←
              </button>
              {activeConversation && (
                <Link to={`/u/${activeConversation.otherUserId}`} className="flex items-center gap-3 hover:underline">
                  <Avatar name={activeConversation.otherUserName} avatarUrl={activeConversation.otherUserAvatarUrl} />
                  <span className="text-sm font-semibold text-ink-900">{activeConversation.otherUserName}</span>
                </Link>
              )}
            </Card>

            <div className="flex-1 space-y-2 overflow-y-auto rounded-xl2 border border-slate-200 bg-white p-4">
              {!messages ? (
                <LoadingBlock />
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-ink-500">Say hello 👋</p>
              ) : (
                messages.map((m, i) => {
                  const isMine = m.senderId === user?.id;
                  const previousCreatedAt = i > 0 ? messages[i - 1].createdAt : null;
                  const showTimestamp = shouldShowMessageTimestamp(m.createdAt, previousCreatedAt);
                  return (
                    <div key={m.id}>
                      {showTimestamp && (
                        <p className="my-2 text-center text-[11px] text-ink-400">
                          {formatMessageTimestamp(m.createdAt)}
                        </p>
                      )}
                      <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-xs rounded-2xl px-4 py-2 text-sm ${
                            isMine ? "bg-brand-500 text-white" : "bg-slate-100 text-ink-900"
                          }`}
                        >
                          {m.sharedPost ? (
                            <>
                              <p className="text-xs opacity-90">📤 Shared a post</p>
                              <SharedPostCard post={m.sharedPost} />
                            </>
                          ) : (
                            m.content
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSend} className="mt-3 flex gap-2">
              <input
                autoFocus
                placeholder="Type a message…"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <Button type="submit" disabled={!draft.trim()}>
                Send
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
