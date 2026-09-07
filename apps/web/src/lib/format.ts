// "2h ago", "3d ago", social-media-style relative timestamps, falling back
// to a plain date once it's more than a week old.
export function formatRelativeTime(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// "1.2K", "3.4M" — compact counts for like/comment numbers.
export function formatCount(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

// Messenger-style rule: show a small timestamp divider above a message
// when it's the first in the thread, or when at least 10 minutes have
// passed since the previous message (regardless of sender) — a burst of
// back-to-back messages doesn't get a timestamp on every single one.
const MESSAGE_TIMESTAMP_GAP_MS = 10 * 60 * 1000;

export function shouldShowMessageTimestamp(
  current: string | Date,
  previous: string | Date | null
): boolean {
  if (!previous) return true;
  const currentTime = typeof current === "string" ? new Date(current).getTime() : current.getTime();
  const previousTime = typeof previous === "string" ? new Date(previous).getTime() : previous.getTime();
  return currentTime - previousTime >= MESSAGE_TIMESTAMP_GAP_MS;
}

// "2:34 PM" today, "Yesterday 2:34 PM", "Mon 2:34 PM" within the last
// week, or "Jan 5, 2:34 PM" (with year if not this year) further back —
// the same tiering Messenger uses for its inline timestamp dividers.
export function formatMessageTimestamp(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);

  if (dayDiff === 0) return time;
  if (dayDiff === 1) return `Yesterday ${time}`;
  if (dayDiff < 7) return `${date.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;

  const dateLabel = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
  return `${dateLabel}, ${time}`;
}
