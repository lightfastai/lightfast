"use client";

import { useEffect, useState } from "react";

import { Icons } from "@repo/ui/components/icons";

// Integration data for the surrounding cards
const integrationCategories = [
  {
    name: "3D Modeling",
    position: { top: 0, left: 0, width: 16.67, height: 58.33 },
    apps: 7,
    liveApps: 1,
    plannedApps: 6,
  },
  {
    name: "Audio Production",
    position: { top: 58.33, left: 0, width: 16.67, height: 41.67 },
    apps: 5,
    liveApps: 0,
    plannedApps: 5,
  },
  {
    name: "2D Graphics",
    position: { top: 0, left: 16.67, width: 41.67, height: 41.67 },
    apps: 5,
    liveApps: 0,
    plannedApps: 5,
  },
  {
    name: "Game Engines",
    position: { top: 41.67, left: 16.67, width: 25, height: 58.33 },
    apps: 4,
    liveApps: 0,
    plannedApps: 4,
  },
  {
    name: "Video & VFX",
    position: { top: 0, left: 58.33, width: 25, height: 58.33 },
    apps: 5,
    liveApps: 0,
    plannedApps: 5,
  },
  {
    name: "Design Tools",
    position: { top: 0, left: 83.33, width: 16.67, height: 33.33 },
    apps: 3,
    liveApps: 1,
    plannedApps: 2,
  },
  {
    name: "Interactive & Live",
    position: { top: 33.33, left: 83.33, width: 16.67, height: 66.67 },
    apps: 4,
    liveApps: 0,
    plannedApps: 4,
  },
  {
    name: "3D Texturing & CAD",
    position: { top: 58.33, left: 41.67, width: 41.67, height: 41.67 },
    apps: 3,
    liveApps: 0,
    plannedApps: 3,
  },
];

// export const metadata: Metadata = {
//   title: "Home",
//   description: "Join the waitlist to get early access to Lightfast",
// };

