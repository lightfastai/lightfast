"use client";
import { Matrix, wave } from "@repo/ui/components/ui/matrix";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
// Decorative only – no navigation overlay

/**
 * LightfastSineWaveMatrix - Animated matrix wave pattern component
 *
 * Displays a 7x7 matrix grid with sine wave animation pattern.
 * Links to the manifesto page with a tooltip on hover.
 * Used in navigation sidebars and menu overlays.
 *
 * Features:
 * - 7x7 grid configuration
 * - Sine wave animation at 24fps
 * - Bordered container with rounded corners
 * - 80% brightness for subtle effect
 * - Decorative only (non-clickable)
 * - Hover tooltip: "Lightfast"
 *
 * @example
 * ```tsx
 * <LightfastSineWaveMatrix />
 * ```
 */
export function LightfastSineWaveMatrix() {

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="block border border-border p-2 w-fit rounded-sm overflow-hidden text-foreground"
            aria-label="Lightfast logo animation"
          >
            <Matrix
              rows={7}
              cols={7}
              frames={wave}
              fps={24}
              size={8}
              gap={3}
              brightness={0.8}
              ariaLabel="Animated wave pattern"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-md font-base">
          <p>Lightfast</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
