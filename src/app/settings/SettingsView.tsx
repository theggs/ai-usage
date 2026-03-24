import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { PreferenceField } from "../../components/settings/PreferenceField";
import type { UserPreferences } from "../../lib/tauri/contracts";
import { getVisibleServiceScope } from "../../lib/tauri/summary";
import { useAppState } from "../shared/appState";
import { getCopy } from "../shared/i18n";

const clonePreferences = (preferences: UserPreferences): UserPreferences => ({ ...preferences });

const isValidManualProxyUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return ["http:", "https:", "socks5:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const reorder = (items: string[], draggedId: string, targetId: string) => {
  if (draggedId === targetId) return items;
  const next = [...items];
  const fromIndex = next.indexOf(draggedId);
  const toIndex = next.indexOf(targetId);
  if (fromIndex === -1 || toIndex === -1) return items;
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, draggedId);
  return next;
};

const selectClassName =
  "w-full rounded-xl border border-slate-200/90 bg-slate-50/70 px-3.5 py-2.5 text-[15px] font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white";

const inputClassName =
  "w-full rounded-xl border border-slate-200/90 bg-slate-50/70 px-3.5 py-2.5 text-[15px] font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300 focus:bg-white";

const refreshIntervalOptions = [5, 10, 15, 30] as const;
const resolvePointerCoordinate = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) ? value : fallback;

type ProxyDraftState = Pick<UserPreferences, "networkProxyMode" | "networkProxyUrl">;
type DragOverlayState = {
  originLeft: number;
  originTop: number;
  startPointerX: number;
  startPointerY: number;
  currentPointerX: number;
  currentPointerY: number;
  width: number;
  height: number;
};
const rowClassName = "px-5 py-3.5";

