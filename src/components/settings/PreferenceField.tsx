import type { PropsWithChildren, ReactNode } from "react";

export const PreferenceField = ({
  label,
  description,
  hint,
  children
}: PropsWithChildren<{ label: string; description?: ReactNode; hint?: ReactNode }>) => (
  <label className="grid gap-3 px-1">
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        {hint ? <div className="text-xs font-medium text-sky-700">{hint}</div> : null}
      </div>
      {description ? <div className="mt-1 text-xs text-slate-500">{description}</div> : null}
    </div>
    {children}
  </label>
);
