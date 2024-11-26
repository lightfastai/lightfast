"use client";

import type { CanvasProps } from "@react-three/fiber";
import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { PerfHeadless } from "r3f-perf";

export interface WebGLCanvasProps extends CanvasProps {
  children: React.ReactNode;
  showPerformance?: boolean;
}

const WebGLCanvas = React.forwardRef<HTMLCanvasElement, WebGLCanvasProps>(
  ({ children, showPerformance = false, ...props }, ref) => {
    return (
      <>
        <Canvas ref={ref} {...props}>
          {children}
          <Suspense fallback={null}>
            {showPerformance && <PerfHeadless />}
          </Suspense>
        </Canvas>
      </>
    );
  },
);

// Add display names for better debugging
WebGLCanvas.displayName = "WebGLCanvas";

export { WebGLCanvas };
