import { useEffect, useMemo, useState } from "react";
import { PreferenceField } from "../../components/settings/PreferenceField";
import { PreferenceSection } from "../../components/settings/PreferenceSection";
import type { UserPreferences } from "../../lib/tauri/contracts";
import { useAppState } from "../shared/appState";
import { getCopy, getSnapshotMessage, getSnapshotTag } from "../shared/i18n";

const clonePreferences = (preferences: UserPreferences): UserPreferences => ({ ...preferences });

export const SettingsView = () => {
  const {
    preferences,
    savePreferences,
    closeSettings,
    sendTestNotification,
    setAutostart,
    panelState,
    isRefreshing,
    error
  } = useAppState();
  const base = preferences!;
  const [draft, setDraft] = useState<UserPreferences>(() => clonePreferences(base));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [notificationState, setNotificationState] = useState<"idle" | "pending" | "sent" | "blocked" | "failed">("idle");
  const copy = getCopy(base.language);
  const activeSessionMessage = getSnapshotMessage(copy, panelState?.snapshotState, true);
  const activeSessionDetail = panelState?.statusMessage?.trim();
  const snapshotTag = getSnapshotTag(copy, panelState?.snapshotState);

  useEffect(() => {
    setDraft(clonePreferences(base));
  }, [base]);

  const notificationText = useMemo(() => {
    if (notificationState === "idle") return null;
    if (notificationState === "pending") return copy.refreshing;
    return copy[notificationState];
  }, [copy, notificationState]);

  return (
    <section className="grid gap-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">{copy.settings}</h2>
          <p className="mt-1 text-sm text-slate-500">{copy.demoConfiguration}</p>
        </div>
        <button
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          onClick={closeSettings}
          type="button"
        >
          {copy.back}
        </button>
      </header>

      <PreferenceSection title={copy.preferences}>
        <PreferenceField label={copy.language}>
          <select
            aria-label={copy.language}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            value={draft.language}
            onChange={(event) =>
              setDraft((current) => ({ ...current, language: event.target.value as UserPreferences["language"] }))
            }
          >
            <option value="zh-CN">中文</option>
            <option value="en-US">English</option>
          </select>
        </PreferenceField>

        <PreferenceField label={copy.refreshInterval} description={copy.refreshIntervalHint}>
          <input
            aria-label={copy.refreshInterval}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            min={5}
            step={5}
            type="number"
            value={draft.refreshIntervalMinutes}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                refreshIntervalMinutes: Number(event.target.value)
              }))
            }
          />
        </PreferenceField>

        <PreferenceField label={copy.traySummaryMode}>
          <select
            aria-label={copy.traySummaryMode}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            value={draft.traySummaryMode}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                traySummaryMode: event.target.value as UserPreferences["traySummaryMode"]
              }))
            }
          >
            <option value="lowest-remaining">{copy.traySummaryLowest}</option>
            <option value="window-5h">{copy.traySummary5h}</option>
            <option value="window-week">{copy.traySummaryWeek}</option>
            <option value="multi-dimension">{copy.traySummaryMulti}</option>
            <option value="icon-only">{copy.traySummaryIconOnly}</option>
          </select>
        </PreferenceField>

        <PreferenceField label={copy.autostart}>
          <button
            aria-checked={draft.autostartEnabled}
            className={`inline-flex w-14 items-center rounded-full p-1 transition-colors ${
              draft.autostartEnabled ? "bg-emerald-500" : "bg-slate-300"
            }`}
            onClick={async () => {
              const next = !draft.autostartEnabled;
              setDraft((current) => ({ ...current, autostartEnabled: next }));
              const updated = await setAutostart(next);
              if (updated) {
                setDraft(updated);
              } else {
                setDraft((current) => ({ ...current, autostartEnabled: base.autostartEnabled }));
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

        <PreferenceField label={copy.menubarService}>
          <select
            aria-label={copy.menubarService}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2"
            value={draft.menubarService}
            onChange={(event) =>
              setDraft((current) => ({ ...current, menubarService: event.target.value }))
            }
          >
            <option value="codex">{copy.codexLabel}</option>
            <option value="claude-code">{copy.claudeCodeLabel}</option>
          </select>
        </PreferenceField>

        <PreferenceField label={copy.serviceOrder}>
          <div className="grid gap-1">
            {draft.serviceOrder.map((serviceId, index) => {
              const label = serviceId === "claude-code" ? copy.claudeCodeLabel : copy.codexLabel;
              return (
                <div key={serviceId} className="flex items-center gap-2">
                  <span className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                    {label}
                  </span>
                  <button
                    aria-label="Move up"
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 disabled:opacity-30"
                    disabled={index === 0}
                    onClick={() =>
                      setDraft((current) => {
                        const next = [...current.serviceOrder];
                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        return { ...current, serviceOrder: next };
                      })
                    }
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label="Move down"
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 disabled:opacity-30"
                    disabled={index === draft.serviceOrder.length - 1}
                    onClick={() =>
                      setDraft((current) => {
                        const next = [...current.serviceOrder];
                        [next[index], next[index + 1]] = [next[index + 1], next[index]];
                        return { ...current, serviceOrder: next };
                      })
                    }
                    type="button"
                  >
                    ↓
                  </button>
                </div>
              );
            })}
          </div>
        </PreferenceField>
      </PreferenceSection>

      <PreferenceSection title={copy.actions}>
        <button
          className="rounded-xl bg-emerald-950 px-4 py-3 text-sm font-semibold text-white"
          onClick={async () => {
            setSaveState("saving");
            const updated = await savePreferences(draft);
            if (updated) {
              setDraft(updated);
            }
            setSaveState("saved");
          }}
          type="button"
        >
          {saveState === "saving" ? copy.saving : saveState === "saved" ? copy.savedInline : copy.savePreferences}
        </button>
        {saveState === "saved" ? (
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{copy.saved}</div>
        ) : null}
      </PreferenceSection>

      <PreferenceSection title={copy.notificationActions}>
        <button
          className="rounded-xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950"
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
          <div className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-700">{notificationText}</div>
        ) : null}
      </PreferenceSection>

      <PreferenceSection title={copy.codexCli} description={copy.codexCliHint}>

        <PreferenceField
          label={copy.activeSession}
          description={activeSessionMessage}
          hint={snapshotTag}
        >
          <div className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <div>{panelState?.activeSession?.sessionLabel ?? copy.noActiveSession}</div>
            {activeSessionDetail && activeSessionDetail !== activeSessionMessage ? (
              <div className="mt-2 text-xs text-sky-700">{activeSessionDetail}</div>
            ) : null}
          </div>
        </PreferenceField>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
          <div className="font-semibold text-slate-900">{copy.dataSource}</div>
          <div className="mt-1">{panelState?.activeSession?.source ?? copy.localCodexCli}</div>
          <div className="mt-3 font-semibold text-slate-900">{copy.setupHintTitle}</div>
          <p className="mt-1 text-slate-600">{copy.setupHintBody}</p>
        </div>
      </PreferenceSection>

      {isRefreshing ? <div className="text-xs text-slate-500">{copy.refreshing}</div> : null}
      {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
    </section>
  );
};
