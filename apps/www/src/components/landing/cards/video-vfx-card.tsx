"use client";

import { useEffect, useRef, useState } from "react";

import type { IntegrationCategory } from "../constants";

interface VideoVFXCardProps {
  category: IntegrationCategory;
}

export const VideoVFXCard = ({ category }: VideoVFXCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Mouse tracking for lens flare effect
  useEffect(() => {
    const element = cardRef.current;
    if (!element || !isHovered) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      element.style.setProperty("--mouse-x", `${x * 100}%`);
      element.style.setProperty("--mouse-y", `${y * 100}%`);
    };

    element.addEventListener("mousemove", handleMouseMove);
    return () => element.removeEventListener("mousemove", handleMouseMove);
  }, [isHovered]);

  return (
    <div
      ref={cardRef}
      className={`relative h-full w-full overflow-hidden border p-6 transition-all duration-400 ease-out ${
        isHovered
          ? "border-yellow-400 shadow-[0_0_30px_rgba(255,215,0,0.2)]"
          : "border-white/10 bg-white/[0.02]"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={
        {
          "--mouse-x": "50%",
          "--mouse-y": "50%",
          ...(isHovered && {
            background: "linear-gradient(135deg, #1a1a1a 0%, #2a1810 100%)",
          }),
        } as React.CSSProperties
      }
    >
      {/* Film Effects Background */}
      {isHovered && (
        <div
          className="absolute inset-0 opacity-0"
          style={{ animation: "fadeIn 0.4s ease-out forwards" }}
        >
          {/* Film Grain */}
          <div
            className="absolute inset-0 opacity-10 mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48ZmlsdGVyIGlkPSJub2lzZSI+PGZlVHVyYnVsZW5jZSBiYXNlRnJlcXVlbmN5PSIwLjkiIG51bU9jdGF2ZXM9IjQiIHNlZWQ9IjIiLz48L2ZpbHRlcj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI25vaXNlKSIgb3BhY2l0eT0iMC4xIi8+PC9zdmc+")`,
            }}
          />
          {/* Film Strip */}
          <div
            className="absolute top-0 bottom-0 left-0 opacity-30"
            style={{
              width: "20px",
              background:
                "linear-gradient(180deg, #ffd700 0%, transparent 50%, #ffd700 100%)",
            }}
          >
            {["10%", "30%", "50%", "70%"].map((top, index) => (
              <div
                key={index}
                className="absolute h-2 w-2 rounded-full bg-black"
                style={{
                  top,
                  left: "6px",
                }}
              />
            ))}
          </div>
          {/* Lens Flare */}
          <div
            className="pointer-events-none absolute h-25 w-25 blur-sm"
            style={{
              width: "100px",
              height: "100px",
              left: "var(--mouse-x, 50%)",
              top: "var(--mouse-y, 50%)",
              transform: "translate(-50%, -50%)",
              background:
                "radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, transparent 70%)",
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col">
        <span className="relative z-10 mb-4 text-2xl font-semibold text-white/90">
          {category.name}
        </span>
        <div className="relative z-10 flex flex-col gap-3">
          <span className="mb-1 text-sm text-white/60">Applications</span>
          <div className="flex flex-col gap-2">
            {category.applications.map((app, index) => (
              <div
                key={app.name}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 transition-all duration-300 ${
                  isHovered
                    ? "border-yellow-400/30 bg-yellow-400/10 shadow-[0_0_10px_rgba(255,215,0,0.2)]"
                    : "border-transparent bg-white/5"
                }`}
                style={
                  {
                    "--delay": `${index * 0.1}s`,
                    ...(isHovered && {
                      transform: `translateY(${-3 * index * 0.1}px)`,
                      transitionDelay: `${index * 0.1}s`,
                    }),
                  } as React.CSSProperties
                }
              >
                {app.logo && (
                  <img
                    src={app.logo}
                    alt={app.name}
                    className="h-5 w-5 object-contain opacity-80 transition-all duration-300"
                    style={{
                      ...(isHovered && {
                        filter:
                          "sepia(1) hue-rotate(30deg) saturate(2) brightness(1.2)",
                      }),
                    }}
                  />
                )}
                <span className="flex-1 text-sm text-white/90">{app.name}</span>
                <div
                  className={`text-xs ${
                    app.status === "live"
                      ? "text-green-400"
                      : app.status === "planned"
                        ? "text-yellow-400"
                        : "text-white/40"
                  }`}
                >
                  {app.status === "live" && "●"}
                  {app.status === "planned" && "○"}
                  {app.status === "future" && "◦"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
