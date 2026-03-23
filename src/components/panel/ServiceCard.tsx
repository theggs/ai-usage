import type { PanelPlaceholderItem } from "../../lib/tauri/contracts";
import { QuotaSummary } from "./QuotaSummary";
import type { CopyTree } from "../../app/shared/i18n";
import { formatAbsoluteTime, formatRelativeTime, localizeBadgeLabel } from "../../app/shared/i18n";
import { getServiceAlertLevel } from "../../lib/tauri/summary";

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

  return (
    <article className={`overflow-hidden rounded-2xl border p-4 shadow-sm ${cardClass}`}>
      {alertLevel !== "normal" ? (
        <div className={`-ml-4 mb-4 h-10 w-1 rounded-r-full ${accentClass}`} aria-hidden="true" />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">{service.serviceName}</h3>
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
      <div className="mt-3 grid gap-2">
        {service.quotaDimensions.map((dimension) => (
          <QuotaSummary key={dimension.label} dimension={dimension} copy={copy} />
        ))}
      </div>
      {showLastRefreshed ? (
        <p className="mt-3 text-xs text-slate-500" title={formatAbsoluteTime(service.lastRefreshedAt)}>
          {copy.lastRefreshedAt}: {formatRelativeTime(copy, service.lastRefreshedAt)}
        </p>
      ) : null}
    </article>
  );
};
