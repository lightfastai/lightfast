import { Vector3 } from "three";

import {
  CENTER_OF_WORLD,
  WORLD_CAMERA_POSITION_CLOSE,
} from "../../stores/constants";
import { OrbitControls, PerspectiveCamera } from "./webgl-primitives";

export const GlobalPerspectiveCamera = (
  <PerspectiveCamera
    makeDefault
    position={
      new Vector3(
        WORLD_CAMERA_POSITION_CLOSE.x,
        WORLD_CAMERA_POSITION_CLOSE.y,
        WORLD_CAMERA_POSITION_CLOSE.z,
      )
    }
  />
);

export const GlobalOrbitControls = (
  <OrbitControls
    enableDamping
    dampingFactor={1.5}
    target={
      new Vector3(CENTER_OF_WORLD.x, CENTER_OF_WORLD.y, CENTER_OF_WORLD.z)
    }
  />
);
