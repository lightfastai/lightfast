import type { ReactNode } from "react";

import {
  GlobalOrbitControls,
  GlobalPerspectiveCamera,
  WebGLView,
} from "@repo/threejs";

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
