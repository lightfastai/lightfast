"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const UnicornStudioScene = dynamic(() => import("unicornstudio-react"), {
  ssr: false,
  loading: () => null,
});

type UnicornStudioSceneProps = ComponentProps<typeof UnicornStudioScene>;

interface UnicornSceneProps {
  /** Unicorn Studio project ID */
  projectId: string;
  /** Optional className for the container wrapper */
  className?: string;
  /** Width of the scene - defaults to "100%" for responsive behavior */
  width?: UnicornStudioSceneProps["width"];
  /** Height of the scene - defaults to "100%" for responsive behavior */
  height?: UnicornStudioSceneProps["height"];
  /**
   * Canvas rendering scale (0.25 to 1.0)
   * Lower values = better performance, slightly reduced quality
   * @default 0.5 (optimized for performance)
   */
  scale?: number;
  /**
   * Device pixel ratio
   * Lower values reduce rendering overhead
   * @default 1 (optimized - use 1.5-2 for high-DPI displays if needed)
   */
  dpi?: number;
  /**
   * Frames per second (15, 24, 30, 60, or 120)
   * Lower values reduce CPU/GPU usage
   * @default 30 (smooth but efficient for decorative scenes)
   */
  fps?: 15 | 24 | 30 | 60 | 120;
  /**
   * Lazy load the scene when it enters viewport
   * Reduces initial page load impact
   * @default true
   */
  lazyLoad?: boolean;
  /**
   * Enable production/CDN mode for optimized asset delivery
   * Note: Updates take 1-2 minutes to propagate through CDN
   * @default true
   */
  production?: boolean;
  /** Whether to pause the animation */
  paused?: boolean;
  /** Alt text for accessibility */
  altText?: string;
  /** Callback when scene finishes loading */
  onLoad?: () => void;
  /** Callback when scene encounters an error */
  onError?: (error: Error) => void;
}

/**
 * Wrapper component for Unicorn Studio scenes with performance-optimized defaults.
 *
 * The component fills its container by default (width/height "100%").
 * Ensure the parent container has explicit dimensions.
 *
 * Performance defaults:
 * - scale: 0.5 (good balance of quality/performance)
 * - dpi: 1 (adequate for most displays)
 * - fps: 30 (smooth animation without excessive rendering)
 * - lazyLoad: true (defers loading until visible)
 * - production: true (CDN-optimized delivery)
 *
 * @example
 * ```tsx
 * // Basic usage with performance defaults
 * <div className="w-full h-[500px]">
 *   <UnicornScene projectId="your-project-id" />
 * </div>
 *
 * // High quality mode (for hero sections on fast devices)
 * <div className="w-full h-[500px]">
 *   <UnicornScene
 *     projectId="your-project-id"
 *     scale={0.75}
 *     dpi={1.5}
 *     fps={60}
 *   />
 * </div>
 * ```
 */
export function UnicornScene({
  projectId,
  className,
  width = "100%",
  height = "100%",
  scale = 0.5,
  dpi = 1,
  fps = 30,
  lazyLoad = true,
  production = true,
  paused = false,
  altText = "Scene",
  onLoad,
  onError,
}: UnicornSceneProps) {
  return (
    <div className={className}>
      <UnicornStudioScene
        projectId={projectId}
        width={width}
        height={height}
        scale={scale}
        dpi={dpi}
        fps={fps}
        lazyLoad={lazyLoad}
        production={production}
        paused={paused}
        altText={altText}
        onLoad={onLoad}
        onError={onError}
      />
    </div>
  );
}
