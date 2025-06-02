import { cn } from "@repo/ui/lib/utils";

export const GridLines = () => {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0",
        "optimized-grid-lines",
      )}
    >
      {/* Single horizontal lines */}
      <div className="grid-line-top bg-border" />
      <div className="grid-line-bottom bg-border" />

      {/* Single vertical lines */}
      <div className="grid-line-left bg-border" />
      <div className="grid-line-right bg-border" />

      {/* Additional horizontal lines at 33% and 66% */}
      <div className="grid-line-h33 bg-border" />
      <div className="grid-line-h66 bg-border" />

      {/* Additional vertical lines at 33% and 66% */}
      <div className="grid-line-v33 bg-border" />
      <div className="grid-line-v66 bg-border" />
    </div>
  );
};
