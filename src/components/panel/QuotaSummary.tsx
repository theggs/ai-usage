import type { QuotaDimension } from "../../lib/tauri/contracts";
import type { CopyTree } from "../../app/shared/i18n";
import {
  localizeBurnRatePace,
  localizeBurnRateSecondaryLine,
  localizeDimensionLabel,
  localizeRemaining,
  localizeResetHint,
  localizeStatusLabel
} from "../../app/shared/i18n";
import { getQuotaBurnRateDisplay, getQuotaHealthSignal } from "../../lib/tauri/summary";

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
  copy,
  nowMs
}: {
  dimension: QuotaDimension;
  copy: CopyTree;
  nowMs?: number;
}) => {
  const { label, remainingPercent, remainingAbsolute, resetsAt, resetHint } = dimension;
  const localizedRemaining = localizeRemaining(copy, remainingPercent, remainingAbsolute);
  const localizedResetHint = localizeResetHint(copy, resetsAt ?? resetHint, nowMs);
  const displayLabel = localizeDimensionLabel(copy, label);
  const burnRate = getQuotaBurnRateDisplay(dimension, nowMs);
  const health = getQuotaHealthSignal(dimension, nowMs);
  const burnRateSecondaryLine = burnRate ? localizeBurnRateSecondaryLine(copy, burnRate) : undefined;
  const severityLabel =
    health.source === "pace" && (health.pace === "behind" || health.pace === "far-behind")
      ? localizeBurnRatePace(copy, health.pace)
      : health.source === "fallback" && health.level !== "normal"
        ? localizeStatusLabel(copy, health.level === "danger" ? "danger" : "warning")
        : undefined;
  const severityBadgeTitle =
    health.source === "pace" && burnRate?.willLastUntilReset === false ? burnRateSecondaryLine : undefined;
  const severityBadgeAriaLabel =
    severityLabel && severityBadgeTitle ? `${severityLabel}. ${severityBadgeTitle}` : undefined;

  return (
    <div className="grid gap-2.5 rounded-2xl bg-slate-50 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{displayLabel}</span>
          {severityLabel ? (
            <span
              aria-label={severityBadgeAriaLabel}
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${health.progressTone === "danger" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}
              title={severityBadgeTitle}
            >
              {severityLabel}
            </span>
          ) : null}
        </div>
        <span className={`text-sm font-semibold ${textToneClasses[health.progressTone]}`}>{localizedRemaining}</span>
      </div>
      <div className="relative h-4 overflow-hidden rounded-full bg-slate-200/90" data-testid={`progress-track-${label}`}>
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${toneClasses[health.progressTone]}`}
          data-testid={`progress-fill-${label}`}
          style={{ width: remainingPercent !== undefined ? `${remainingPercent}%` : "100%" }}
        />
      </div>
      {localizedResetHint ? (
        <span className="text-right text-xs text-slate-500">{localizedResetHint}</span>
      ) : null}
    </div>
  );
};
