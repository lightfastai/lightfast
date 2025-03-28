"use client";

import { useEffect } from "react";

import type { BaseEdge } from "~/app/(app)/(workspace)/workspace/types/node";
import { TextureRenderPipeline } from "~/app/(app)/(workspace)/workspace/components/webgl/texture-render-pipeline";
import { WebGLCanvas } from "~/app/(app)/(workspace)/workspace/components/webgl/webgl-canvas";
import { WebGLView } from "~/app/(app)/(workspace)/workspace/components/webgl/webgl-primitives";
import { useTextureRenderStore } from "~/app/(app)/(workspace)/workspace/providers/texture-render-store-provider";
import { $GeometryType } from "~/db/schema/types";
import { api } from "~/trpc/client/react";
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

    // Add render target for the window node
    if (!targets[params.windowId]) {
      addTarget(params.windowId);
    }
  }, [edges, params.windowId, targets, addTarget]);

  // Get the render target for this window
  const renderTarget = targets[params.windowId];
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
      >
        <TextureRenderPipeline />
        {/* <OrthographicCamera makeDefault position={[0, 0, 1]} zoom={} /> */}
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
    </div>
  );
}
