import { ServiceCard } from "../../components/panel/ServiceCard";
import { useAppState } from "../shared/appState";
import { getCopy, getSnapshotMessage } from "../shared/i18n";

const RefreshIcon = () => (
  <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
    <path
      d="M20 5v5h-5M4 19v-5h5M6.9 9A7 7 0 0 1 18 6.2L20 10M4 14l2 3.8A7 7 0 0 0 17.1 15"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

const SettingsIcon = () => (
  <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
    <path
      d="M12 8.75a3.25 3.25 0 1 1 0 6.5 3.25 3.25 0 0 1 0-6.5Z"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path
      d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.5 1.5 0 0 1 0 2.1l-.9.9a1.5 1.5 0 0 1-2.1 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9v.2A1.5 1.5 0 0 1 13.4 22h-1.3a1.5 1.5 0 0 1-1.5-1.5v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.5 1.5 0 0 1-2.1 0l-.9-.9a1.5 1.5 0 0 1 0-2.1l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6h-.2A1.5 1.5 0 0 1 2 13.4v-1.3a1.5 1.5 0 0 1 1.5-1.5h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.5 1.5 0 0 1 0-2.1l.9-.9a1.5 1.5 0 0 1 2.1 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9v-.2A1.5 1.5 0 0 1 10.6 2h1.3a1.5 1.5 0 0 1 1.5 1.5v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2A1.5 1.5 0 0 1 22 10.6v1.3a1.5 1.5 0 0 1-1.5 1.5h-.2a1 1 0 0 0-.9.6Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
    />
  </svg>
);

export const PanelView = () => {
  const { panelState, claudeCodePanelState, preferences, refreshPanel, openSettings, isRefreshing, error } = useAppState();
  const copy = getCopy(preferences?.language ?? "zh-CN");
  const serviceOrder = preferences?.serviceOrder ?? ["codex", "claude-code"];
  const statusMessage = getSnapshotMessage(copy, panelState?.snapshotState, true);

  const stateByServiceId: Record<string, typeof panelState> = {
    codex: panelState,
    "claude-code": claudeCodePanelState
  };

  const allItems = serviceOrder.flatMap((serviceId) => {
    const state = stateByServiceId[serviceId];
    if (!state) return [];
    return state.items;
  });

  const hasAnyItems = allItems.length > 0;

  return (
    <section className="grid gap-4">
      <header className="flex items-center justify-end gap-1.5">
        <button
          aria-label={isRefreshing ? copy.refreshing : copy.refresh}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isRefreshing}
          onClick={() => void refreshPanel()}
          title={isRefreshing ? copy.refreshing : copy.refresh}
          type="button"
        >
          <RefreshIcon />
        </button>
        <button
          aria-label={copy.settings}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700 transition-colors hover:border-emerald-300 hover:text-emerald-800"
          onClick={openSettings}
          title={copy.settings}
          type="button"
        >
          <SettingsIcon />
        </button>
      </header>

      {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid gap-3">
        {serviceOrder.map((serviceId) => {
          const state = stateByServiceId[serviceId];
          if (!state) return null;
          if (state.items.length > 0) {
            return state.items.map((service) => (
              <ServiceCard key={service.serviceId} copy={copy} service={service} />
            ));
          }
          // Not connected placeholder
          const notConnectedMessage =
            serviceId === "claude-code"
              ? copy.claudeCodeNotConnected
              : statusMessage;
          return (
            <div
              key={`${serviceId}-not-connected`}
              className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500"
            >
              {notConnectedMessage}
            </div>
          );
        })}
        {!hasAnyItems && serviceOrder.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            {statusMessage}
          </div>
        )}
      </div>
    </section>
  );
};
