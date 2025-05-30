import { cn } from "@repo/ui/lib/utils";

export const GridLines = () => {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0",
        "optimized-grid-lines",
      )}
    >
      {/* Top horizontal lines */}
      <div className="grid-line-h-top-left" />
      <div className="grid-line-h-top-right" />

      {/* Bottom horizontal lines */}
      <div className="grid-line-h-bottom-left" />
      <div className="grid-line-h-bottom-right" />

      {/* Left vertical lines */}
      <div className="grid-line-v-left-top" />
      <div className="grid-line-v-left-bottom" />

      {/* Right vertical lines */}
      <div className="grid-line-v-right-top" />
      <div className="grid-line-v-right-bottom" />
    </div>
  );
};
