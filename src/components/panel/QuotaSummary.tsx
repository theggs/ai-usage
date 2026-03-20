import type { QuotaDimension } from "../../lib/tauri/contracts";
import type { CopyTree } from "../../app/shared/i18n";
import { localizeRemaining, localizeResetHint } from "../../app/shared/i18n";

const toneClasses: Record<QuotaDimension["progressTone"], string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-400",
  danger: "bg-rose-500",
  muted: "bg-slate-300"
};

export const QuotaSummary = ({
  dimension,
  copy
}: {
  dimension: QuotaDimension;
  copy: CopyTree;
}) => {
  const { label, remainingPercent, remainingAbsolute, resetHint, progressTone } = dimension;
  const localizedRemaining = localizeRemaining(copy, remainingPercent, remainingAbsolute);
  const localizedResetHint = localizeResetHint(copy, resetHint);

  return (
    <div className="grid gap-2 rounded-xl bg-slate-50 px-3 py-3">
      <div className="flex items-center justify-between gap-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        <span>{label}</span>
        <span>{remainingPercent !== undefined ? `${remainingPercent}%` : "--"}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-200" data-testid={`progress-track-${label}`}>
        <div
          className={`h-full rounded-full transition-[width] ${toneClasses[progressTone]}`}
          data-testid={`progress-fill-${label}`}
          style={{ width: remainingPercent !== undefined ? `${remainingPercent}%` : "100%" }}
        />
      </div>
      {localizedResetHint ? <div className="mt-1 text-xs text-slate-500">{localizedResetHint}</div> : null}
    </div>
  );
};
