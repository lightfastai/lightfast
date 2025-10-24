"use client";

import { usePathname } from "next/navigation";
import { Matrix, wave } from "@repo/ui/components/ui/matrix";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { useNavigationOverlay } from "./navigation-overlay-provider";

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
  const pathname = usePathname();
  const { navigateToManifesto, navigateFromManifesto } = useNavigationOverlay();

  /**
   * Handle matrix click
   * Triggers overlay animation when navigating to/from manifesto
   */
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    // If on manifesto, navigate back home with reverse animation
    if (pathname === "/manifesto") {
      navigateFromManifesto("/");
      return;
    }

    // Otherwise, navigate to manifesto with forward animation
    navigateToManifesto();
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            className="block border border-border p-2 w-fit rounded-sm overflow-hidden text-foreground hover:opacity-80 transition-opacity cursor-pointer"
            aria-label="Navigate to manifesto"
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
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-md font-base">
          <p>Learn more about our company</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
