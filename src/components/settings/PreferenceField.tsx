import type { PropsWithChildren, ReactNode } from "react";

export const PreferenceField = ({
  label,
  description,
  hint,
  error,
  multiline = false,
  layoutClassName,
  controlClassName,
  children
}: PropsWithChildren<{
  label: string;
  description?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  multiline?: boolean;
  layoutClassName?: string;
  controlClassName?: string;
}>) => (
  <label
    className={`grid gap-3 px-1 ${multiline ? "" : layoutClassName ?? "grid-cols-[112px_minmax(0,1fr)] items-center gap-x-4"}`}
  >
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3">
        <div className="whitespace-nowrap text-[15px] font-semibold leading-6 text-slate-900">{label}</div>
        {hint ? <div className="text-xs font-medium text-sky-700">{hint}</div> : null}
      </div>
      {description ? <div className="mt-1 text-xs text-slate-500">{description}</div> : null}
      {error ? <div className="mt-2 text-xs font-medium text-rose-700">{error}</div> : null}
    </div>
    <div
      className={`min-w-0 ${multiline ? "" : "justify-self-end w-full max-w-[212px]"} ${controlClassName ?? ""}`.trim()}
    >
      {children}
    </div>
  </label>
);
