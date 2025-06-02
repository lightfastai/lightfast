"use client";

import { useEffect, useState } from "react";

import { Icons } from "@repo/ui/components/icons";
import { cn } from "@repo/ui/lib/utils";

import { CenterCardEarlyAccess } from "./center-card-early-access";

export const CenterCard = () => {
  const [earlyAccessPhase, setEarlyAccessPhase] = useState(0);
  const [loadingComplete, setLoadingComplete] = useState(false);

  // Monitor CSS variables for phase changes
  useEffect(() => {
    const updatePhases = () => {
      const root = document.documentElement;
      const earlyAccess = parseFloat(
        getComputedStyle(root).getPropertyValue("--early-access-text-phase") ||
          "0",
      );
      setEarlyAccessPhase(earlyAccess);
    };

    // Set up a requestAnimationFrame loop to monitor CSS variables
    let rafId: number;
    const monitor = () => {
      updatePhases();
      rafId = requestAnimationFrame(monitor);
    };

    monitor();

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // Mark loading as complete after initial animations
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadingComplete(true);
    }, 3000); // After grid lines and initial animations

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={cn(
        "bg-card border-border absolute overflow-hidden border shadow-2xl",
        "optimized-center-card",
      )}
    >
      {/* Text content (top-left, fades out during text phase) */}
      <div
        className={cn(
          "center-card-text absolute top-8 right-8 left-8",
          loadingComplete && "loading-complete",
        )}
      >
        <p className="max-w-[400px] text-2xl font-bold">
          The intelligent creative copilot that simplifies the way you interact
          with applications like Blender, Unity, Fusion360 and more.
        </p>
      </div>

      {/* Logo (transforms from bottom-left to center during logo phase) */}
      <div
        className={cn(
          "center-card-logo absolute flex items-center justify-center",
          loadingComplete && "loading-complete",
        )}
      >
        <Icons.logoShort className="text-primary h-12 w-12" />
      </div>

      {/* Early Access Chat (appears during early access phase) */}
      <div
        className="center-card-early-access-container absolute inset-0"
        data-visible={earlyAccessPhase > 0.1 ? "true" : "false"}
      >
        <CenterCardEarlyAccess isVisible={earlyAccessPhase > 0.1} />
      </div>
    </div>
  );
};
