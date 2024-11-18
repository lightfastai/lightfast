import {
  DEFAULT_POSITION,
  DEFAULT_ROTATION,
  DEFAULT_SCALE,
} from "~/components/constants";
import { NetworkEditorContext } from "../state/context";

export const useGetGeometry = ({ geometryId }: { geometryId: number }) => {
  const geometry = NetworkEditorContext.useSelector((state) =>
    state.context.geometries.find((g) => g.id === geometryId),
  );

  return {
    position: DEFAULT_POSITION,
    scale: DEFAULT_SCALE,
    rotation: DEFAULT_ROTATION,
    wireframe: false,
    type: "Box",
    material: null,
    shouldRenderInNode: true,
    inputPos: { x: 0, y: 0 },
    outputPos: { x: 0, y: 0 },
  };

  return { geometry };
};
