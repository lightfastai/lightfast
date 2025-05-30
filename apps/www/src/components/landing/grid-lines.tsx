import type { CenterCard, ViewportSize } from "./types";

export interface GridLinesProps {
  centerCard: CenterCard;
  viewportSize: ViewportSize;
  expansionPhase: number;
}

export const GridLines = ({
  centerCard,
  viewportSize,
  expansionPhase,
}: GridLinesProps) => {
  return (
    <div
      className="pointer-events-none absolute inset-0 transition-opacity duration-500"
      style={{ opacity: 1 - expansionPhase * 0.8 }}
    >
      {/* Top horizontal lines */}
      <div
        className="bg-border absolute h-[1px] transition-all duration-300"
        style={{
          top: `${centerCard.top}px`,
          left: 0,
          width: `${centerCard.left}px`,
        }}
      />
      <div
        className="bg-border absolute h-[1px] transition-all duration-300"
        style={{
          top: `${centerCard.top}px`,
          left: `${centerCard.left + centerCard.size}px`,
          width: `${viewportSize.width - (centerCard.left + centerCard.size)}px`,
        }}
      />

      {/* Bottom horizontal lines */}
      <div
        className="bg-border absolute h-[1px] transition-all duration-300"
        style={{
          top: `${centerCard.top + centerCard.size}px`,
          left: 0,
          width: `${centerCard.left}px`,
        }}
      />
      <div
        className="bg-border absolute h-[1px] transition-all duration-300"
        style={{
          top: `${centerCard.top + centerCard.size}px`,
          left: `${centerCard.left + centerCard.size}px`,
          width: `${viewportSize.width - (centerCard.left + centerCard.size)}px`,
        }}
      />

      {/* Left vertical lines */}
      <div
        className="bg-border absolute w-[1px] transition-all duration-300"
        style={{
          left: `${centerCard.left}px`,
          top: 0,
          height: `${centerCard.top}px`,
        }}
      />
      <div
        className="bg-border absolute w-[1px] transition-all duration-300"
        style={{
          left: `${centerCard.left}px`,
          top: `${centerCard.top + centerCard.size}px`,
          height: `${viewportSize.height - (centerCard.top + centerCard.size)}px`,
        }}
      />

      {/* Right vertical lines */}
      <div
        className="bg-border absolute w-[1px] transition-all duration-300"
        style={{
          left: `${centerCard.left + centerCard.size}px`,
          top: 0,
          height: `${centerCard.top}px`,
        }}
      />
      <div
        className="bg-border absolute w-[1px] transition-all duration-300"
        style={{
          left: `${centerCard.left + centerCard.size}px`,
          top: `${centerCard.top + centerCard.size}px`,
          height: `${viewportSize.height - (centerCard.top + centerCard.size)}px`,
        }}
      />
    </div>
  );
};
