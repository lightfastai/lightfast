"use client";

import { useEffect } from "react";

import type { BaseEdge } from "~/app/(app)/(workspace)/workspace/types/node";
import { TextureRenderPipeline } from "~/app/(app)/(workspace)/workspace/components/webgl/texture-render-pipeline";
import { WebGLCanvas } from "~/app/(app)/(workspace)/workspace/components/webgl/webgl-canvas";
import { WebGLView } from "~/app/(app)/(workspace)/workspace/components/webgl/webgl-primitives";
import { useTextureRenderStore } from "~/app/(app)/(workspace)/workspace/providers/texture-render-store-provider";
import { $GeometryType } from "~/db/schema/types";
import { api } from "~/trpc/client/react";
import { Inspector } from "../../../components/inspector/inspector";
import { GeometryMap } from "../../../components/webgl/webgl-globals";

interface WindowPageProps {
  params: {
    id: string;
    windowId: string;
  };
}

export default function WindowPage({ params }: WindowPageProps) {
  const { targets, addTarget } = useTextureRenderStore((state) => state);

  // Fetch all edges for this workspace
  const { data: edges } = api.tenant.edge.getAll.useQuery({
    workspaceId: params.id,
  });

  // Build the texture chain by walking back from the window node
  useEffect(() => {
    if (!edges) return;

    // Find the edge connected to this window
    const windowEdge = edges.find(
      (edge: BaseEdge) => edge.target === params.windowId,
    );
    if (!windowEdge) return;

    // Walk back through edges to build the texture chain
    const textureChain: string[] = [];
    let currentNodeId = windowEdge.source;

    while (true) {
      textureChain.push(currentNodeId);
      const incomingEdge = edges.find(
        (edge: BaseEdge) => edge.target === currentNodeId,
      );
      if (!incomingEdge) break;
      currentNodeId = incomingEdge.source;
    }

    // Add render targets for each node in the chain
    textureChain.forEach((nodeId) => {
      if (!targets[nodeId]) {
        addTarget(nodeId);
      }
    });
  }, [edges, params.windowId, targets, addTarget]);

  // Get the render target for the first node in the chain
  const windowEdge = edges?.find(
    (edge: BaseEdge) => edge.target === params.windowId,
  );
  const firstNodeId = windowEdge?.source;
  const renderTarget = firstNodeId ? targets[firstNodeId] : null;

  if (!renderTarget) {
    return null;
  }

  return (
    <div className="relative flex h-screen flex-col">
      <WebGLCanvas
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 1,
        }}
        showPerformance={true}
      >
        <TextureRenderPipeline />
      </WebGLCanvas>

      <div className="h-screen w-screen border">
        <WebGLView
          style={{
            position: "relative",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        >
          <mesh geometry={GeometryMap[$GeometryType.Enum.plane]}>
            <meshBasicMaterial map={renderTarget.texture} />
          </mesh>
        </WebGLView>
      </div>
      <div className="absolute right-4 top-4">
        <Inspector />
      </div>
    </div>
  );
}
