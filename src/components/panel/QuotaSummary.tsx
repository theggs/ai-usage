import type { QuotaDimension } from "../../lib/tauri/contracts";

export const QuotaSummary = ({ label, remainingPercent, remainingAbsolute, resetHint }: QuotaDimension) => (
  <div className="rounded-2xl bg-white/70 px-3 py-2 shadow-sm shadow-emerald-950/5">
    <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
      <span>{label}</span>
      <span>{remainingPercent}%</span>
    </div>
    <div className="mt-2 text-sm font-semibold text-slate-900">{remainingAbsolute}</div>
    {resetHint ? <div className="mt-1 text-xs text-slate-500">{resetHint}</div> : null}
  </div>
);
