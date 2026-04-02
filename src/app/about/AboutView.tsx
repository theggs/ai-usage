import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { open } from "@tauri-apps/plugin-shell";
import auditData from "../../generated/license-audit.json";
import appIcon from "../../assets/icons/app-icon.png";
import tauriConfig from "../../../src-tauri/tauri.conf.json";
import { getCopy } from "../shared/i18n";
import { useAppState } from "../shared/appState";

const GITHUB_URL = "https://github.com/theggs/ai-usage";
const APP_LICENSE = "Apache 2.0";

type LicenseAudit = {
  totalPackages: number;
  copyleftCount: number;
  unknownLicenseCount: number;
};

type AppMetadata = {
  productName: string;
  identifier: string;
};

const formatCopy = (
  template: string,
  replacements: Record<string, number | string>
): string => Object.entries(replacements).reduce(
  (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
  template
);

export const AboutView = () => {
  const { preferences } = useAppState();
  const [version, setVersion] = useState<string | null>(null);
  const [versionFailed, setVersionFailed] = useState(false);
  const copy = getCopy(preferences?.language ?? "zh-CN");
  const audit = auditData as LicenseAudit;
  const { productName, identifier } = tauriConfig as AppMetadata;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const nextVersion = await getVersion();
        if (!cancelled) {
          setVersion(nextVersion);
          setVersionFailed(false);
        }
      } catch {
        if (!cancelled) {
          setVersionFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenGitHub = () => {
    void open(GITHUB_URL);
  };

  const dependencyText = (() => {
    if (audit.copyleftCount > 0 && audit.unknownLicenseCount > 0) {
      return formatCopy(copy.aboutDepsMixedRisk, {
        count: audit.totalPackages,
        copyleft: audit.copyleftCount,
        unknown: audit.unknownLicenseCount
      });
    }

    if (audit.copyleftCount > 0) {
      return formatCopy(copy.aboutDepsCopyleftFound, {
        count: audit.totalPackages,
        copyleft: audit.copyleftCount
      });
    }

    if (audit.unknownLicenseCount > 0) {
      return formatCopy(copy.aboutDepsUnknownFound, {
        count: audit.totalPackages,
        unknown: audit.unknownLicenseCount
      });
    }

    return formatCopy(copy.aboutDepsAllPermissive, {
      count: audit.totalPackages
    });
  })();

  const versionText = version
    ? `v${version}`
    : versionFailed
      ? copy.aboutVersionUnavailable
      : null;
  const buildInfo = `${productName} · ${identifier}`;
  const hasAuditRisk = audit.unknownLicenseCount > 0;

  return (
    <section className="pb-4">
      <div className="flex flex-col items-center px-4 pb-8 pt-12 text-center">
        <img
          src={appIcon}
          alt={productName}
          className="h-16 w-16 rounded-xl"
        />
        <h1 className="mt-6 text-xl font-semibold text-slate-900">
          {productName}
        </h1>
        {versionText ? (
          <span className="mt-1 text-[13px] text-slate-500">
            {versionText}
          </span>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.2)]">
        <div className="divide-y divide-slate-100">
          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <span className="text-[13px] font-semibold text-slate-700">
              {copy.aboutLicenseLabel}
            </span>
            <span className="text-[13px] text-slate-500">
              {APP_LICENSE}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <span className="text-[13px] font-semibold text-slate-700">
              {copy.aboutBuildInfoLabel}
            </span>
            <span className="max-w-[60%] text-right text-[13px] text-slate-500">
              {buildInfo}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <span className="text-[13px] font-semibold text-slate-700">
              {copy.aboutGitHubLabel}
            </span>
            <button
              onClick={handleOpenGitHub}
              className="max-w-[60%] truncate text-[13px] text-blue-600 transition-colors hover:cursor-pointer hover:text-blue-700 hover:underline"
              type="button"
            >
              {GITHUB_URL}
            </button>
          </div>

          <div className="flex items-start justify-between gap-4 px-5 py-3.5">
            <span className="pt-0.5 text-[13px] font-semibold text-slate-700">
              {copy.aboutDependenciesLabel}
            </span>
            <div className="flex max-w-[60%] flex-wrap items-center justify-end gap-2">
              <span className={`text-right text-[13px] ${hasAuditRisk ? "text-amber-700" : "text-slate-500"}`}>
                {dependencyText}
              </span>
              {audit.unknownLicenseCount > 0 ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  {formatCopy(copy.aboutUnknownBadge, { count: audit.unknownLicenseCount })}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
