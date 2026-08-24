export function EmptyState({ icon = "📭", title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl2 border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
      <div className="mb-2 text-3xl">{icon}</div>
      <p className="font-medium text-ink-700">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-ink-500">{hint}</p>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl2 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>
  );
}

export function LoadingBlock() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-24 rounded-xl2 bg-slate-100" />
      <div className="h-24 rounded-xl2 bg-slate-100" />
    </div>
  );
}
