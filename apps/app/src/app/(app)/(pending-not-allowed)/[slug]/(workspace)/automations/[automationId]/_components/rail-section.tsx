import type { ReactNode } from "react";

export function RailSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border-border border-t pt-4">
      <p className="mb-2 font-mono text-[11px] font-normal text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}
