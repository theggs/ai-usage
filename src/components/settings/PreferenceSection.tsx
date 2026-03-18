import type { PropsWithChildren } from "react";

export const PreferenceSection = ({
  title,
  description,
  children
}: PropsWithChildren<{ title: string; description?: string }>) => (
  <section className="grid gap-3">
    <div className="grid gap-1">
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</h3>
      {description ? <p className="text-sm text-slate-500">{description}</p> : null}
    </div>
    <div className="grid gap-3">{children}</div>
  </section>
);
