export function ProgressBar({
  value,
  max,
  label,
  color = "bg-brand-500",
}: {
  value: number;
  max: number;
  label?: string;
  color?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      {label && (
        <div className="mb-1 flex justify-between text-xs text-ink-500">
          <span>{label}</span>
          <span>
            {Math.round(value)} / {Math.round(max)}
          </span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
