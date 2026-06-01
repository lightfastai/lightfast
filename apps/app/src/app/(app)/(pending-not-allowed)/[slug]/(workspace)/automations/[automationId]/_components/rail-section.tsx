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
      <p className="mb-2 font-mono font-normal text-[11px] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}
