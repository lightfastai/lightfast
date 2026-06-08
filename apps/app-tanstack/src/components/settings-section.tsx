import type { ReactNode } from "react";

export function SettingsGroup({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section>
      <h3 className="font-semibold text-base text-foreground">{title}</h3>
      <div className="mt-2 divide-y divide-border/55">{children}</div>
    </section>
  );
}

export function SettingRow({
  children,
  description,
  label,
}: {
  children: ReactNode;
  description?: string;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="min-w-0">
        <p className="text-foreground text-sm">{label}</p>
        {description ? (
          <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">{children}</div>
    </div>
  );
}
