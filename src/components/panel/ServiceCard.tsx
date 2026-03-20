import type { PanelPlaceholderItem } from "../../lib/tauri/contracts";
import { QuotaSummary } from "./QuotaSummary";
import type { CopyTree } from "../../app/shared/i18n";
import { localizeBadgeLabel } from "../../app/shared/i18n";

const formatCardTime = (value: string) => {
  const timestamp = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value);
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleString();
};

export const ServiceCard = ({
  service,
  copy
}: {
  service: PanelPlaceholderItem;
  copy: CopyTree;
}) => {
  const badgeLabel = service.badgeLabel ? localizeBadgeLabel(copy, service.badgeLabel) : null;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">{service.serviceName}</h3>
          {service.accountLabel ? (
            <p className="mt-1 text-sm text-slate-500">{service.accountLabel}</p>
          ) : null}
        </div>
        {badgeLabel ? (
          <div className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            {badgeLabel}
          </div>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2">
        {service.quotaDimensions.map((dimension) => (
          <QuotaSummary key={dimension.label} dimension={dimension} copy={copy} />
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {copy.lastRefreshedAt}: {formatCardTime(service.lastRefreshedAt)}
      </p>
    </article>
  );
};
