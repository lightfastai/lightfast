import { Icons } from "@repo/ui/components/icons";

import type { CenterCard as CenterCardType } from "./types";

export interface CenterCardProps {
  centerCard: CenterCardType;
  textFadePhase: number;
  logoMovePhase: number;
}

export const CenterCard = ({
  centerCard,
  textFadePhase,
  logoMovePhase,
}: CenterCardProps) => {
  // Calculate logo position within the card
  const logoSize = 48; // h-12 w-12
  const padding = 32; // p-8

  // Calculate logo position - always center it when move phase is complete
  let logoCurrentX, logoCurrentY;

  if (logoMovePhase >= 1) {
    // Logo is fully centered
    logoCurrentX = (centerCard.size - logoSize) / 2;
    logoCurrentY = (centerCard.size - logoSize) / 2;
  } else {
    // Logo is transitioning from original position to center
    const logoOriginalX = padding;
    const logoOriginalY = centerCard.size - padding - logoSize;
    const logoFinalX = (centerCard.size - logoSize) / 2;
    const logoFinalY = (centerCard.size - logoSize) / 2;

    logoCurrentX = logoOriginalX + (logoFinalX - logoOriginalX) * logoMovePhase;
    logoCurrentY = logoOriginalY + (logoFinalY - logoOriginalY) * logoMovePhase;
  }

  // Calculate content opacity
  const textOpacity = 1 - textFadePhase;

  return (
    <div
      className="bg-card border-border absolute overflow-hidden border shadow-2xl transition-all duration-700"
      style={{
        width: `${centerCard.size}px`,
        height: `${centerCard.size}px`,
        left: `${centerCard.left}px`,
        top: `${centerCard.top}px`,
      }}
    >
      {/* Text content (top-left, fades out) */}
      <div
        className="absolute top-8 right-8 left-8 transition-opacity duration-500"
        style={{ opacity: textOpacity }}
      >
        <p className="max-w-[400px] text-2xl font-bold">
          The intelligent creative copilot that simplifies the way you interact
          with applications like Blender, Unity, Fusion360 and more.
        </p>
      </div>

      {/* Logo (transforms from bottom-left to center) */}
      <div
        className="absolute flex items-center justify-center transition-all duration-700"
        style={{
          left: `${logoCurrentX}px`,
          top: `${logoCurrentY}px`,
          width: `${logoSize}px`,
          height: `${logoSize}px`,
        }}
      >
        <Icons.logoShort className="text-primary h-12 w-12" />
      </div>
    </div>
  );
};
