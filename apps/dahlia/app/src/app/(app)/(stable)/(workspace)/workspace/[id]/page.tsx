import { RouterInputs } from "@repo/api";

import { TextureRenderPipeline } from "../components/webgl/texture-render-pipeline";
import { WebGLCanvas } from "../components/webgl/webgl-canvas";
import { Workspace } from "../components/workspace/workspace";
import { WorkspaceProvider } from "../providers/workspace-provider";

interface WorkspacePageProps {
  params: {
    id: RouterInputs["workspace"]["get"]["id"];
  };
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = params;
  return (
    <>
      <WebGLCanvas
        style={{
          position: "absolute",
          pointerEvents: "none",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 1,
        }}
      >
        <TextureRenderPipeline />
      </WebGLCanvas>
      <WorkspaceProvider>
        <Workspace params={{ id }} />
      </WorkspaceProvider>
    </>
  );
}
