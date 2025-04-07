"use client";

import { Vector3 } from "three";

import { DefaultCamera, DefaultControls } from "../primitives/camera-controls";

// Legacy components for backward compatibility
export const GlobalPerspectiveCamera = (
  <DefaultCamera position={new Vector3(5, 2, 5)} />
);

export const GlobalOrbitControls = (
  <DefaultControls
    enableDamping
    dampingFactor={1.5}
    target={new Vector3(0, 0, 0)}
  />
);
