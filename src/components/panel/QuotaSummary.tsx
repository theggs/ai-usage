import type { QuotaDimension } from "../../lib/tauri/contracts";
import type { CopyTree } from "../../app/shared/i18n";
import { localizeDimensionLabel, localizeRemaining, localizeResetHint, localizeStatusLabel } from "../../app/shared/i18n";

const toneClasses: Record<QuotaDimension["progressTone"], string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-400",
  danger: "bg-rose-500",
  muted: "bg-slate-300"
};
const textToneClasses: Record<QuotaDimension["progressTone"], string> = {
  success: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-rose-700",
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
  const severityLabel =
    dimension.status === "exhausted"
      ? localizeStatusLabel(copy, "danger")
      : dimension.status === "warning"
        ? localizeStatusLabel(copy, "warning")
        : undefined;

  return (
    <div className="grid gap-2.5 rounded-2xl bg-slate-50 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{displayLabel}</span>
          {severityLabel ? (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${progressTone === "danger" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
              {severityLabel}
            </span>
          ) : null}
        </div>
        <span className={`text-sm font-semibold ${textToneClasses[progressTone]}`}>{localizedRemaining}</span>
      </div>
      <div className="relative h-4 overflow-hidden rounded-full bg-slate-200/90" data-testid={`progress-track-${label}`}>
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${toneClasses[progressTone]}`}
          data-testid={`progress-fill-${label}`}
          style={{ width: remainingPercent !== undefined ? `${remainingPercent}%` : "100%" }}
        />
      </div>
      {localizedResetHint ? <span className="text-right text-xs text-slate-500">{localizedResetHint}</span> : null}
    </div>
  );
};
