"use client";

import Link from "next/link";
import { Matrix, wave } from "@repo/ui/components/ui/matrix";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";

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
 * - Clickable link to /manifesto
 * - Hover tooltip: "Learn more about our brand"
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
          <Link
            href="/manifesto"
            className="block border border-border p-2 w-fit rounded-sm overflow-hidden text-foreground hover:opacity-80 transition-opacity"
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
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-md font-base">
          <p>Learn more about our company</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
