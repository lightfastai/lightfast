"use client";

import type { CanvasProps } from "@react-three/fiber";
import React from "react";

import { WebGLCanvas as WebGLPackageCanvas } from "@repo/webgl/components";

export interface WebGLCanvasProps extends CanvasProps {
  children: React.ReactNode;
  showPerformance?: boolean;
}

// Re-export the WebGLCanvas component from the webgl package
// with the same API to maintain compatibility
const WebGLCanvas = React.forwardRef<HTMLCanvasElement, WebGLCanvasProps>(
  ({ children, showPerformance = false, ...props }, ref) => {
    return (
      <WebGLPackageCanvas
        ref={ref}
        showPerformance={showPerformance}
        {...props}
      >
        {children}
      </WebGLPackageCanvas>
    );
  },
);

// Add display names for better debugging
WebGLCanvas.displayName = "WebGLCanvas";

export { WebGLCanvas };
