"use client";

import { useEffect } from "react";

import type { BaseEdge } from "~/app/(app)/(workspace)/workspace/types/node";
import type { Texture } from "~/db/schema/types/Texture";
import { WebGLView } from "~/app/(app)/(workspace)/workspace/components/webgl/webgl-primitives";
import { useTextureRenderStore } from "~/app/(app)/(workspace)/workspace/providers/texture-render-store-provider";
import { $GeometryType } from "~/db/schema/types";
import { api } from "~/trpc/client/react";
import { GeometryMap } from "../../../../components/webgl/webgl-globals";

interface RenderChainProps {
  firstNodeId: string;
  edges: BaseEdge[];
}

export function RenderChain({ firstNodeId, edges }: RenderChainProps) {
  const { targets, addTarget } = useTextureRenderStore((state) => state);
  const queries = api.useQueries((t) =>
    edges.map((edge) => t.tenant.node.data.get<Texture>({ id: edge.source })),
  );

  // Build the texture chain by walking back from the window node
  useEffect(() => {
    // Walk back through edges to build the texture chain
    const textureChain: string[] = [];
    let currentNodeId = firstNodeId;

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
        // Find the texture data for this node
        const edge = edges.find((e) => e.source === nodeId);
        if (edge) {
          const edgeIndex = edges.findIndex((e) => e.source === nodeId);
          const textureData = queries[edgeIndex]?.data;
          if (textureData) {
            addTarget(nodeId, textureData.resolution);
          }
        }
      }
    });
  }, [edges, firstNodeId, targets, addTarget, queries]);

  const renderTarget = targets[firstNodeId];

  if (!renderTarget) {
    return null;
  }

  return (
    <WebGLView
      style={{
        position: "relative",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
    >
      <mesh geometry={GeometryMap[$GeometryType.Enum.plane]} scale={3}>
        <meshBasicMaterial map={renderTarget.texture} />
      </mesh>
    </WebGLView>
  );
}
