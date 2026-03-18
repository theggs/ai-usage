import type { PropsWithChildren, ReactNode } from "react";

export const PreferenceField = ({
  label,
  description,
  children
}: PropsWithChildren<{ label: string; description?: ReactNode }>) => (
  <label className="grid gap-2 rounded-3xl bg-white/80 p-4 shadow-sm shadow-emerald-950/5">
    <div>
      <div className="text-sm font-semibold text-slate-900">{label}</div>
      {description ? <div className="mt-1 text-xs text-slate-500">{description}</div> : null}
    </div>
    {children}
  </label>
);
