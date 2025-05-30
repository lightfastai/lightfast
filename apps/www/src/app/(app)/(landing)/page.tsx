"use client";

import { useEffect, useState } from "react";

import { Icons } from "@repo/ui/components/icons";

// export const metadata: Metadata = {
//   title: "Home",
//   description: "Join the waitlist to get early access to Lightfast",
// };

export default function Home() {
  const [wheelProgress, setWheelProgress] = useState(0);

  useEffect(() => {
    let accumulatedDelta = 0;
    const maxDelta = 400; // Maximum wheel delta to reach full transformation

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Accumulate wheel delta
      accumulatedDelta += e.deltaY;

      // Clamp between 0 and maxDelta
      accumulatedDelta = Math.max(0, Math.min(maxDelta, accumulatedDelta));

      // Calculate progress (0 to 1)
      const progress = accumulatedDelta / maxDelta;
      setWheelProgress(progress);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  // Calculate card dimensions (from 600px to 300px)
  const cardSize = 600 - wheelProgress * 300;

  // Calculate opacity for original text (fades out)
  const originalTextOpacity = 1 - wheelProgress;

  // Calculate opacity for new text (fades in)
  const newTextOpacity = wheelProgress;

  return (
    <div className="relative h-screen overflow-hidden">
      <div className="flex h-screen w-screen items-center justify-center">
        {/* Lines extending from square corners */}
        <div className="pointer-events-none absolute inset-0">
          {/* Top horizontal lines */}
          <div
            className="bg-border absolute h-[1px] transition-all duration-300"
            style={{
              top: `calc(50vh - ${cardSize / 2}px)`,
              left: 0,
              width: `calc(50vw - ${cardSize / 2}px)`,
            }}
          />
          <div
            className="bg-border absolute h-[1px] transition-all duration-300"
            style={{
              top: `calc(50vh - ${cardSize / 2}px)`,
              left: `calc(50vw + ${cardSize / 2}px)`,
              width: `calc(50vw - ${cardSize / 2}px)`,
            }}
          />

          {/* Bottom horizontal lines */}
          <div
            className="bg-border absolute h-[1px] transition-all duration-300"
            style={{
              top: `calc(50vh + ${cardSize / 2}px - 1px)`,
              left: 0,
              width: `calc(50vw - ${cardSize / 2}px)`,
            }}
          />
          <div
            className="bg-border absolute h-[1px] transition-all duration-300"
            style={{
              top: `calc(50vh + ${cardSize / 2}px - 1px)`,
              left: `calc(50vw + ${cardSize / 2}px)`,
              width: `calc(50vw - ${cardSize / 2}px)`,
            }}
          />

          {/* Left vertical lines */}
          <div
            className="bg-border absolute w-[1px] transition-all duration-300"
            style={{
              left: `calc(50vw - ${cardSize / 2}px)`,
              top: 0,
              height: `calc(50vh - ${cardSize / 2}px)`,
            }}
          />
          <div
            className="bg-border absolute w-[1px] transition-all duration-300"
            style={{
              left: `calc(50vw - ${cardSize / 2}px)`,
              top: `calc(50vh + ${cardSize / 2}px)`,
              height: `calc(50vh - ${cardSize / 2}px)`,
            }}
          />

          {/* Right vertical lines */}
          <div
            className="bg-border absolute w-[1px] transition-all duration-300"
            style={{
              left: `calc(50vw + ${cardSize / 2}px - 1px)`,
              top: 0,
              height: `calc(50vh - ${cardSize / 2}px)`,
            }}
          />
          <div
            className="bg-border absolute w-[1px] transition-all duration-300"
            style={{
              left: `calc(50vw + ${cardSize / 2}px - 1px)`,
              top: `calc(50vh + ${cardSize / 2}px)`,
              height: `calc(50vh - ${cardSize / 2}px - 1px)`,
            }}
          />
        </div>

        <div
          className={`relative flex flex-col justify-between overflow-hidden border shadow-2xl transition-all duration-500 ${
            wheelProgress > 0.5
              ? "border-sky-600 bg-sky-500 text-white"
              : "bg-card border-border"
          }`}
          style={{
            width: `${cardSize}px`,
            height: `${cardSize}px`,
          }}
        >
          {/* Dynamic text content */}
          <div
            className={`transition-all duration-500 ${wheelProgress > 0.5 ? "p-4" : "p-8"}`}
          >
            <p
              className={`font-bold transition-all duration-500 ${
                wheelProgress > 0.5
                  ? "max-w-[350px] text-lg leading-tight"
                  : "max-w-[400px] text-2xl"
              }`}
            >
              {wheelProgress > 0.5
                ? "We're prioritizing increasing development speeds of creatives using Lightfast's intelligent automation and seamless workflow integration."
                : "The intelligent creative copilot that simplifies the way you interact with applications like Blender, Unity, Fusion360 and more."}
            </p>
          </div>

          {/* Logo */}
          <div
            className={`transition-all duration-500 ${wheelProgress > 0.5 ? "p-4" : "p-8"}`}
          >
            <Icons.logoShort className="text-primary h-12 w-12" />
          </div>
        </div>
      </div>
    </div>
  );
}
