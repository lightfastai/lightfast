import {
  DEFAULT_POSITION,
  DEFAULT_ROTATION,
  DEFAULT_SCALE,
} from "~/components/constants";
import { NetworkEditorContext } from "../state/context";

export function useCreateGeometry() {
  const state = NetworkEditorContext.useSelector((state) => state);
  const machineRef = NetworkEditorContext.useActorRef();

  const handleGeometryCreate = (x: number, y: number) => {
    if (!state.context.selectedGeometry) return;

    machineRef.send({
      type: "ADD_GEOMETRY",
      geometry: {
        id: Date.now(),
        type: state.context.selectedGeometry,
        position: DEFAULT_POSITION,
        scale: DEFAULT_SCALE,
        rotation: DEFAULT_ROTATION,
        inputPos: { x, y },
        outputPos: { x, y },
        x,
        y,
        wireframe: false,
        material: null,
        shouldRenderInNode: true,
      },
    });
  };

  return {
    handleGeometryCreate,
  };
}
