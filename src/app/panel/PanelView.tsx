import { ServiceCard } from "../../components/panel/ServiceCard";
import { useAppState } from "../shared/appState";
import {
  formatRelativeTime,
  getCopy,
  getServicePlaceholderCopy,
  getSnapshotMessage
} from "../shared/i18n";
import { getSharedRefreshTimestamp, haveAlignedRefreshTimes } from "../../lib/tauri/summary";

export const PanelView = () => {
  const { panelState, claudeCodePanelState, preferences, error, openSettings, savePreferences } = useAppState();
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
  const showOnboarding = !hasAnyItems && !preferences?.onboardingDismissedAt;
  const showGlobalRefresh = hasAnyItems && haveAlignedRefreshTimes(allItems);
  const sharedRefreshTimestamp = showGlobalRefresh ? getSharedRefreshTimestamp(allItems) : undefined;

  return (
    <section className="grid gap-4 pb-5">
      {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {showOnboarding ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">{copy.onboardingTitle}</h2>
          <div className="mt-3 grid gap-2 text-sm text-slate-600">
            <div>{copy.onboardingStepConnect}</div>
            <div>{copy.onboardingStepChoose}</div>
            <div>{copy.onboardingStepRefresh}</div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              onClick={openSettings}
              type="button"
            >
              {copy.goToSettings}
            </button>
            <button
              className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600"
              onClick={() => void savePreferences({ onboardingDismissedAt: new Date().toISOString() })}
              type="button"
            >
              {copy.skipGuide}
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3">
        {serviceOrder.map((serviceId) => {
          const state = stateByServiceId[serviceId];
          if (!state) return null;
          if (state.items.length > 0) {
            return state.items.map((service) => (
              <ServiceCard
                key={service.serviceId}
                copy={copy}
                service={service}
                showLastRefreshed={!showGlobalRefresh}
              />
            ));
          }
          const placeholder = getServicePlaceholderCopy(copy, serviceId, state.snapshotState, state.statusMessage);
          return (
            <div
              key={`${serviceId}-not-connected`}
              className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-left text-sm text-slate-500"
            >
              <div className="font-semibold text-slate-900">{placeholder.title}</div>
              <p className="mt-2">{placeholder.body || statusMessage}</p>
              <button
                className="mt-4 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"
                onClick={openSettings}
                type="button"
              >
                {copy.goToSettings}
              </button>
            </div>
          );
        })}
        {!hasAnyItems && serviceOrder.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            {statusMessage}
          </div>
        )}
      </div>
      {sharedRefreshTimestamp !== undefined ? (
        <div
          className="rounded-2xl border border-slate-200 px-4 py-3 text-xs text-slate-500"
          title={new Date(sharedRefreshTimestamp).toLocaleString()}
        >
          {copy.lastRefresh}: {formatRelativeTime(copy, new Date(sharedRefreshTimestamp).toISOString())}
        </div>
      ) : null}
    </section>
  );
};
