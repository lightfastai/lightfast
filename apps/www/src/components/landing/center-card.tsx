import { Icons } from "@repo/ui/components/icons";
import { cn } from "@repo/ui/lib/utils";

import { getCSSVariableValue } from "./utils";

export const CenterCard = () => {
  const logoSize = 48; // h-12 w-12
  const padding = 32; // p-8

  const textFadeFactor =
    typeof window !== "undefined"
      ? getCSSVariableValue("--text-fade-factor")
      : 0;
  const logoMoveFactor =
    typeof window !== "undefined"
      ? getCSSVariableValue("--logo-move-factor")
      : 0;

  const currentCardWidth =
    typeof window !== "undefined"
      ? getCSSVariableValue("--global-cc-current-width")
      : 0;
  const currentCardHeight =
    typeof window !== "undefined"
      ? getCSSVariableValue("--global-cc-current-height")
      : 0;

  const safeCardWidth = Math.max(0, currentCardWidth);
  const safeCardHeight = Math.max(0, currentCardHeight);

  let logoCurrentX, logoCurrentY;

  if (logoMoveFactor >= 1) {
    logoCurrentX = (safeCardWidth - logoSize) / 2;
    logoCurrentY = (safeCardHeight - logoSize) / 2;
  } else {
    const logoOriginalX = padding;
    const logoOriginalY = safeCardHeight - padding - logoSize;
    const logoFinalX = (safeCardWidth - logoSize) / 2;
    const logoFinalY = (safeCardHeight - logoSize) / 2;

    logoCurrentX =
      logoOriginalX + (logoFinalX - logoOriginalX) * logoMoveFactor;
    logoCurrentY =
      logoOriginalY + (logoFinalY - logoOriginalY) * logoMoveFactor;
  }

  const textOpacity = 1 - textFadeFactor;

  return (
    <div
      className={cn(
        "bg-card border-border absolute overflow-hidden border shadow-2xl transition-all duration-700",
        "animated-center-card",
      )}
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
