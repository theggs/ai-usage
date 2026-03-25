import { useEffect } from "react";
import { ServiceCard } from "../../components/panel/ServiceCard";
import { useAppState } from "../shared/appState";
import { getCopy, getServicePlaceholderCopy, getSnapshotMessage } from "../shared/i18n";
import { getVisibleServiceScope } from "../../lib/tauri/summary";

export const PanelView = () => {
  const {
    panelState,
    claudeCodePanelState,
    preferences,
    error,
    openSettings,
    savePreferences,
    isClaudeCodeRefreshing
  } = useAppState();
  const copy = getCopy(preferences?.language ?? "zh-CN");
  const visibleServiceScope = getVisibleServiceScope(preferences);
  const serviceOrder = visibleServiceScope.visiblePanelServiceOrder;
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
  const showClaudeCodeDisclosure = showOnboarding && !preferences?.claudeCodeDisclosureDismissedAt;

  useEffect(() => {
    if (!showClaudeCodeDisclosure || !preferences) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === "F8" || event.key.toLowerCase() === "d") {
        event.preventDefault();
        void savePreferences({ claudeCodeDisclosureDismissedAt: new Date().toISOString() });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [preferences, savePreferences, showClaudeCodeDisclosure]);

  return (
    <section className="grid gap-4 pb-5">
      {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {showOnboarding ? (
        <div className="rounded-[28px] border border-slate-200/90 bg-white px-5 py-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.28)]">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-balance text-slate-950">
            {copy.onboardingTitle}
          </h2>
          <div className="mt-3 grid gap-2.5 text-sm leading-6 text-slate-600">
            <div>{copy.onboardingStepConnect}</div>
            <div>{copy.onboardingStepChoose}</div>
            <div>{copy.onboardingStepRefresh}</div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
              onClick={openSettings}
              type="button"
            >
              {copy.goToSettings}
            </button>
            <button
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              onClick={() => void savePreferences({ onboardingDismissedAt: new Date().toISOString() })}
              type="button"
            >
              {copy.skipGuide}
            </button>
          </div>
        </div>
      ) : null}

      {showClaudeCodeDisclosure ? (
        <div className="rounded-[28px] border border-sky-200/80 bg-linear-to-br from-sky-50/90 via-white to-slate-50 px-5 py-5 shadow-[0_20px_44px_-30px_rgba(14,116,144,0.32)]">
          <div className="inline-flex items-center rounded-full border border-sky-200/80 bg-white/80 px-3 py-1 text-[12px] font-semibold text-sky-700">
            {copy.claudeCodeUsageEyebrow}
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600 whitespace-pre-line">
            {copy.claudeCodeUsageDisclosureBody}
          </p>
          <div className="mt-4 flex">
            <button
              className="rounded-full border border-white/90 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-white"
              onClick={() =>
                void savePreferences({ claudeCodeDisclosureDismissedAt: new Date().toISOString() })
              }
              type="button"
            >
              {copy.claudeCodeUsageDisclosureButton}
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
              />
            ));
          }
          if (showOnboarding) {
            return null;
          }
          if (serviceId === "claude-code" && isClaudeCodeRefreshing) {
            return (
              <div
                key={`${serviceId}-refreshing`}
                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-6 text-left text-sm text-slate-500"
              >
                <div className="font-semibold text-slate-900">{copy.claudeCodeUsageRefreshingTitle}</div>
                <p className="mt-2">{copy.claudeCodeUsageRefreshingBody}</p>
              </div>
            );
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
    </section>
  );
};
