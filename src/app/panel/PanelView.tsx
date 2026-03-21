import { ServiceCard } from "../../components/panel/ServiceCard";
import { useAppState } from "../shared/appState";
import { getClaudeCodePlaceholderMessage, getCopy, getSnapshotMessage } from "../shared/i18n";

export const PanelView = () => {
  const { panelState, claudeCodePanelState, preferences, error } = useAppState();
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
              ? getClaudeCodePlaceholderMessage(copy, state.snapshotState, state.statusMessage)
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
