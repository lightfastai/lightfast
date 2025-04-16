import { forwardRef } from "react";

import type { NodesContainerProps } from "./types";

export const NodesContainer = forwardRef<HTMLDivElement, NodesContainerProps>(
  ({ children, edges }, ref) => {
    return (
      <div
        ref={ref}
        className="relative flex h-full flex-wrap content-center justify-center gap-6 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.1)_1px,transparent_0)] bg-[length:1rem_1rem] p-6 dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.1)_1px,transparent_0)]"
      >
        {/* SVG for edges */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ zIndex: 1 }}
        >
          {edges.map((edge, index) => (
            <line
              key={index}
              x1={edge.fromX}
              y1={edge.fromY}
              x2={edge.toX}
              y2={edge.toY}
              stroke={
                edge.active ? "var(--sidebar-primary)" : "var(--sidebar-border)"
              }
              strokeWidth={edge.active ? 2 : 1}
              strokeDasharray={edge.active ? "none" : "4,4"}
              strokeLinecap="round"
            />
          ))}
        </svg>
        {children}
      </div>
    );
  },
);
