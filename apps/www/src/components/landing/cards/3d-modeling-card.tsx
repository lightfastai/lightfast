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
      <div className="modeling-content">
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
