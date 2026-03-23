import type { QuotaDimension } from "../../lib/tauri/contracts";
import type { CopyTree } from "../../app/shared/i18n";
import { localizeDimensionLabel, localizeRemaining, localizeResetHint } from "../../app/shared/i18n";

const toneClasses: Record<QuotaDimension["progressTone"], string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-400",
  danger: "bg-rose-500",
  muted: "bg-slate-300"
};
const textToneClasses: Record<QuotaDimension["progressTone"], string> = {
  success: "text-emerald-950",
  warning: "text-amber-950",
  danger: "text-rose-950",
  muted: "text-slate-700"
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
  const displayLabel = localizeDimensionLabel(copy, label);

  return (
    <div className="grid gap-2 rounded-2xl bg-slate-50 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{displayLabel}</span>
        {localizedResetHint ? <span className="text-xs text-slate-500">{localizedResetHint}</span> : null}
      </div>
      <div className="relative h-6 overflow-hidden rounded-full bg-slate-200" data-testid={`progress-track-${label}`}>
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${toneClasses[progressTone]}`}
          data-testid={`progress-fill-${label}`}
          style={{ width: remainingPercent !== undefined ? `${remainingPercent}%` : "100%" }}
        />
        <div
          className={`absolute inset-0 flex items-center justify-between px-3 text-sm font-semibold ${textToneClasses[progressTone]}`}
        >
          <span>{remainingPercent !== undefined ? `${remainingPercent}%` : copy.noPercent}</span>
          <span className="truncate pl-3 text-xs font-medium text-slate-700">{localizedRemaining}</span>
        </div>
      </div>
    </div>
  );
};
