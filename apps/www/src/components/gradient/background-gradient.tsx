"use client";

import { useEffect, useState } from "react";

import { generateGradientProps } from "~/lib/gradient-utils/gradient-utils";
import { GradientCanvas } from "./gradient-canvas";

interface BackgroundGradientProps {
  className?: string;
}

export function BackgroundGradient({ className }: BackgroundGradientProps) {
  const [gradientProps, setGradientProps] = useState(() =>
    generateGradientProps(1200, 800),
  );
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  // Update dimensions on window resize
  useEffect(() => {
    const updateDimensions = () => {
      const container = document.querySelector(".gradient-container");
      if (container) {
        const { width, height } = container.getBoundingClientRect();
        setDimensions({ width, height });

        // Update gradient props with new dimensions
        setGradientProps((prev) => ({
          ...prev,
          width,
          height,
        }));
      }
    };

    // Initial measurement
    updateDimensions();

    // Listen for resize events
    window.addEventListener("resize", updateDimensions);
    return () => {
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  return (
    <div className={`gradient-container relative ${className || ""}`}>
      <GradientCanvas {...gradientProps} />
    </div>
  );
}
