"use client";

import { PropertyInspector } from "./components/inspector/property-inspector";
import { TextureRenderPipeline } from "./components/webgl/texture-render-pipeline";
import { WebGLCanvas } from "./components/webgl/webgl-canvas";
import { useCreateGeometry } from "./hooks/use-create-geometry";
import { useCreateMaterial } from "./hooks/use-create-material";
import { useCreateTexture } from "./hooks/use-create-texture";
import { useDeleteSelected } from "./hooks/use-delete-selected";
import { NetworkEditorContext } from "./state/context";

export default function Page() {
  const state = NetworkEditorContext.useSelector((state) => state);
  const machineRef = NetworkEditorContext.useActorRef();

  const { handleGeometryCreate } = useCreateGeometry();
  const { handleMaterialCreate } = useCreateMaterial();
  const { handleTextureCreate } = useCreateTexture();
  const { handleDeleteSelectedNodes } = useDeleteSelected();

  return (
    <main className="relative flex-1 overflow-hidden">
      {/* <Workspace debug /> */}
      <PropertyInspector />
      <WebGLCanvas
        shadows
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: -1,
        }}
      >
        <TextureRenderPipeline />
      </WebGLCanvas>
    </main>
  );
}
