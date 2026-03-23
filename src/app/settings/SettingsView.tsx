import { useEffect, useMemo, useRef, useState } from "react";
import { PreferenceField } from "../../components/settings/PreferenceField";
import { PreferenceSection } from "../../components/settings/PreferenceSection";
import type { UserPreferences } from "../../lib/tauri/contracts";
import { useAppState } from "../shared/appState";
import { getCopy, getSnapshotMessage, getSnapshotTag } from "../shared/i18n";

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

export const SettingsView = () => {
  const {
    preferences,
    savePreferences,
    sendTestNotification,
    setAutostart,
    panelState,
    isRefreshing,
    error
  } = useAppState();
  const base = preferences!;
  const [draft, setDraft] = useState<UserPreferences>(() => clonePreferences(base));
  const [proxyDraft, setProxyDraft] = useState(() => ({
    networkProxyMode: base.networkProxyMode,
    networkProxyUrl: base.networkProxyUrl
  }));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [notificationState, setNotificationState] = useState<"idle" | "pending" | "sent" | "blocked" | "failed">("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [draggedServiceId, setDraggedServiceId] = useState<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const copy = getCopy(draft.language);
  const activeSessionMessage = getSnapshotMessage(copy, panelState?.snapshotState, true);
  const activeSessionDetail = panelState?.statusMessage?.trim();
  const snapshotTag = getSnapshotTag(copy, panelState?.snapshotState);

  useEffect(() => {
    setDraft(clonePreferences(base));
    setProxyDraft({
      networkProxyMode: base.networkProxyMode,
      networkProxyUrl: base.networkProxyUrl
    });
  }, [base]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    },
    []
  );

  const flashSaved = () => {
    setSaveState("saved");
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => setSaveState("idle"), 1200);
  };

  const applyImmediatePatch = async (patch: Partial<UserPreferences>) => {
    const previous = draft;
    const optimistic = { ...draft, ...patch };
    setDraft(optimistic);
    setSaveState("saving");
    const updated = await savePreferences(patch);
    if (updated) {
      setDraft(clonePreferences(updated));
      flashSaved();
      return;
    }
    setDraft(previous);
    setSaveState("failed");
  };

  const notificationText = useMemo(() => {
    if (notificationState === "idle") return null;
    if (notificationState === "pending") return copy.refreshing;
    return copy[notificationState];
  }, [copy, notificationState]);

  const serviceOptions = draft.serviceOrder.map((serviceId) => ({
    id: serviceId,
    label: serviceId === "claude-code" ? copy.claudeCodeLabel : copy.codexLabel
  }));
  const serviceOrderDisabled = serviceOptions.length < 2;

  return (
    <section className="grid gap-4 pb-4">
      <PreferenceSection title={copy.generalSection}>
        <PreferenceField label={copy.language}>
          <select
            aria-label={copy.language}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            value={draft.language}
            onChange={(event) => void applyImmediatePatch({ language: event.target.value as UserPreferences["language"] })}
          >
            <option value="zh-CN">中文</option>
            <option value="en-US">English</option>
          </select>
        </PreferenceField>

        <PreferenceField label={copy.autostart} hint={saveState === "saved" ? copy.savedInline : undefined}>
          <button
            aria-checked={draft.autostartEnabled}
            className={`inline-flex w-14 items-center rounded-full p-1 transition-colors ${
              draft.autostartEnabled ? "bg-emerald-500" : "bg-slate-300"
            }`}
            onClick={async () => {
              const previous = draft.autostartEnabled;
              const next = !previous;
              setDraft((current) => ({ ...current, autostartEnabled: next }));
              setSaveState("saving");
              const updated = await setAutostart(next);
              if (updated) {
                setDraft(clonePreferences(updated));
                flashSaved();
              } else {
                setDraft((current) => ({ ...current, autostartEnabled: previous }));
                setSaveState("failed");
              }
            }}
            role="switch"
            type="button"
          >
            <span
              className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                draft.autostartEnabled ? "translate-x-7" : "translate-x-0"
              }`}
            />
          </button>
        </PreferenceField>

        <PreferenceField label={copy.refreshInterval} description={copy.refreshIntervalHint}>
          <input
            aria-label={copy.refreshInterval}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            min={5}
            step={5}
            type="number"
            value={draft.refreshIntervalMinutes}
            onChange={(event) => void applyImmediatePatch({ refreshIntervalMinutes: Number(event.target.value) })}
          />
        </PreferenceField>
      </PreferenceSection>

      <PreferenceSection title={copy.displaySection}>
        <PreferenceField label={copy.traySummaryMode}>
          <select
            aria-label={copy.traySummaryMode}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            value={draft.traySummaryMode}
            onChange={(event) =>
              void applyImmediatePatch({
                traySummaryMode: event.target.value as UserPreferences["traySummaryMode"]
              })
            }
          >
            <option value="lowest-remaining">{copy.traySummaryLowest}</option>
            <option value="window-5h">{copy.traySummary5h}</option>
            <option value="window-week">{copy.traySummaryWeek}</option>
            <option value="multi-dimension">{copy.traySummaryMulti}</option>
            <option value="icon-only">{copy.traySummaryIconOnly}</option>
          </select>
        </PreferenceField>

        <PreferenceField label={copy.menubarService}>
          <select
            aria-label={copy.menubarService}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            value={draft.menubarService}
            onChange={(event) => void applyImmediatePatch({ menubarService: event.target.value })}
          >
            <option value="codex">{copy.codexLabel}</option>
            <option value="claude-code">{copy.claudeCodeLabel}</option>
          </select>
        </PreferenceField>

        <PreferenceField label={copy.serviceOrder} description={serviceOrderDisabled ? copy.noData : undefined}>
          <div className="grid gap-2">
            {serviceOptions.map((service) => (
              <div
                key={service.id}
                aria-label={service.label}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 transition-shadow hover:shadow-sm"
                data-dragging={draggedServiceId === service.id}
                draggable={!serviceOrderDisabled}
                onDragOver={(event) => event.preventDefault()}
                onDragStart={() => setDraggedServiceId(service.id)}
                onDrop={async () => {
                  if (!draggedServiceId || draggedServiceId === service.id) return;
                  const nextOrder = reorder(draft.serviceOrder, draggedServiceId, service.id);
                  setDraggedServiceId(null);
                  await applyImmediatePatch({ serviceOrder: nextOrder });
                }}
                onDragEnd={() => setDraggedServiceId(null)}
              >
                <span
                  aria-hidden="true"
                  className={`text-lg leading-none ${serviceOrderDisabled ? "text-slate-300" : "text-slate-400"}`}
                >
                  ⋮⋮
                </span>
                <span className="flex-1 font-medium">{service.label}</span>
              </div>
            ))}
          </div>
        </PreferenceField>
      </PreferenceSection>

      <PreferenceSection title={copy.connectionSection}>
        <PreferenceField label={copy.networkProxy} description={copy.networkProxyUrlHint}>
          <div className="grid gap-3">
            <select
              aria-label={copy.networkProxyMode}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2"
              value={proxyDraft.networkProxyMode}
              onChange={(event) => {
                setValidationError(null);
                setProxyDraft((current) => ({
                  ...current,
                  networkProxyMode: event.target.value as UserPreferences["networkProxyMode"]
                }));
              }}
            >
              <option value="system">{copy.networkProxyModeSystem}</option>
              <option value="manual">{copy.networkProxyModeManual}</option>
              <option value="off">{copy.networkProxyModeOff}</option>
            </select>

            {proxyDraft.networkProxyMode === "manual" ? (
              <input
                aria-label={copy.networkProxyUrl}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                placeholder="http://127.0.0.1:7890"
                type="text"
                value={proxyDraft.networkProxyUrl}
                onChange={(event) => {
                  setValidationError(null);
                  setProxyDraft((current) => ({
                    ...current,
                    networkProxyUrl: event.target.value
                  }));
                }}
              />
            ) : null}

            <button
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900"
              onClick={async () => {
                if (
                  proxyDraft.networkProxyMode === "manual" &&
                  !isValidManualProxyUrl(proxyDraft.networkProxyUrl.trim())
                ) {
                  setValidationError(copy.networkProxyUrlInvalid);
                  return;
                }
                setValidationError(null);
                setSaveState("saving");
                const updated = await savePreferences(proxyDraft);
                if (updated) {
                  setDraft(clonePreferences(updated));
                  setProxyDraft({
                    networkProxyMode: updated.networkProxyMode,
                    networkProxyUrl: updated.networkProxyUrl
                  });
                  flashSaved();
                } else {
                  setSaveState("failed");
                }
              }}
              type="button"
            >
              {copy.applyProxy}
            </button>
          </div>
        </PreferenceField>

        {validationError ? (
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">{validationError}</div>
        ) : null}
      </PreferenceSection>

      <PreferenceSection title={copy.statusSection} description={copy.codexCliHint}>
        <PreferenceField
          label={copy.activeSession}
          description={activeSessionMessage}
          hint={snapshotTag}
        >
          <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <div>{panelState?.activeSession?.sessionLabel ?? copy.noActiveSession}</div>
            {activeSessionDetail && activeSessionDetail !== activeSessionMessage ? (
              <div className="mt-2 text-xs text-sky-700">{activeSessionDetail}</div>
            ) : null}
          </div>
        </PreferenceField>

        <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-4 text-sm text-slate-700">
          <div className="font-semibold text-slate-900">{copy.dataSource}</div>
          <div className="mt-1">{panelState?.activeSession?.source ?? copy.localCodexCli}</div>
          <div className="mt-3 font-semibold text-slate-900">{copy.setupHintTitle}</div>
          <p className="mt-1 text-slate-600">{copy.setupHintBody}</p>
        </div>

        <button
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"
          onClick={async () => {
            setNotificationState("pending");
            const result = await sendTestNotification();
            setNotificationState(result?.result ?? "failed");
          }}
          type="button"
        >
          {copy.notificationTest}
        </button>
        {notificationText ? (
          <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{notificationText}</div>
        ) : null}
      </PreferenceSection>

      {saveState === "saved" ? (
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{copy.saved}</div>
      ) : null}
      {saveState === "failed" ? (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error ?? copy.failed}</div>
      ) : null}
      {isRefreshing ? <div className="text-xs text-slate-500">{copy.refreshing}</div> : null}
      {error && saveState !== "failed" ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
    </section>
  );
};
