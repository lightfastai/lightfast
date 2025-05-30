"use client";

import { useEffect, useState } from "react";

import { Icons } from "@repo/ui/components/icons";

// export const metadata: Metadata = {
//   title: "Home",
//   description: "Join the waitlist to get early access to Lightfast",
// };

export default function Home() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Calculate scroll progress (0 to 1)
  const scrollProgress = Math.min(scrollY / 400, 1);

  // Calculate card dimensions (from 600px to 300px)
  const cardSize = 600 - scrollProgress * 300;

  // Calculate opacity for original text (fades out)
  const originalTextOpacity = 1 - scrollProgress;

  // Calculate opacity for new text (fades in)
  const newTextOpacity = scrollProgress;

  return (
    <div className="relative min-h-[200vh]">
      <div className="sticky top-0 flex h-screen w-screen items-center justify-center">
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
          className={`relative overflow-hidden border shadow-2xl transition-all duration-500 ${
            scrollProgress > 0.5
              ? "border-sky-600 bg-sky-500 text-white"
              : "bg-card border-border"
          }`}
          style={{
            width: `${cardSize}px`,
            height: `${cardSize}px`,
          }}
        >
          {/* Original text */}
          <div
            className="absolute top-8 left-8 max-w-[400px] transition-opacity duration-500"
            style={{ opacity: originalTextOpacity }}
          >
            <p className="text-2xl font-bold">
              The intelligent creative copilot that simplifies the way you
              interact with applications like Blender, Unity, Fusion360 and
              more.
            </p>
          </div>

          {/* New text that appears on scroll */}
          <div
            className="absolute top-8 left-8 max-w-[400px] transition-opacity duration-500"
            style={{ opacity: newTextOpacity }}
          >
            <p className="text-2xl font-bold">
              We're prioritizing increasing development speeds of creatives
              using Lightfast's intelligent automation and seamless workflow
              integration.
            </p>
          </div>

          {/* Logo - always visible */}
          <div className="absolute bottom-8 left-8">
            <Icons.logoShort className="text-primary h-12 w-12" />
          </div>
        </div>
      </div>
    </div>
  );
}
