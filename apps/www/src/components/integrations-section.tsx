"use client";

import { useEffect, useRef, useState } from "react";

import { Icons } from "@repo/ui/components/icons";

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
    name: "3D Modeling",
    position: { top: 0, left: 0, width: 16.67, height: 58.33 },
    color: "bg-black",
    apps: [
      {
        name: "Blender",
        category: "3D",
        connection: "Socket-based",
        priority: "✅",
        status: "Implemented",
        issue: "",
      },
      {
        name: "Maya",
        category: "3D",
        connection: "Python API",
        priority: "High",
        status: "Planned",
        issue: "#28",
      },
      {
        name: "Cinema 4D",
        category: "3D",
        connection: "Python API",
        priority: "High",
        status: "Planned",
        issue: "#27",
      },
      {
        name: "3ds Max",
        category: "3D",
        connection: "PyMXS/MaxScript",
        priority: "High",
        status: "Planned",
        issue: "#33",
      },
      {
        name: "Houdini",
        category: "3D",
        connection: "Python API",
        priority: "Medium",
        status: "Planned",
        issue: "",
      },
      {
        name: "Modo",
        category: "3D",
        connection: "Python API",
        priority: "Low",
        status: "Future",
        issue: "",
      },
      {
        name: "ZBrush",
        category: "3D",
        connection: "ZScript/Python",
        priority: "Low",
        status: "Future",
        issue: "",
      },
    ],
  },
  {
    name: "Audio Production",
    position: { top: 58.33, left: 0, width: 16.67, height: 41.67 },
    color: "bg-black",
    apps: [
      {
        name: "Ableton Live",
        category: "Audio",
        connection: "OSC/Max for Live",
        priority: "High",
        status: "Planned",
        issue: "#31",
      },
      {
        name: "Reaper",
        category: "Audio",
        connection: "Python API",
        priority: "High",
        status: "Planned",
        issue: "#36",
      },
      {
        name: "Logic Pro",
        category: "Audio",
        connection: "AppleScript",
        priority: "Low",
        status: "Future",
        issue: "",
      },
      {
        name: "FL Studio",
        category: "Audio",
        connection: "Python API",
        priority: "Low",
        status: "Future",
        issue: "",
      },
      {
        name: "Pro Tools",
        category: "Audio",
        connection: "EUCON API",
        priority: "Low",
        status: "Future",
        issue: "",
      },
    ],
  },
  {
    name: "2D Graphics",
    position: { top: 0, left: 16.67, width: 41.67, height: 41.67 },
    color: "bg-black",
    apps: [
      {
        name: "Photoshop",
        category: "2D Graphics",
        connection: "ExtendScript/CEP",
        priority: "High",
        status: "Planned",
        issue: "#1",
      },
      {
        name: "Illustrator",
        category: "2D Graphics",
        connection: "ExtendScript/CEP",
        priority: "Medium",
        status: "Planned",
        issue: "",
      },
      {
        name: "GIMP",
        category: "2D Graphics",
        connection: "Python-Fu",
        priority: "Low",
        status: "Planned",
        issue: "",
      },
      {
        name: "Inkscape",
        category: "2D Graphics",
        connection: "CLI",
        priority: "Low",
        status: "Future",
        issue: "",
      },
      {
        name: "Krita",
        category: "2D Graphics",
        connection: "Python API",
        priority: "Low",
        status: "Future",
        issue: "",
      },
    ],
  },
  {
    name: "Game Engines",
    position: { top: 41.67, left: 16.67, width: 25, height: 58.33 },
    color: "bg-black",
    apps: [
      {
        name: "Unreal Engine",
        category: "Game Dev",
        connection: "Python API",
        priority: "High",
        status: "Planned",
        issue: "#32",
      },
      {
        name: "Unity",
        category: "Game Dev",
        connection: "TCP/C# API",
        priority: "Medium",
        status: "Planned",
        issue: "",
      },
      {
        name: "Godot",
        category: "Game Dev",
        connection: "HTTP/CLI",
        priority: "Medium",
        status: "Planned",
        issue: "",
      },
      {
        name: "GameMaker Studio",
        category: "Game Dev",
        connection: "GML Scripting",
        priority: "Low",
        status: "Future",
        issue: "",
      },
    ],
  },
  {
    name: "Lightfast",
    position: { top: 41.67, left: 41.67, width: 16.67, height: 16.67 },
    color: "bg-black",
    isLogo: true,
  },
  {
    name: "Video & VFX",
    position: { top: 0, left: 58.33, width: 25, height: 58.33 },
    color: "bg-black",
    apps: [
      {
        name: "DaVinci Resolve",
        category: "Video",
        connection: "Python API",
        priority: "High",
        status: "Planned",
        issue: "#30",
      },
      {
        name: "Premiere Pro",
        category: "Video",
        connection: "ExtendScript/CEP",
        priority: "Medium",
        status: "Planned",
        issue: "",
      },
      {
        name: "After Effects",
        category: "Motion Graphics",
        connection: "ExtendScript",
        priority: "Medium",
        status: "Planned",
        issue: "",
      },
      {
        name: "Nuke",
        category: "VFX",
        connection: "Python API",
        priority: "Medium",
        status: "Planned",
        issue: "",
      },
      {
        name: "Final Cut Pro",
        category: "Video",
        connection: "AppleScript",
        priority: "Low",
        status: "Future",
        issue: "",
      },
    ],
  },
  {
    name: "Design Tools",
    position: { top: 0, left: 83.33, width: 16.67, height: 33.33 },
    color: "bg-black",
    apps: [
      {
        name: "Figma",
        category: "Web Design",
        connection: "WebSocket-based",
        priority: "✅",
        status: "Implemented",
        issue: "",
      },
      {
        name: "Sketch",
        category: "Web Design",
        connection: "JavaScript API",
        priority: "Low",
        status: "Future",
        issue: "",
      },
      {
        name: "Canva",
        category: "Web Design",
        connection: "REST API",
        priority: "Low",
        status: "Future",
        issue: "",
      },
    ],
  },
  {
    name: "Interactive & Live",
    position: { top: 33.33, left: 83.33, width: 16.67, height: 66.67 },
    color: "bg-black",
    apps: [
      {
        name: "TouchDesigner",
        category: "Interactive",
        connection: "Socket/Python",
        priority: "High",
        status: "Planned",
        issue: "#35",
      },
      {
        name: "Max/MSP",
        category: "Audio/Interactive",
        connection: "OSC/TCP",
        priority: "Medium",
        status: "Planned",
        issue: "",
      },
      {
        name: "Resolume",
        category: "Live Performance",
        connection: "OSC/Web API",
        priority: "Low",
        status: "Future",
        issue: "",
      },
      {
        name: "Processing",
        category: "Creative Coding",
        connection: "CLI",
        priority: "Low",
        status: "Future",
        issue: "",
      },
    ],
  },
  {
    name: "3D Texturing & CAD",
    position: { top: 58.33, left: 41.67, width: 41.67, height: 41.67 },
    color: "bg-black",
    apps: [
      {
        name: "Substance 3D",
        category: "Materials",
        connection: "SDK/HTTP",
        priority: "Medium",
        status: "Planned",
        issue: "",
      },
      {
        name: "KeyShot",
        category: "3D Rendering",
        connection: "Python API",
        priority: "Low",
        status: "Future",
        issue: "",
      },
      {
        name: "OpenSCAD",
        category: "3D CAD",
        connection: "CLI/File-based",
        priority: "Medium",
        status: "Planned",
        issue: "#2",
      },
    ],
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
    const gap = 4; // 4px gap between items

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
    if (categoryName === "Lightfast") {
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

    // Add gaps based on position
    // Left column items
    if (position.left === 0) {
      width -= gap;
    }
    // Top row items
    if (position.top === 0) {
      height -= gap;
    }
    // Items not on the right edge
    if (position.left + position.width < 100) {
      width -= gap;
    }
    // Items not on the bottom edge
    if (position.top + position.height < 100) {
      height -= gap;
    }

    // Adjust items that touch the center to eliminate gaps
    const touchesCenter = {
      left: position.left + position.width === centerOriginalLeft,
      right: position.left === centerOriginalLeft + centerOriginalSize,
      top: position.top + position.height === centerOriginalTop,
      bottom: position.top === centerOriginalTop + centerOriginalSize,
    };

    // Category 3: Above and to the left of center
    if (categoryName === "2D Graphics") {
      // Adjust right edge to meet Category 9's left edge (at 58.33%)
      width = 58.33 * scaleX - left - gap * 2;
      // Adjust bottom edge to meet center's top edge
      height = centerActualTop - top - gap;
    }
    // Category 4: Left of center
    else if (categoryName === "Game Engines") {
      // Adjust right edge to meet center's left edge
      width = centerActualLeft - left - gap;
      // Top aligns with center's top
      top = centerActualTop;
      // Height extends to bottom
      height = vh - top - gap;
    }
    // Category 8: Below center
    else if (categoryName === "3D Texturing & CAD") {
      // Adjust top to center's bottom
      top = centerActualBottom + gap;
      // Adjust height to fill remaining space
      height = vh - top - gap;
      // Adjust left to center's left
      left = centerActualLeft;
      // Width extends to Category 7's left edge (at 83.33%)
      width = 83.33 * scaleX - left - gap;
    }
    // Category 9: Above and to the right of center
    else if (categoryName === "Video & VFX") {
      // Adjust left edge to meet center's right edge
      left = centerActualRight + gap;
      // Width extends to category 6
      width = 83.33 * scaleX - left - gap;
      // Height extends to center's bottom
      height = centerActualBottom - top - gap;
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
    <section className="w-full bg-neutral-950">
      {/* Header Section */}
      <div className="w-full py-16">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white">
            Works with your
            <span className="text-primary ml-2 italic">favorite tools</span>
          </h2>
        </div>
      </div>

      {/* Integration Grid Section - Full Viewport */}
      <div className="relative h-screen w-screen overflow-hidden bg-neutral-950">
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
                className={`absolute flex items-center justify-center overflow-hidden transition-all duration-300 hover:z-10 ${
                  cat.isLogo
                    ? "shadow-2xl"
                    : "border border-white/10 backdrop-blur-sm"
                } ${cat.color}`}
                style={{
                  width: `${dimensions.width}px`,
                  height: `${dimensions.height}px`,
                  top: `${dimensions.top}px`,
                  left: `${dimensions.left}px`,
                  transform: dimensions.transform,
                }}
              >
                {cat.isLogo ? (
                  <div className="flex h-full w-full flex-col items-center justify-center p-4">
                    <Icons.logoShort className="h-12 w-12 text-white" />
                  </div>
                ) : (
                  <div className="flex h-full w-full flex-col items-start justify-start p-6">
                    <span className="text-5xl font-semibold text-white/90">
                      {cat.name}
                    </span>
                    {cat.apps && (
                      <div className="mt-4 flex flex-col items-start gap-1">
                        <span className="text-sm text-white/70 md:text-base">
                          {cat.apps.length} apps
                        </span>
                        <div className="flex gap-1">
                          {cat.apps.filter(
                            (app) => app.status === "Implemented",
                          ).length > 0 && (
                            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs text-white/90">
                              {
                                cat.apps.filter(
                                  (app) => app.status === "Implemented",
                                ).length
                              }{" "}
                              Live
                            </span>
                          )}
                          {cat.apps.filter((app) => app.status === "Planned")
                            .length > 0 && (
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
                              {
                                cat.apps.filter(
                                  (app) => app.status === "Planned",
                                ).length
                              }{" "}
                              Soon
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
