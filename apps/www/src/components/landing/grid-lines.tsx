import type { CenterCard, ViewportSize } from "./types";

export interface GridLinesProps {
  centerCard: Partial<CenterCard>;
  viewportSize: ViewportSize;
  expansionPhase: number;
}

export const GridLines = ({ viewportSize, expansionPhase }: GridLinesProps) => {
  return (
    <div
      className="pointer-events-none absolute inset-0 transition-opacity duration-500"
      style={{
        opacity: 1 - expansionPhase * 0.8,
      }}
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
          width: `calc(${viewportSize.width}px - (var(--global-cc-current-left) + var(--global-cc-current-width)))`,
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
          width: `calc(${viewportSize.width}px - (var(--global-cc-current-left) + var(--global-cc-current-width)))`,
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
          height: `calc(${viewportSize.height}px - (var(--global-cc-current-top) + var(--global-cc-current-height)))`,
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
          height: `calc(${viewportSize.height}px - (var(--global-cc-current-top) + var(--global-cc-current-height)))`,
        }}
      />
    </div>
  );
};
