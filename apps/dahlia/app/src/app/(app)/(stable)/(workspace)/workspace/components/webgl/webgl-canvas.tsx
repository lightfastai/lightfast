"use client";

import type { CanvasProps } from "@react-three/fiber";
import React from "react";
import { Canvas } from "@react-three/fiber";

export interface WebGLCanvasProps extends CanvasProps {
  children: React.ReactNode;
}

const WebGLCanvas = React.forwardRef<HTMLCanvasElement, WebGLCanvasProps>(
  ({ children, ...props }, ref) => {
    return (
      <Canvas ref={ref} {...props}>
        {children}
      </Canvas>
    );
  },
);

WebGLCanvas.displayName = "WebGLCanvas";
export { WebGLCanvas };
