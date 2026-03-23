import type { PanelPlaceholderItem } from "../../lib/tauri/contracts";
import { QuotaSummary } from "./QuotaSummary";
import type { CopyTree } from "../../app/shared/i18n";
import { formatAbsoluteTime, formatRelativeTime, localizeBadgeLabel, localizeStatusLabel } from "../../app/shared/i18n";
import { getServiceAlertLevel, getSeverityLabelKey } from "../../lib/tauri/summary";

export const ServiceCard = ({
  service,
  copy,
  showLastRefreshed = true
}: {
  service: PanelPlaceholderItem;
  copy: CopyTree;
  showLastRefreshed?: boolean;
}) => {
  const badgeLabel = service.badgeLabel ? localizeBadgeLabel(copy, service.badgeLabel) : null;
  const shouldShowBadge =
    badgeLabel !== null && badgeLabel !== copy.quotaStatusLive && badgeLabel !== copy.snapshotFresh;
  const alertLevel = getServiceAlertLevel(service);
  const cardClass =
    alertLevel === "danger"
      ? "border-rose-200 bg-rose-50/70 shadow-rose-100"
      : alertLevel === "warning"
        ? "border-amber-200 bg-amber-50/70 shadow-amber-100"
        : "border-slate-200 bg-white shadow-slate-200";
  const accentClass =
    alertLevel === "danger"
      ? "bg-rose-500"
      : alertLevel === "warning"
        ? "bg-amber-400"
        : "bg-transparent";
  const severityLabel = localizeStatusLabel(copy, getSeverityLabelKey(service));

  return (
    <article className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm ${cardClass}`}>
      {alertLevel !== "normal" ? (
        <div className={`absolute inset-y-0 left-0 w-1.5 ${accentClass}`} aria-hidden="true" />
      ) : null}
      <div className={`flex items-start justify-between gap-3 ${alertLevel !== "normal" ? "pl-2" : ""}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-950">{service.serviceName}</h3>
            {severityLabel ? (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${alertLevel === "danger" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                {severityLabel}
              </span>
            ) : null}
          </div>
          {service.accountLabel ? (
            <p className="mt-1 text-sm text-slate-500">{service.accountLabel}</p>
          ) : null}
        </div>
        {shouldShowBadge ? (
          <div className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
            {badgeLabel}
          </div>
        ) : null}
      </div>
      <div className={`mt-3 grid gap-2 ${alertLevel !== "normal" ? "pl-2" : ""}`}>
        {service.quotaDimensions.map((dimension) => (
          <QuotaSummary key={dimension.label} dimension={dimension} copy={copy} />
        ))}
      </div>
      {showLastRefreshed ? (
        <p className={`mt-3 text-xs text-slate-500 ${alertLevel !== "normal" ? "pl-2" : ""}`} title={formatAbsoluteTime(service.lastRefreshedAt)}>
          {copy.lastRefreshedAt}: {formatRelativeTime(copy, service.lastRefreshedAt)}
        </p>
      ) : null}
    </article>
  );
};
