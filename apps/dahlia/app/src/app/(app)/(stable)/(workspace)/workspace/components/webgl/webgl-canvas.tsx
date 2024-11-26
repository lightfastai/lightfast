"use client";

import type { CanvasProps } from "@react-three/fiber";
import React from "react";
import dynamic from "next/dynamic";
import { Canvas } from "@react-three/fiber";

const WebGLPerf = dynamic(() => import("r3f-perf").then((mod) => mod.Perf), {
  ssr: false,
});
export interface WebGLCanvasProps extends CanvasProps {
  children: React.ReactNode;
  showPerf?: boolean;
}

const WebGLCanvas = React.forwardRef<HTMLCanvasElement, WebGLCanvasProps>(
  ({ children, showPerf = false, ...props }, ref) => {
    return (
      <Canvas ref={ref} {...props}>
        {showPerf && <WebGLPerf position="top-right" />}
        {children}
      </Canvas>
    );
  },
);

WebGLCanvas.displayName = "WebGLCanvas";
export { WebGLCanvas };
