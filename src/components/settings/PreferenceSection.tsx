import type { PropsWithChildren } from "react";

export const PreferenceSection = ({
  title,
  children
}: PropsWithChildren<{ title: string }>) => (
  <section className="grid gap-3">
    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</h3>
    <div className="grid gap-3">{children}</div>
  </section>
);
