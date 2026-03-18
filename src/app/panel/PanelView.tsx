import { ServiceCard } from "../../components/panel/ServiceCard";
import { useAppState } from "../shared/appState";
import { getCopy } from "../shared/i18n";

export const PanelView = () => {
  const { panelState, preferences, refreshPanel, openSettings, isLoading, error } = useAppState();
  const copy = getCopy(preferences?.language ?? "zh-CN");

  return (
    <section className="grid gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">{copy.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{copy.subtitle}</p>
        </div>
        <button
          className="rounded-full border border-emerald-200 bg-white/70 px-4 py-2 text-sm font-medium text-emerald-700"
          onClick={openSettings}
          type="button"
        >
          {copy.settings}
        </button>
      </header>

      <div className="flex items-center justify-between rounded-3xl bg-emerald-950 px-4 py-3 text-white shadow-lg shadow-emerald-950/25">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-emerald-200">{copy.demoTag}</div>
          <div className="mt-1 text-sm">{copy.lastRefresh}: {panelState ? new Date(panelState.updatedAt).toLocaleString() : "--"}</div>
          <div className="mt-1 text-xs text-emerald-100">
            {copy.trayPreview}: {panelState?.desktopSurface.summaryText ?? copy.summaryHidden}
          </div>
        </div>
        <button
          className="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950"
          onClick={() => void refreshPanel()}
          type="button"
        >
          {isLoading ? "..." : copy.refresh}
        </button>
      </div>

      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid gap-3">
        {panelState?.items.length ? (
          panelState.items.map((service) => <ServiceCard key={service.serviceId} service={service} />)
        ) : (
          <div className="rounded-3xl bg-white/70 p-6 text-center text-sm text-slate-500">{copy.noData}</div>
        )}
      </div>
    </section>
  );
};
