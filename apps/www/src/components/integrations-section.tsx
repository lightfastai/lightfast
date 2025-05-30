"use client";

import { useEffect, useRef, useState } from "react";

// --- Data Structure ---

interface IntegrationApp {
  name: string;
  category: string;
  connection: string;
  priority: string;
  status: string;
  issue?: string;
}

interface IntegrationCategory {
  name: string;
  position: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  color: string;
  apps?: IntegrationApp[];
  isLogo?: boolean;
}

// --- Integration Data ---

const integrationCategories: IntegrationCategory[] = [
  {
    name: "Category 1",
    position: { top: 0, left: 0, width: 16.67, height: 58.33 },
    color: "bg-blue-500",
  },
  {
    name: "Category 2",
    position: { top: 58.33, left: 0, width: 16.67, height: 41.67 },
    color: "bg-red-500",
  },
  {
    name: "Category 3",
    position: { top: 0, left: 16.67, width: 41.67, height: 41.67 },
    color: "bg-yellow-400",
  },
  {
    name: "Category 4",
    position: { top: 41.67, left: 16.67, width: 25, height: 58.33 },
    color: "bg-green-400",
  },
  {
    name: "Category 5 (Center)",
    position: { top: 41.67, left: 41.67, width: 16.67, height: 16.67 },
    color: "bg-purple-400",
  },
  {
    name: "Category 9",
    position: { top: 0, left: 58.33, width: 25, height: 58.33 },
    color: "bg-purple-400",
  },
  {
    name: "Category 6",
    position: { top: 0, left: 83.33, width: 16.67, height: 33.33 },
    color: "bg-pink-400",
  },
  {
    name: "Category 7",
    position: { top: 33.33, left: 83.33, width: 16.67, height: 66.67 },
    color: "bg-orange-400",
  },
  {
    name: "Category 8",
    position: { top: 58.33, left: 41.67, width: 41.67, height: 41.67 },
    color: "bg-teal-400",
  },
];

// --- Component ---

export function IntegrationsSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        // Calculate height based on the center item's position
        // The center item is 16.67% of the width, so we need to make sure
        // that 16.67% of the height equals 16.67% of the width
        const centerItemWidth = width * 0.1667;
        const height = centerItemWidth / 0.1667;
        setContainerSize({ width, height });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  return (
    <section className="bg-background flex h-screen min-h-screen w-full items-center justify-center">
      <div className="w-full py-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <h2 className="text-foreground mb-4 text-3xl font-bold">
            Works with your
            <span className="text-primary ml-2 italic">favorite tools</span>
          </h2>
        </div>

        {/* Container */}
        <div className="relative w-full px-4">
          <div
            ref={containerRef}
            className="relative w-full"
            style={{
              height: containerSize.height,
            }}
          >
            {integrationCategories.map((cat) => (
              <div
                key={cat.name}
                className={`absolute flex items-center justify-center border text-lg font-bold text-white ${cat.color}`}
                style={{
                  top: `${cat.position.top}%`,
                  left: `${cat.position.left}%`,
                  width: `${cat.position.width}%`,
                  height: `${cat.position.height}%`,
                }}
              >
                {cat.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
