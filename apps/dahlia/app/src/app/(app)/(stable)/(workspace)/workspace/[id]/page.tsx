"use client";

import { PropertyInspector } from "../components/inspector/property-inspector";
import { TextureRenderPipeline } from "../components/webgl/texture-render-pipeline";
import { WebGLCanvas } from "../components/webgl/webgl-canvas";
import { Workspace } from "../components/workspace/workspace";
import { useGetWorkspace } from "../hooks/use-get-workspace";

interface WorkspacePageProps {
  params: {
    id: string;
  };
}

export default function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = params;
  const workspace = useGetWorkspace({ id });
  return (
    <main className="relative flex-1 overflow-hidden">
      <Workspace debug />
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
