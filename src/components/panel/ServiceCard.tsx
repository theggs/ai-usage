import type { PanelPlaceholderItem } from "../../lib/tauri/contracts";
import { QuotaSummary } from "./QuotaSummary";

export const ServiceCard = ({ service }: { service: PanelPlaceholderItem }) => (
  <article className="rounded-[28px] border border-white/60 bg-white/80 p-4 shadow-lg shadow-emerald-950/8 backdrop-blur">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm uppercase tracking-[0.2em] text-emerald-700">{service.statusLabel}</div>
        <h3 className="mt-2 text-lg font-semibold text-slate-950">{service.serviceName}</h3>
        {service.accountLabel ? (
          <p className="text-sm text-slate-500">{service.accountLabel}</p>
        ) : null}
      </div>
      <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
        Demo
      </div>
    </div>
    <div className="mt-4 grid gap-2">
      {service.quotaDimensions.map((dimension) => (
        <QuotaSummary key={dimension.label} {...dimension} />
      ))}
    </div>
    <p className="mt-4 text-xs text-slate-500">Last refreshed: {new Date(service.lastRefreshedAt).toLocaleString()}</p>
  </article>
);
