"use client";

import { useEffect, useRef, useState } from "react";

import type { IntegrationCategory } from "../constants";

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
      <div className="interactive-content">
        <span className="card-title">{category.name}</span>
        <div className="applications-section">
          <span className="applications-label">Applications</span>
          <div className="applications-grid">
            {category.applications.map((app, index) => (
              <div
                key={app.name}
                className="application-item"
                style={{ "--delay": `${index * 0.1}s` } as React.CSSProperties}
              >
                {app.logo && (
                  <img src={app.logo} alt={app.name} className="app-logo" />
                )}
                <span className="app-name">{app.name}</span>
                <div className={`status-indicator status-${app.status}`}>
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
