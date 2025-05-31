"use client";

import { useEffect, useRef, useState } from "react";

import type { IntegrationCategory } from "../../../lib/animation/constants";

interface ThreeDModelingCardProps {
  category: IntegrationCategory;
}

export const ThreeDModelingCard = ({ category }: ThreeDModelingCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Mouse tracking for 3D effects
  useEffect(() => {
    const element = cardRef.current;
    if (!element || !isHovered) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      element.style.setProperty("--mouse-x", `${(x - 0.5) * 20}deg`);
      element.style.setProperty("--mouse-y", `${(0.5 - y) * 20}deg`);
    };

    element.addEventListener("mousemove", handleMouseMove);
    return () => element.removeEventListener("mousemove", handleMouseMove);
  }, [isHovered]);

  return (
    <div
      ref={cardRef}
      className={`relative overflow-hidden border p-6 transition-all duration-400 ease-out ${
        isHovered
          ? "border-cyan-400 shadow-[0_0_30px_rgba(0,255,255,0.3)]"
          : "border-white/10 bg-white/[0.02]"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={
        {
          "--mouse-x": "0deg",
          "--mouse-y": "0deg",
          ...(isHovered && {
            background: "linear-gradient(135deg, #0f1419 0%, #1a2332 100%)",
            transform: `rotateX(var(--mouse-y, 0deg)) rotateY(var(--mouse-x, 0deg))`,
            transformStyle: "preserve-3d",
          }),
        } as React.CSSProperties
      }
    >
      {/* 3D Background Elements */}
      {isHovered && (
        <div
          className="animate-in fade-in absolute inset-0 opacity-0 duration-400"
          style={{ animation: "fadeIn 0.4s ease-out forwards" }}
        >
          <div
            className="absolute top-1/2 right-5 h-15 w-15"
            style={{
              width: "60px",
              height: "60px",
              transformStyle: "preserve-3d",
              animation: "rotate3d 20s infinite linear",
            }}
          >
            {[
              { name: "front", transform: "rotateY(0deg) translateZ(30px)" },
              { name: "back", transform: "rotateY(180deg) translateZ(30px)" },
              { name: "right", transform: "rotateY(90deg) translateZ(30px)" },
              { name: "left", transform: "rotateY(-90deg) translateZ(30px)" },
              { name: "top", transform: "rotateX(90deg) translateZ(30px)" },
              { name: "bottom", transform: "rotateX(-90deg) translateZ(30px)" },
            ].map((face) => (
              <div
                key={face.name}
                className="absolute h-15 w-15 border border-cyan-400/60 bg-cyan-400/10"
                style={{
                  width: "60px",
                  height: "60px",
                  transform: face.transform,
                }}
              />
            ))}
          </div>
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `
                linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)
              `,
              backgroundSize: "20px 20px",
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
                    ? "border-cyan-400/30 bg-cyan-400/10"
                    : "border-transparent bg-white/5"
                }`}
                style={
                  {
                    "--delay": `${index * 0.1}s`,
                    ...(isHovered && {
                      transform: `translateZ(10px) translateY(${-5 * index * 0.1}px)`,
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
                        filter: "drop-shadow(0 0 5px rgba(0, 255, 255, 0.5))",
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
