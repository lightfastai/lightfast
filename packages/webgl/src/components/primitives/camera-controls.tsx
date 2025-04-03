"use client";

import { createContext, useContext } from "react";
import { Vector3 } from "three";

import {
  CENTER_OF_WORLD,
  WORLD_CAMERA_POSITION_CLOSE,
} from "../../types/geometry";
import { OrbitControls, PerspectiveCamera } from "./webgl-primitives";

// Define a context for camera controls
export interface CameraContextType {
  position: Vector3;
  target: Vector3;
}

export const CameraContext = createContext<CameraContextType>({
  position: new Vector3(
    WORLD_CAMERA_POSITION_CLOSE.x,
    WORLD_CAMERA_POSITION_CLOSE.y,
    WORLD_CAMERA_POSITION_CLOSE.z,
  ),
  target: new Vector3(CENTER_OF_WORLD.x, CENTER_OF_WORLD.y, CENTER_OF_WORLD.z),
});

export const useCameraContext = () => useContext(CameraContext);

export interface DefaultCameraProps {
  position?: Vector3;
}

export const DefaultCamera = ({ position }: DefaultCameraProps) => {
  const defaultPosition = new Vector3(
    WORLD_CAMERA_POSITION_CLOSE.x,
    WORLD_CAMERA_POSITION_CLOSE.y,
    WORLD_CAMERA_POSITION_CLOSE.z,
  );

  return (
    <PerspectiveCamera makeDefault position={position || defaultPosition} />
  );
};

export interface DefaultControlsProps {
  enableDamping?: boolean;
  dampingFactor?: number;
  target?: Vector3;
}

export const DefaultControls = ({
  enableDamping = true,
  dampingFactor = 1.5,
  target,
}: DefaultControlsProps) => {
  const defaultTarget = new Vector3(
    CENTER_OF_WORLD.x,
    CENTER_OF_WORLD.y,
    CENTER_OF_WORLD.z,
  );

  return (
    <OrbitControls
      enableDamping={enableDamping}
      dampingFactor={dampingFactor}
      target={target || defaultTarget}
    />
  );
};
