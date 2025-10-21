"use client";

import { useState } from "react";
import { Icons } from "@repo/ui/components/icons";

export function ManifestoGrid() {
  // More sparse content distribution with random positioning hints
  const manifestoContent = [
    // Row 1
    { text: ["MCP-FIRST"], align: "start", hover: "translate" },
    { text: [], align: "center", hover: "none" },
    { text: [], align: "center", hover: "none" },
    { text: ["AI-NATIVE", "WORKFLOWS"], align: "end", hover: "scale" },
    { text: [], align: "center", hover: "none" },
    { text: [], align: "center", hover: "none" },
    { text: ["UNIVERSAL", "LANGUAGE"], align: "center", hover: "rotate" },
    { text: [], align: "center", hover: "none" },
    { text: [], align: "center", hover: "none" },
    { text: ["CONTEXT", "OVER", "CONFIG"], align: "start", hover: "translate" },
    { text: [], align: "center", hover: "none" },
    { text: ["SECURITY", "BY DESIGN"], align: "end", hover: "scale" },
    // Row 2
    { text: [], align: "center", hover: "none" },
    { text: ["MARKETPLACE"], align: "center", hover: "float" },
    { text: [], align: "center", hover: "none" },
    { text: [], align: "center", hover: "none" },
    { text: ["AI-", "ORCHESTRABLE"], align: "end", hover: "translate" },
    { text: [], align: "center", hover: "none" },
    { text: ["MAKE EVERY", "WORKFLOW"], align: "start", hover: "scale" },
    { text: [], align: "center", hover: "none" },
    { text: [], align: "center", hover: "none" },
    { text: ["CONVERSATIONAL"], align: "center", hover: "rotate" },
    { text: [], align: "center", hover: "none" },
    { text: [], align: "center", hover: "none" },
    // Row 3
    { text: [], align: "center", hover: "none" },
    { text: ["WORKFLOW", "ENGINE"], align: "end", hover: "translate" },
    { text: [], align: "center", hover: "none" },
    { text: ["SANDBOX", "EXECUTION"], align: "start", hover: "scale" },
    { text: [], align: "center", hover: "none" },
    { text: [], align: "center", hover: "none" },
    {
      text: ["PRODUCTION", "IS THE", "BENCHMARK"],
      align: "center",
      hover: "float",
    },
    { text: [], align: "center", hover: "none" },
    { text: ["MULTI-", "AGENT"], align: "end", hover: "rotate" },
    { text: [], align: "center", hover: "none" },
    { text: [], align: "center", hover: "none" },
    { text: ["JARVIS FOR", "EVERYONE"], align: "start", hover: "scale" },
  ];

  const [hoveredCell, setHoveredCell] = useState<number | null>(null);

  // Get alignment classes
  const getAlignmentClass = (align: string) => {
    switch (align) {
      case "start":
        return "items-start justify-start";
      case "end":
        return "items-end justify-end";
      default:
        return "items-center justify-center";
    }
  };

  // Get hover animation classes
  const getHoverClass = (hover: string, isHovered: boolean) => {
    if (!isHovered) return "";

    switch (hover) {
      case "translate":
        return "translate-x-1 -translate-y-1";
      case "scale":
        return "scale-110";
      case "rotate":
        return "rotate-3 scale-105";
      case "float":
        return "-translate-y-2 scale-105";
      default:
        return "";
    }
  };

  return (
    <div className="w-full h-full relative bg-background">
      {/* Grid Container - 12 columns, 3 rows */}
      <div className="grid grid-cols-12 gap-0 border border-border w-full h-full">
        {manifestoContent.map((cell, i) => {
          const hasContent = cell.text.length > 0;
          const isHovered = hoveredCell === i;

          return (
            <div
              key={`cell-${i}`}
              className={`col-span-1 border-r border-b border-border transition-all duration-300 p-3 flex hover:bg-accent/50 ${getAlignmentClass(
                cell.align,
              )} ${hasContent ? "cursor-pointer" : ""}`}
              onMouseEnter={() => hasContent && setHoveredCell(i)}
              onMouseLeave={() => setHoveredCell(null)}
            >
              {hasContent && (
                <p
                  className={`text-xs leading-tight text-foreground/70 uppercase transition-all duration-300 ${getHoverClass(
                    cell.hover,
                    isHovered,
                  )}`}
                  style={{
                    textAlign:
                      cell.align === "start"
                        ? "left"
                        : cell.align === "end"
                          ? "right"
                          : "center",
                  }}
                >
                  {cell.text.map((line, idx) => (
                    <span key={idx} className="block">
                      {line}
                    </span>
                  ))}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Logo Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Icons.logo className="w-1/6 h-auto text-foreground" />
      </div>
    </div>
  );
}