export const SettingsView = () => {
  const { preferences, savePreferences, setAutostart, isRefreshing, isE2EMode, error } = useAppState();
  const base = preferences!;
  const [draft, setDraft] = useState<UserPreferences>(() => clonePreferences(base));
  const [proxyDraft, setProxyDraft] = useState<ProxyDraftState>(() => ({
    networkProxyMode: base.networkProxyMode,
    networkProxyUrl: base.networkProxyUrl
  }));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [draggedServiceId, setDraggedServiceId] = useState<string | null>(null);
  const [dragOverlay, setDragOverlay] = useState<DragOverlayState | null>(null);
  const baseRef = useRef(base);
  const draftRef = useRef(draft);
  const draggedServiceIdRef = useRef<string | null>(null);
  const dragOrderRef = useRef<string[] | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const copy = getCopy(draft.language);
  const visibleServiceScope = getVisibleServiceScope(draft);

  useEffect(() => {
    baseRef.current = base;
    setDraft(clonePreferences(base));
    draftRef.current = clonePreferences(base);
    setProxyDraft({
      networkProxyMode: base.networkProxyMode,
      networkProxyUrl: base.networkProxyUrl
    });
    draggedServiceIdRef.current = null;
    setValidationError(null);
  }, [base]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    draggedServiceIdRef.current = draggedServiceId;
  }, [draggedServiceId]);

  useEffect(
    () => () => {
      dragCleanupRef.current?.();
    },
    []
  );

  const applyImmediatePatch = async (
    patch: Partial<UserPreferences>,
    rollbackDraft: UserPreferences = draft
  ) => {
    const optimistic = { ...draft, ...patch };
    draftRef.current = optimistic;
    setDraft(optimistic);
    const updated = await savePreferences(patch);
    if (updated) {
      const nextDraft = clonePreferences(updated);
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      return updated;
    }
    draftRef.current = rollbackDraft;
    setDraft(rollbackDraft);
    return null;
  };

  const applyAutostartToggle = async () => {
    const previous = draft.autostartEnabled;
    const next = !previous;
    setDraft((current) => {
      const optimistic = { ...current, autostartEnabled: next };
      draftRef.current = optimistic;
      return optimistic;
    });
    const updated = await setAutostart(next);
    if (updated) {
      const nextDraft = clonePreferences(updated);
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      return;
    }
    setDraft((current) => {
      const rollback = { ...current, autostartEnabled: previous };
      draftRef.current = rollback;
      return rollback;
    });
  };

  const serviceOptions = visibleServiceScope.visiblePanelServiceOrder.map((serviceId) => ({
    id: serviceId,
    label: serviceId === "claude-code" ? copy.claudeCodeLabel : copy.codexLabel,
    shortLabel: serviceId === "claude-code" ? "Claude" : copy.codexLabel
  }));
  const serviceOrderDisabled = serviceOptions.length < 2;

  const previewOrder = (targetId: string) => {
    const draggedId = draggedServiceIdRef.current;
    if (!draggedId || draggedId === targetId) return;
    setDraft((current) => {
      const nextOrder = reorder(current.serviceOrder, draggedId, targetId);
      dragOrderRef.current = nextOrder;
      draftRef.current = { ...current, serviceOrder: nextOrder };
      return { ...current, serviceOrder: nextOrder };
    });
  };

  const commitOrder = async () => {
    const draggedId = draggedServiceIdRef.current;
    if (!draggedId) return;
    const nextOrder = dragOrderRef.current;
    const currentBase = baseRef.current;
    const currentDraft = draftRef.current;
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    draggedServiceIdRef.current = null;
    setDraggedServiceId(null);
    setDragOverlay(null);
    dragOrderRef.current = null;
    if (!nextOrder || nextOrder.join("|") === currentBase.serviceOrder.join("|")) {
      setDraft((current) => {
        const reset = { ...current, serviceOrder: currentBase.serviceOrder };
        draftRef.current = reset;
        return reset;
      });
      return;
    }

    await applyImmediatePatch(
      { serviceOrder: nextOrder },
      { ...currentDraft, serviceOrder: currentBase.serviceOrder }
    );
  };

  const commitProxyUrl = async () => {
    const trimmedUrl = proxyDraft.networkProxyUrl.trim();
    if (proxyDraft.networkProxyMode !== "manual") return;
    if (trimmedUrl === base.networkProxyUrl) return;
    if (!isValidManualProxyUrl(trimmedUrl)) {
      setValidationError(copy.networkProxyUrlInvalid);
      return;
    }

    setValidationError(null);
    const updated = await savePreferences({ networkProxyUrl: trimmedUrl });
    if (updated) {
      setDraft(clonePreferences(updated));
      setProxyDraft({
        networkProxyMode: updated.networkProxyMode,
        networkProxyUrl: updated.networkProxyUrl
      });
      return;
    }

    setProxyDraft({
      networkProxyMode: base.networkProxyMode,
      networkProxyUrl: base.networkProxyUrl
    });
  };

  const handleProxyModeChange = async (nextMode: UserPreferences["networkProxyMode"]) => {
    setValidationError(null);
    const previousDraft = {
      networkProxyMode: base.networkProxyMode,
      networkProxyUrl: base.networkProxyUrl
    };

    setProxyDraft((current) => ({
      ...current,
      networkProxyMode: nextMode
    }));

    const updated = await savePreferences({ networkProxyMode: nextMode });
    if (updated) {
      setDraft(clonePreferences(updated));
      setProxyDraft({
        networkProxyMode: updated.networkProxyMode,
        networkProxyUrl: updated.networkProxyUrl
      });
      return;
    }

    setProxyDraft(previousDraft);
  };

  const handleDraggedMouseMove = (clientX: number, clientY: number) => {
    setDragOverlay((current) =>
      current
        ? {
            ...current,
            currentPointerX: clientX,
            currentPointerY: clientY
          }
        : current
    );

    const hovered =
      typeof document.elementFromPoint === "function"
        ? document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-service-pill-id]")
        : null;
    const targetId = hovered?.dataset.servicePillId;
    if (targetId) {
      previewOrder(targetId);
    }
  };

  const beginMouseDrag = (
    event: ReactMouseEvent<HTMLButtonElement>,
    service: { id: string; label: string; shortLabel: string }
  ) => {
    if (serviceOrderDisabled) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const startPointerX = resolvePointerCoordinate(event.screenX, event.clientX);
    const startPointerY = resolvePointerCoordinate(event.screenY, event.clientY);

    dragCleanupRef.current?.();
    event.preventDefault();

    draggedServiceIdRef.current = service.id;
    setDraggedServiceId(service.id);
    setDragOverlay({
      originLeft: rect.left,
      originTop: rect.top,
      startPointerX,
      startPointerY,
      currentPointerX: startPointerX,
      currentPointerY: startPointerY,
      width: rect.width,
      height: rect.height
    });
    dragOrderRef.current = draft.serviceOrder;

    const handleMouseMove = (nativeEvent: MouseEvent) => {
      if (nativeEvent.buttons === 0) {
        void commitOrder();
        return;
      }
      handleDraggedMouseMove(
        resolvePointerCoordinate(nativeEvent.screenX, nativeEvent.clientX),
        resolvePointerCoordinate(nativeEvent.screenY, nativeEvent.clientY)
      );
    };

    const handleMouseUp = () => {
      void commitOrder();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("blur", handleMouseUp);

    dragCleanupRef.current = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("blur", handleMouseUp);
    };
  };

  const renderServicePill = (
    service: { id: string; label: string; shortLabel: string },
    overlay = false
  ) => (
    <button
      aria-hidden={overlay ? "true" : undefined}
      aria-label={overlay ? undefined : service.label}
      data-testid={overlay ? "service-order-drag-overlay" : undefined}
      data-service-pill-id={overlay ? undefined : service.id}
      className={`inline-flex min-h-7 shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[13px] font-medium text-slate-700 transition ${
        draggedServiceId === service.id
          ? "border-slate-300 bg-slate-100 shadow-sm"
          : "border-slate-200 bg-slate-50"
      } ${overlay ? "cursor-grabbing border-slate-300 bg-white/95 shadow-[0_12px_30px_-18px_rgba(15,23,42,0.45)]" : serviceOrderDisabled ? "cursor-default border-slate-200/70 bg-slate-50/70 text-slate-400" : "cursor-grab border-slate-200/70 bg-slate-50/70 hover:border-slate-300/80 hover:bg-slate-100/70"} ${
        draggedServiceId === service.id && !overlay ? "invisible" : ""
      }`}
      data-dragging={draggedServiceId === service.id && !overlay}
      title={service.label}
      type="button"
      {...(overlay
        ? {
            style: dragOverlay
              ? {
                  position: "fixed" as const,
                  left:
                    dragOverlay.originLeft +
                    (dragOverlay.currentPointerX - dragOverlay.startPointerX),
                  top:
                    dragOverlay.originTop +
                    (dragOverlay.currentPointerY - dragOverlay.startPointerY),
                  width: dragOverlay.width,
                  height: dragOverlay.height,
                  zIndex: 50,
                  pointerEvents: "none" as const
                }
              : undefined
          }
        : {
            onMouseDown: (event: ReactMouseEvent<HTMLButtonElement>) => {
              beginMouseDrag(event, service);
            },
            onMouseMove: (event: ReactMouseEvent<HTMLButtonElement>) => {
              if (draggedServiceId === service.id) {
                handleDraggedMouseMove(event.clientX, event.clientY);
              }
            },
            onMouseUp: () => {
              if (draggedServiceId === service.id) {
                void commitOrder();
              }
            },
            onMouseEnter: () => {
              if (draggedServiceId) {
                previewOrder(service.id);
              }
            }
          })}
    >
      <span
        aria-hidden="true"
        className={`text-[10px] leading-none ${
          overlay ? "text-slate-300/90" : serviceOrderDisabled ? "text-slate-300" : "text-slate-300/90"
        }`}
      >
        ⋮⋮
      </span>
      <span className="whitespace-nowrap">{service.shortLabel}</span>
    </button>
  );

  const draggedService = draggedServiceId
    ? serviceOptions.find((service) => service.id === draggedServiceId) ?? null
    : null;

  return (
    <section className="grid gap-3 pb-4">
      <div className="settings-surface overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.2)]">
        <div className="divide-y divide-slate-100">
          <div className={rowClassName}>
            <PreferenceField label={copy.traySummaryMode}>
              <select
                aria-label={copy.traySummaryMode}
                className={selectClassName}
                value={draft.traySummaryMode}
                onChange={(event) =>
                  void applyImmediatePatch(
                    { traySummaryMode: event.target.value as UserPreferences["traySummaryMode"] },
                    draft
                  )
                }
              >
                <option value="lowest-remaining">{copy.traySummaryLowest}</option>
                <option value="window-5h">{copy.traySummary5h}</option>
                <option value="window-week">{copy.traySummaryWeek}</option>
                <option value="multi-dimension">{copy.traySummaryMulti}</option>
                <option value="icon-only">{copy.traySummaryIconOnly}</option>
              </select>
            </PreferenceField>
          </div>

          <div className={rowClassName}>
            <PreferenceField label={copy.menubarService}>
              <select
                aria-label={copy.menubarService}
                className={selectClassName}
                value={draft.menubarService}
                onChange={(event) => void applyImmediatePatch({ menubarService: event.target.value }, draft)}
              >
                {visibleServiceScope.visibleMenubarServices.map((serviceId) => (
                  <option key={serviceId} value={serviceId}>
                    {serviceId === "claude-code" ? copy.claudeCodeLabel : copy.codexLabel}
                  </option>
                ))}
              </select>
            </PreferenceField>
          </div>

          <div className={rowClassName}>
            <PreferenceField
              label={copy.serviceOrder}
              description={serviceOrderDisabled ? copy.noData : undefined}
              layoutClassName="grid-cols-[112px_minmax(0,1fr)] items-center gap-x-2"
              controlClassName="w-full max-w-none"
            >
              <div className="flex flex-nowrap justify-end gap-1.5">
                {serviceOptions.map((service) => (
                  <div key={service.id}>{renderServicePill(service)}</div>
                ))}
              </div>
              {isE2EMode ? (
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {serviceOptions.slice(1).map((service) => (
                    <button
                      key={`e2e-${service.id}`}
                      aria-label={`E2E Move ${service.label} First`}
                      className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-[11px] text-slate-500"
                      onClick={() =>
                        void applyImmediatePatch(
                          {
                            serviceOrder: reorder(
                              draft.serviceOrder,
                              service.id,
                              draft.serviceOrder[0] ?? service.id
                            )
                          },
                          { ...draft, serviceOrder: base.serviceOrder }
                        )
                      }
                      type="button"
                    >
                      {`E2E Move ${service.label} First`}
                    </button>
                  ))}
                </div>
              ) : null}
            </PreferenceField>
          </div>

          <div className={rowClassName}>
            <PreferenceField label={copy.language}>
              <select
                aria-label={copy.language}
                className={selectClassName}
                value={draft.language}
                onChange={(event) =>
                  void applyImmediatePatch(
                    { language: event.target.value as UserPreferences["language"] },
                    draft
                  )
                }
              >
                <option value="zh-CN">中文</option>
                <option value="en-US">English</option>
              </select>
            </PreferenceField>
          </div>

          {isE2EMode ? (
            <div className={rowClassName}>
              <div className="flex justify-end">
                <button
                  aria-label="E2E Toggle Claude Code Usage"
                  className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-[11px] text-slate-500"
                  onClick={() =>
                    void applyImmediatePatch(
                      { claudeCodeUsageEnabled: !draft.claudeCodeUsageEnabled },
                      draft
                    )
                  }
                  type="button"
                >
                  E2E Toggle Claude Code Usage
                </button>
              </div>
            </div>
          ) : null}

          <div className={rowClassName}>
            <PreferenceField label={copy.autostart}>
              <div className="flex justify-end">
                <button
                  aria-checked={draft.autostartEnabled}
                  aria-label={copy.autostart}
                  className={`inline-flex w-14 items-center rounded-full p-1 transition-colors ${
                    draft.autostartEnabled ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                  onClick={() => void applyAutostartToggle()}
                  role="switch"
                  title={copy.autostart}
                  type="button"
                >
                  <span className="sr-only">{copy.autostart}</span>
                  <span
                    className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      draft.autostartEnabled ? "translate-x-7" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </PreferenceField>
          </div>

          <div className={rowClassName}>
            <PreferenceField label={copy.refreshInterval}>
              <select
                aria-label={copy.refreshInterval}
                className={selectClassName}
                value={String(draft.refreshIntervalMinutes)}
                onChange={(event) =>
                  void applyImmediatePatch(
                    { refreshIntervalMinutes: Number(event.target.value) },
                    draft
                  )
                }
              >
                {refreshIntervalOptions.map((value) => (
                  <option key={value} value={value}>
                    {`${value}${copy.minuteShort}`}
                  </option>
                ))}
              </select>
            </PreferenceField>
          </div>

          <div className={rowClassName}>
            <PreferenceField
              label={copy.networkProxy}
              description={
                proxyDraft.networkProxyMode === "manual" ? copy.networkProxyUrlHint : undefined
              }
              error={validationError}
              multiline={proxyDraft.networkProxyMode === "manual"}
              controlClassName="max-w-[320px]"
            >
              <div className="grid gap-3">
                <select
                  aria-label={copy.networkProxyMode}
                  className={selectClassName}
                  value={proxyDraft.networkProxyMode}
                  onChange={(event) =>
                    void handleProxyModeChange(
                      event.target.value as UserPreferences["networkProxyMode"]
                    )
                  }
                >
                  <option value="system">{copy.networkProxyModeSystem}</option>
                  <option value="manual">{copy.networkProxyModeManual}</option>
                  <option value="off">{copy.networkProxyModeOff}</option>
                </select>

                {proxyDraft.networkProxyMode === "manual" ? (
                  <input
                    aria-label={copy.networkProxyUrl}
                    className={inputClassName}
                    placeholder="http://127.0.0.1:7890"
                    type="text"
                    value={proxyDraft.networkProxyUrl}
                    onBlur={() => void commitProxyUrl()}
                    onChange={(event) => {
                      setValidationError(null);
                      setProxyDraft((current) => ({
                        ...current,
                        networkProxyUrl: event.target.value
                      }));
                    }}
                  />
                ) : null}
              </div>
            </PreferenceField>
          </div>

        </div>
      </div>

      <div className="settings-surface overflow-hidden rounded-2xl border border-sky-200/80 bg-linear-to-br from-sky-50/90 via-white to-slate-50 shadow-[0_18px_40px_-28px_rgba(14,116,144,0.26)]">
        <div className={rowClassName}>
          <div className="grid gap-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0 text-[15px] font-semibold leading-6 text-slate-900">
                {copy.claudeCodeUsageInfoTitle}
              </div>

              <div className="flex justify-end">
                <button
                  aria-checked={draft.claudeCodeUsageEnabled}
                  aria-label={copy.claudeCodeUsageEnabledAriaLabel}
                  className={`inline-flex w-14 items-center rounded-full p-1 shadow-sm transition-colors ${
                    draft.claudeCodeUsageEnabled ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                  onClick={() =>
                    void applyImmediatePatch(
                      { claudeCodeUsageEnabled: !draft.claudeCodeUsageEnabled },
                      draft
                    )
                  }
                  role="switch"
                  title={copy.claudeCodeUsageEnabledAriaLabel}
                  type="button"
                >
                  <span className="sr-only">{copy.claudeCodeUsageEnabledAriaLabel}</span>
                  <span
                    className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      draft.claudeCodeUsageEnabled ? "translate-x-7" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            <p className="text-[13px] leading-6 text-slate-500 whitespace-pre-line">
              {copy.claudeCodeUsageInfoBody}
            </p>
          </div>
        </div>
      </div>

      {draggedService && dragOverlay && typeof document !== "undefined"
        ? createPortal(renderServicePill(draggedService, true), document.body)
        : null}

      {isRefreshing ? <div className="text-xs text-slate-500">{copy.refreshing}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
    </section>
  );
};
