"use client";

import { useEffect, useRef, useState } from "react";

import type { IntegrationCategory } from "../constants";

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
      className={`modeling-card ${isHovered ? "modeling-card-hovered" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={
        {
          "--mouse-x": "0deg",
          "--mouse-y": "0deg",
        } as React.CSSProperties
      }
    >
      {/* 3D Background Elements */}
      {isHovered && (
        <div className="modeling-background">
          <div className="modeling-cube">
            <div className="cube-face cube-face-front"></div>
            <div className="cube-face cube-face-back"></div>
            <div className="cube-face cube-face-right"></div>
            <div className="cube-face cube-face-left"></div>
            <div className="cube-face cube-face-top"></div>
            <div className="cube-face cube-face-bottom"></div>
          </div>
          <div className="wireframe-grid"></div>
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
                className="flex items-center gap-2 rounded-md border border-transparent bg-white/5 px-3 py-2 transition-all duration-300"
                style={{ "--delay": `${index * 0.1}s` } as React.CSSProperties}
              >
                {app.logo && (
                  <img
                    src={app.logo}
                    alt={app.name}
                    className="h-5 w-5 object-contain opacity-80 transition-all duration-300"
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
