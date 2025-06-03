"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import type { IntegrationCategory } from "../../../config/landing";

interface InteractiveLiveCardProps {
  category: IntegrationCategory;
}

export const InteractiveLiveCard = ({ category }: InteractiveLiveCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Mouse tracking for ripple effects
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
      className={`interactive-live-card ${isHovered ? "interactive-live-card-hovered" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={
        {
          "--mouse-x": "50%",
          "--mouse-y": "50%",
        } as React.CSSProperties
      }
    >
      {/* Interactive Background Elements */}
      {isHovered && (
        <div className="interactive-background">
          <div className="network-nodes">
            <div className="node node-1"></div>
            <div className="node node-2"></div>
            <div className="node node-3"></div>
            <div className="node node-4"></div>
          </div>
          <div className="connection-lines">
            <div className="connection connection-1"></div>
            <div className="connection connection-2"></div>
            <div className="connection connection-3"></div>
          </div>
          <div className="data-pulse"></div>
          <div className="ripple-effect"></div>
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
                  <Image
                    src={app.logo}
                    alt={app.name}
                    width={20}
                    height={20}
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
