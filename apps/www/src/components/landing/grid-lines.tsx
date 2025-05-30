import { cn } from "@repo/ui/lib/utils";

export interface GridLinesProps {
  // centerCard: Partial<CenterCard>; // Removed
  // expansionPhase is also removed as its effect is CSS driven by --grid-lines-opacity
}

export const GridLines = (
  {
    // No props needed if all styling is via CSS vars
  }: GridLinesProps,
) => {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 transition-opacity duration-500",
        "grid-lines-animated",
      )}
    >
      {/* Top horizontal lines */}
      <div
        className="bg-border absolute h-[1px] transition-all duration-300"
        style={{
          top: `var(--global-cc-current-top)`,
          left: 0,
          width: `var(--global-cc-current-left)`,
        }}
      />
      <div
        className="bg-border absolute h-[1px] transition-all duration-300"
        style={{
          top: `var(--global-cc-current-top)`,
          left: `calc(var(--global-cc-current-left) + var(--global-cc-current-width))`,
          width: `calc(100vw - (var(--global-cc-current-left) + var(--global-cc-current-width)))`,
        }}
      />

      {/* Bottom horizontal lines */}
      <div
        className="bg-border absolute h-[1px] transition-all duration-300"
        style={{
          top: `calc(var(--global-cc-current-top) + var(--global-cc-current-height))`,
          left: 0,
          width: `var(--global-cc-current-left)`,
        }}
      />
      <div
        className="bg-border absolute h-[1px] transition-all duration-300"
        style={{
          top: `calc(var(--global-cc-current-top) + var(--global-cc-current-height))`,
          left: `calc(var(--global-cc-current-left) + var(--global-cc-current-width))`,
          width: `calc(100vw - (var(--global-cc-current-left) + var(--global-cc-current-width)))`,
        }}
      />

      {/* Left vertical lines */}
      <div
        className="bg-border absolute w-[1px] transition-all duration-300"
        style={{
          left: `var(--global-cc-current-left)`,
          top: 0,
          height: `var(--global-cc-current-top)`,
        }}
      />
      <div
        className="bg-border absolute w-[1px] transition-all duration-300"
        style={{
          left: `var(--global-cc-current-left)`,
          top: `calc(var(--global-cc-current-top) + var(--global-cc-current-height))`,
          height: `calc(100vh - (var(--global-cc-current-top) + var(--global-cc-current-height)))`,
        }}
      />

      {/* Right vertical lines */}
      <div
        className="bg-border absolute w-[1px] transition-all duration-300"
        style={{
          left: `calc(var(--global-cc-current-left) + var(--global-cc-current-width))`,
          top: 0,
          height: `var(--global-cc-current-top)`,
        }}
      />
      <div
        className="bg-border absolute w-[1px] transition-all duration-300"
        style={{
          left: `calc(var(--global-cc-current-left) + var(--global-cc-current-width))`,
          top: `calc(var(--global-cc-current-top) + var(--global-cc-current-height))`,
          height: `calc(100vh - (var(--global-cc-current-top) + var(--global-cc-current-height)))`,
        }}
      />
    </div>
  );
};
