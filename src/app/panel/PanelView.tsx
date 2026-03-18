import { ServiceCard } from "../../components/panel/ServiceCard";
import { useAppState } from "../shared/appState";
import { getCopy, getSnapshotMessage, getSnapshotTag } from "../shared/i18n";

const formatPanelTime = (updatedAt?: string) => {
  if (!updatedAt) {
    return "--";
  }

  const timestamp = /^\d+$/.test(updatedAt) ? Number(updatedAt) * 1000 : Date.parse(updatedAt);
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleString();
};

export const PanelView = () => {
  const { panelState, preferences, refreshPanel, openSettings, isLoading, error } = useAppState();
  const copy = getCopy(preferences?.language ?? "zh-CN");
  const statusMessage = getSnapshotMessage(copy, panelState?.snapshotState, true);
  const statusDetail = panelState?.statusMessage?.trim();
  const snapshotLabel = getSnapshotTag(copy, panelState?.snapshotState);

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
          <div className="text-xs uppercase tracking-[0.2em] text-emerald-200">
            {snapshotLabel}
          </div>
          <div className="mt-1 text-sm">{copy.lastRefresh}: {formatPanelTime(panelState?.updatedAt)}</div>
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

      <div className="rounded-3xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <div className="font-semibold">{copy.syncStatus}: {snapshotLabel}</div>
        <div className="mt-1 text-sky-800">{statusMessage}</div>
        {statusDetail && statusDetail !== statusMessage ? (
          <div className="mt-1 text-xs text-sky-700">{statusDetail}</div>
        ) : null}
        <div className="mt-2 text-xs text-sky-700">
          {copy.activeSession}: {panelState?.activeSession?.sessionLabel ?? copy.noActiveSession}
        </div>
        <div className="mt-1 text-xs text-sky-700">
          {copy.dataSource}: {panelState?.activeSession?.source ?? copy.localCodexCli}
        </div>
      </div>

      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid gap-3">
        {panelState?.items.length ? (
          panelState.items.map((service) => <ServiceCard key={service.serviceId} service={service} />)
        ) : (
          <div className="rounded-3xl bg-white/70 p-6 text-center text-sm text-slate-500">
            {statusMessage}
          </div>
        )}
      </div>
    </section>
  );
};
