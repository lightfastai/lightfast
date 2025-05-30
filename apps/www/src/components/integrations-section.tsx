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
  const [containerSize, setContainerSize] = useState({
    width: 0,
    height: 0,
    centerSize: 100,
  });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Fixed center item size - can be adjusted based on viewport or kept constant
        const centerSize = Math.min(
          viewportWidth * 0.15,
          viewportHeight * 0.15,
          150,
        ); // Max 150px

        setContainerSize({
          width: viewportWidth,
          height: viewportHeight,
          centerSize, // Pass center size for calculations
        });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Calculate item dimensions relative to fixed center
  const calculateItemDimensions = (
    position: IntegrationCategory["position"],
    categoryName: string,
  ) => {
    const { width: vw, height: vh, centerSize = 100 } = containerSize;

    // The original grid assumes a 1:1 aspect ratio (100x100)
    // We need to map this to our actual viewport dimensions

    // First, determine the scaling factor based on the center item
    // The center item is 16.67% in the original grid
    const centerOriginalSize = 16.67;
    const centerOriginalLeft = 41.67;
    const centerOriginalTop = 41.67;

    // Use the grid size to calculate scale factors for each axis
    const scaleX = vw / 100; // Map 100% grid to viewport width
    const scaleY = vh / 100; // Map 100% grid to viewport height

    // Calculate where the center item actually is
    const centerScaledLeft = centerOriginalLeft * scaleX;
    const centerScaledTop = centerOriginalTop * scaleY;
    const centerScaledWidth = centerOriginalSize * scaleX;
    const centerScaledHeight = centerOriginalSize * scaleY;

    // The actual center item position (centered within its grid cell)
    const centerActualLeft =
      centerScaledLeft + (centerScaledWidth - centerSize) / 2;
    const centerActualTop =
      centerScaledTop + (centerScaledHeight - centerSize) / 2;
    const centerActualRight = centerActualLeft + centerSize;
    const centerActualBottom = centerActualTop + centerSize;

    // For the center item, we want it to be square and fixed size
    if (categoryName === "Category 5 (Center)") {
      return {
        width: centerSize,
        height: centerSize,
        top: centerActualTop,
        left: centerActualLeft,
        transform: "translate(0, 0)",
      };
    }

    // For all other items, scale proportionally but adjust those touching the center
    let width = position.width * scaleX;
    let height = position.height * scaleY;
    let left = position.left * scaleX;
    let top = position.top * scaleY;

    // Adjust items that touch the center to eliminate gaps
    const touchesCenter = {
      left: position.left + position.width === centerOriginalLeft,
      right: position.left === centerOriginalLeft + centerOriginalSize,
      top: position.top + position.height === centerOriginalTop,
      bottom: position.top === centerOriginalTop + centerOriginalSize,
    };

    // Category 3: Above and to the left of center
    if (categoryName === "Category 3") {
      // Adjust right edge to meet Category 9's left edge (at 58.33%)
      width = 58.33 * scaleX - left;
      // Adjust bottom edge to meet center's top edge
      height = centerActualTop - top;
    }
    // Category 4: Left of center
    else if (categoryName === "Category 4") {
      // Adjust right edge to meet center's left edge
      width = centerActualLeft - left;
      // Top aligns with center's top
      top = centerActualTop;
      // Height extends to bottom
      height = vh - top;
    }
    // Category 8: Below center
    else if (categoryName === "Category 8") {
      // Adjust top to center's bottom
      top = centerActualBottom;
      // Adjust height to fill remaining space
      height = vh - top;
      // Adjust left to center's left
      left = centerActualLeft;
      // Width extends to Category 7's left edge (at 83.33%)
      width = 83.33 * scaleX - left;
    }
    // Category 9: Above and to the right of center
    else if (categoryName === "Category 9") {
      // Adjust left edge to meet center's right edge
      left = centerActualRight;
      // Width extends to category 6
      width = 83.33 * scaleX - left;
      // Height extends to center's bottom
      height = centerActualBottom - top;
    }

    return {
      width,
      height,
      top,
      left,
      transform: "translate(0, 0)",
    };
  };

  return (
    <section className="bg-background w-full">
      {/* Header Section */}
      <div className="w-full py-16">
        <div className="mb-12 text-center">
          <h2 className="text-foreground mb-4 text-3xl font-bold">
            Works with your
            <span className="text-primary ml-2 italic">favorite tools</span>
          </h2>
        </div>
      </div>

      {/* Integration Grid Section - Full Viewport */}
      <div className="relative h-screen w-screen overflow-hidden">
        <div
          ref={containerRef}
          className="relative h-full w-full"
          style={{
            width: containerSize.width,
            height: containerSize.height,
          }}
        >
          {integrationCategories.map((cat) => {
            const dimensions = calculateItemDimensions(cat.position, cat.name);
            return (
              <div
                key={cat.name}
                className={`absolute flex items-center justify-center border text-lg font-bold text-white ${cat.color}`}
                style={{
                  width: `${dimensions.width}px`,
                  height: `${dimensions.height}px`,
                  top: `${dimensions.top}px`,
                  left: `${dimensions.left}px`,
                  transform: dimensions.transform,
                }}
              >
                {cat.name}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
