import { useMemo, useState } from "react";
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
    notificationResult,
    error
  } = useAppState();
  const base = preferences!;
  const [draft, setDraft] = useState<UserPreferences>(() => clonePreferences(base));
  const [saved, setSaved] = useState(false);
  const copy = getCopy(base.language);
  const activeSessionMessage = getSnapshotMessage(copy, panelState?.snapshotState, true);
  const activeSessionDetail = panelState?.statusMessage?.trim();
  const snapshotTag = getSnapshotTag(copy, panelState?.snapshotState);

  const notificationText = useMemo(() => {
    if (!notificationResult) return null;
    return copy[notificationResult.result];
  }, [copy, notificationResult]);

  return (
    <section className="grid gap-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">{copy.settings}</h2>
          <p className="mt-1 text-sm text-slate-500">{copy.demoConfiguration}</p>
        </div>
        <button
          className="rounded-full border border-slate-300 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700"
          onClick={closeSettings}
          type="button"
        >
          {copy.back}
        </button>
      </header>

      <PreferenceSection title="Preferences">
        <PreferenceField label="Language">
          <select
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2"
            value={draft.language}
            onChange={(event) =>
              setDraft((current) => ({ ...current, language: event.target.value as UserPreferences["language"] }))
            }
          >
            <option value="zh-CN">中文</option>
            <option value="en-US">English</option>
          </select>
        </PreferenceField>

        <PreferenceField label="Refresh interval" description="Minimum 5 minutes">
          <input
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2"
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
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2"
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

        <PreferenceField label="Autostart">
          <input
            checked={draft.autostartEnabled}
            type="checkbox"
            onChange={async (event) => {
              const next = event.target.checked;
              setDraft((current) => ({ ...current, autostartEnabled: next }));
              await setAutostart(next);
            }}
          />
        </PreferenceField>
      </PreferenceSection>

      <PreferenceSection title="Actions">
        <button
          className="rounded-2xl bg-emerald-950 px-4 py-3 text-sm font-semibold text-white"
          onClick={async () => {
            await savePreferences(draft);
            setSaved(true);
          }}
          type="button"
        >
          {copy.save}
        </button>

        <button
          className="rounded-2xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950"
          onClick={() => void sendTestNotification()}
          type="button"
        >
          {copy.notificationTest}
        </button>
      </PreferenceSection>

      <PreferenceSection title={copy.codexCli} description={copy.codexCliHint}>

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

        <div className="rounded-2xl bg-white/80 px-4 py-4 text-sm text-slate-700 shadow-sm shadow-emerald-950/5">
          <div className="font-semibold text-slate-900">{copy.dataSource}</div>
          <div className="mt-1">{panelState?.activeSession?.source ?? copy.localCodexCli}</div>
          <div className="mt-3 font-semibold text-slate-900">{copy.setupHintTitle}</div>
          <p className="mt-1 text-slate-600">{copy.setupHintBody}</p>
        </div>
      </PreferenceSection>

      {saved ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{copy.saved}</div> : null}
      {notificationText ? <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">{notificationText}</div> : null}
      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
    </section>
  );
};
