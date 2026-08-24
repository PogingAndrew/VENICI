import { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl2 border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent = "brand",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "brand" | "ink";
}) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent === "brand" ? "text-brand-700" : "text-ink-900"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
    </Card>
  );
}