export default function Home() {
  const [wheelProgress, setWheelProgress] = useState(0);

  useEffect(() => {
    let accumulatedDelta = 0;
    const maxDelta = 1000;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      accumulatedDelta += e.deltaY;
      accumulatedDelta = Math.max(0, Math.min(maxDelta, accumulatedDelta));

      const progress = accumulatedDelta / maxDelta;
      setWheelProgress(progress);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  // Calculate transformation phases
  const textFadePhase = Math.min(wheelProgress / 0.3, 1); // Text fades in first 30%
  const logoMovePhase = Math.min(Math.max(0, (wheelProgress - 0.1) / 0.4), 1); // Logo moves 10-50%
  const expansionPhase = Math.min(Math.max(0, (wheelProgress - 0.2) / 0.6), 1); // Card expands 20-80%
  const categoryPhase = Math.min(Math.max(0, (wheelProgress - 0.5) / 0.5), 1); // Categories appear 50-100%

  // Calculate container size
  const containerWidth = window.innerWidth - 64;
  const containerHeight = window.innerHeight - 128;

  // Calculate center card properties
  const centerOriginalSize = 600; // Starting card size (back to original)
  const centerFinalSize = Math.min(
    containerWidth * 0.15,
    containerHeight * 0.15,
    150,
  );
  const centerCurrentSize =
    centerOriginalSize -
    (centerOriginalSize - centerFinalSize) * expansionPhase;

  // Calculate where the CENTER of the card should be positioned
  // In the grid, the center area is at 41.67% left and 41.67% top, with 16.67% width/height
  // So the center of that area is at 41.67% + 16.67%/2 = 50% of the container
  const gridCenterX = 32 + containerWidth * 0.5; // 50% of container width + container offset
  const gridCenterY = 64 + containerHeight * 0.5; // 50% of container height + container offset

  // Calculate current center position (interpolate from viewport center to grid center)
  const startCenterX = window.innerWidth / 2;
  const startCenterY = window.innerHeight / 2;

  const currentCenterX =
    startCenterX + (gridCenterX - startCenterX) * expansionPhase;
  const currentCenterY =
    startCenterY + (gridCenterY - startCenterY) * expansionPhase;

  // Convert center position to left/top coordinates for the card
  const centerCurrentLeft = currentCenterX - centerCurrentSize / 2;
  const centerCurrentTop = currentCenterY - centerCurrentSize / 2;

  // Calculate logo position within the card
  const logoSize = 48; // h-12 w-12
  const padding = 32; // p-8

  // Original position (bottom-left)
  const logoOriginalX = padding;
  const logoOriginalY = centerCurrentSize - padding - logoSize;

  // Final position (center)
  const logoFinalX = (centerCurrentSize - logoSize) / 2;
  const logoFinalY = (centerCurrentSize - logoSize) / 2;

  // Current logo position
  const logoCurrentX =
    logoOriginalX + (logoFinalX - logoOriginalX) * logoMovePhase;
  const logoCurrentY =
    logoOriginalY + (logoFinalY - logoOriginalY) * logoMovePhase;

  // Calculate content opacity
  const textOpacity = 1 - textFadePhase;

  return (
    <div className="bg-background relative h-screen overflow-hidden">
      {/* Lines extending from square corners - keep original lines */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{ opacity: 1 - expansionPhase * 0.8 }} // Fade out lines during expansion
      >
        {/* Top horizontal lines */}
        <div
          className="bg-border absolute h-[1px] transition-all duration-300"
          style={{
            top: `calc(50vh - ${centerCurrentSize / 2}px)`,
            left: 0,
            width: `calc(50vw - ${centerCurrentSize / 2}px)`,
          }}
        />
        <div
          className="bg-border absolute h-[1px] transition-all duration-300"
          style={{
            top: `calc(50vh - ${centerCurrentSize / 2}px)`,
            left: `calc(50vw + ${centerCurrentSize / 2}px)`,
            width: `calc(50vw - ${centerCurrentSize / 2}px)`,
          }}
        />

        {/* Bottom horizontal lines */}
        <div
          className="bg-border absolute h-[1px] transition-all duration-300"
          style={{
            top: `calc(50vh + ${centerCurrentSize / 2}px - 1px)`,
            left: 0,
            width: `calc(50vw - ${centerCurrentSize / 2}px)`,
          }}
        />
        <div
          className="bg-border absolute h-[1px] transition-all duration-300"
          style={{
            top: `calc(50vh + ${centerCurrentSize / 2}px - 1px)`,
            left: `calc(50vw + ${centerCurrentSize / 2}px)`,
            width: `calc(50vw - ${centerCurrentSize / 2}px)`,
          }}
        />

        {/* Left vertical lines */}
        <div
          className="bg-border absolute w-[1px] transition-all duration-300"
          style={{
            left: `calc(50vw - ${centerCurrentSize / 2}px)`,
            top: 0,
            height: `calc(50vh - ${centerCurrentSize / 2}px)`,
          }}
        />
        <div
          className="bg-border absolute w-[1px] transition-all duration-300"
          style={{
            left: `calc(50vw - ${centerCurrentSize / 2}px)`,
            top: `calc(50vh + ${centerCurrentSize / 2}px)`,
            height: `calc(50vh - ${centerCurrentSize / 2}px)`,
          }}
        />

        {/* Right vertical lines */}
        <div
          className="bg-border absolute w-[1px] transition-all duration-300"
          style={{
            left: `calc(50vw + ${centerCurrentSize / 2}px - 1px)`,
            top: 0,
            height: `calc(50vh - ${centerCurrentSize / 2}px)`,
          }}
        />
        <div
          className="bg-border absolute w-[1px] transition-all duration-300"
          style={{
            left: `calc(50vw + ${centerCurrentSize / 2}px - 1px)`,
            top: `calc(50vh + ${centerCurrentSize / 2}px)`,
            height: `calc(50vh - ${centerCurrentSize / 2}px - 1px)`,
          }}
        />
      </div>

      {/* Integration category cards that appear around the center */}
      <div
        className="absolute transition-all duration-500"
        style={{
          left: "32px",
          top: "64px",
          width: `${containerWidth}px`,
          height: `${containerHeight}px`,
          opacity: expansionPhase > 0.3 ? categoryPhase : 0,
        }}
      >
        {integrationCategories.map((cat, index) => {
          const cardWidth = containerWidth * (cat.position.width / 100);
          const cardHeight = containerHeight * (cat.position.height / 100);
          const cardLeft = containerWidth * (cat.position.left / 100);
          const cardTop = containerHeight * (cat.position.top / 100);

          return (
            <div
              key={cat.name}
              className="border-border bg-card/80 hover:bg-card/90 absolute flex items-start justify-start overflow-hidden border p-6 backdrop-blur-sm transition-all duration-700"
              style={{
                width: `${cardWidth}px`,
                height: `${cardHeight}px`,
                left: `${cardLeft}px`,
                top: `${cardTop}px`,
                opacity: categoryPhase,
                transform: `scale(${0.8 + categoryPhase * 0.2})`,
                transitionDelay: `${index * 50}ms`,
              }}
            >
              <div className="flex flex-col">
                <span className="text-foreground/90 mb-4 text-2xl font-semibold">
                  {cat.name}
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-sm">
                    {cat.apps} apps
                  </span>
                  <div className="flex gap-1">
                    {cat.liveApps > 0 && (
                      <span className="bg-primary/20 text-primary rounded-full px-2 py-0.5 text-xs">
                        {cat.liveApps} Live
                      </span>
                    )}
                    {cat.plannedApps > 0 && (
                      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                        {cat.plannedApps} Soon
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* The transforming center card */}
      <div
        className="bg-card border-border absolute overflow-hidden border shadow-2xl transition-all duration-700"
        style={{
          width: `${centerCurrentSize}px`,
          height: `${centerCurrentSize}px`,
          left: `${centerCurrentLeft}px`,
          top: `${centerCurrentTop}px`,
        }}
      >
        {/* Text content (top-left, fades out) */}
        <div
          className="absolute top-8 right-8 left-8 transition-opacity duration-500"
          style={{ opacity: textOpacity }}
        >
          <p className="max-w-[400px] text-2xl font-bold">
            The intelligent creative copilot that simplifies the way you
            interact with applications like Blender, Unity, Fusion360 and more.
          </p>
        </div>

        {/* Logo (transforms from bottom-left to center) */}
        <div
          className="absolute transition-all duration-700"
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

      {/* Header that appears */}
      <div
        className="absolute top-16 right-0 left-0 text-center transition-opacity duration-500"
        style={{ opacity: categoryPhase }}
      >
        <h2 className="text-foreground mb-4 text-3xl font-bold">
          Works with your
          <span className="text-primary ml-2 italic">favorite tools</span>
        </h2>
      </div>
    </div>
  );
}
