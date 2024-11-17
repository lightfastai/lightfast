import { createDefaultLimit, createDefaultPerlinNoise3D } from "@repo/webgl";

import { NetworkEditorContext } from "../state/context";

export function useCreateTexture() {
  const state = NetworkEditorContext.useSelector((state) => state);
  const machineRef = NetworkEditorContext.useActorRef();

  const handleTextureCreate = (x: number, y: number) => {
    if (!state.context.selectedTexture) return;

    const baseTexture = {
      id: Date.now(),
      x,
      y,
      inputPos: { x, y },
      outputPos: { x, y },
      shouldRenderInNode: true,
      input: null,
      outputs: [],
    };

    if (state.context.selectedTexture === "Noise") {
      machineRef.send({
        type: "ADD_TEXTURE",
        texture: {
          ...baseTexture,
          type: "Noise",
          uniforms: createDefaultPerlinNoise3D(),
        },
      });
    }

    if (state.context.selectedTexture === "Limit") {
      machineRef.send({
        type: "ADD_TEXTURE",
        texture: {
          ...baseTexture,
          type: "Limit",
          uniforms: createDefaultLimit(),
        },
      });
    }
  };

  return {
    handleTextureCreate,
  };
}
