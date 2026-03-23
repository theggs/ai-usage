import type { PropsWithChildren } from "react";

export const PreferenceSection = ({
  title,
  description,
  children
}: PropsWithChildren<{ title: string; description?: string }>) => (
  <section className="preference-section grid gap-2 pt-4 first:pt-0">
    <div className="preference-section-heading grid gap-1 px-1">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</h3>
      {description ? <p className="text-sm text-slate-500">{description}</p> : null}
    </div>
    <div className="grid rounded-[26px] border border-slate-200 bg-white/95 p-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] [&>*+*]:border-t [&>*+*]:border-slate-100 [&>*+*]:pt-4">
      {children}
    </div>
  </section>
);
