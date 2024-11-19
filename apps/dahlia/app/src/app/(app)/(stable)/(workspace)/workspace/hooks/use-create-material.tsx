import { DEFAULT_MATERIAL_COLOR } from "~/components/constants";
import { NetworkEditorContext } from "../state/context";

export function useCreateMaterial() {
  const state = NetworkEditorContext.useSelector((state) => state);
  const machineRef = NetworkEditorContext.useActorRef();

  const handleMaterialCreate = (x: number, y: number) => {
    if (!state.context.selectedMaterial) return;

    machineRef.send({
      type: "ADD_MATERIAL",
      material: {
        id: Date.now(),
        inputPos: { x, y },
        outputPos: { x, y },
        type: state.context.selectedMaterial,
        color: DEFAULT_MATERIAL_COLOR,
        x,
        y,
        shouldRenderInNode: true,
      },
    });
  };

  return {
    handleMaterialCreate,
  };
}
