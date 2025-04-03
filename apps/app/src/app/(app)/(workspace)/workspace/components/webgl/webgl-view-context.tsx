import type { ReactNode } from "react";

import { WebGLView } from "@repo/webgl/components";
import {
  GlobalOrbitControls,
  GlobalPerspectiveCamera,
} from "@repo/webgl/globals";

interface WebGLViewContextProps {
  children: ReactNode;
}

export const WebGLViewContext = ({ children }: WebGLViewContextProps) => {
  return (
    <WebGLView
      style={{
        pointerEvents: "none",
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
    >
      {GlobalPerspectiveCamera}
      {GlobalOrbitControls}
      {children}
    </WebGLView>
  );
};
