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
  const { panelState, preferences, refreshPanel, openSettings, isRefreshing, error } = useAppState();
  const copy = getCopy(preferences?.language ?? "zh-CN");
  const statusMessage = getSnapshotMessage(copy, panelState?.snapshotState, true);
  const statusDetail = panelState?.statusMessage?.trim();
  const snapshotLabel = getSnapshotTag(copy, panelState?.snapshotState);
  const inlineStatus =
    panelState?.snapshotState === "fresh"
      ? ""
      : statusDetail && statusDetail !== statusMessage
        ? statusDetail
        : statusMessage;
  const statusTone =
    panelState?.snapshotState === "failed"
      ? "text-rose-600"
      : panelState?.snapshotState === "stale"
        ? "text-amber-600"
        : panelState?.snapshotState === "pending"
          ? "text-sky-600"
          : "text-slate-500";

  return (
    <section className="grid gap-4">
      <header className="flex items-center justify-end gap-2">
        <button
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
          disabled={isRefreshing}
          onClick={() => void refreshPanel()}
          type="button"
        >
          {isRefreshing ? copy.refreshing : copy.refresh}
        </button>
        <button
          className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700"
          onClick={openSettings}
          type="button"
        >
          {copy.settings}
        </button>
      </header>

      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{snapshotLabel}</div>
        <div className={`text-sm ${statusTone}`}>
          {copy.lastRefresh}: {formatPanelTime(panelState?.updatedAt)}
          {inlineStatus ? ` · ${inlineStatus}` : ""}
        </div>
      </div>

      {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid gap-3">
        {panelState?.items.length ? (
          panelState.items.map((service) => <ServiceCard key={service.serviceId} copy={copy} service={service} />)
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            {statusMessage}
          </div>
        )}
      </div>
    </section>
  );
};
