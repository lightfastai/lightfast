import { Suspense } from "react";
import { notFound } from "next/navigation";

import type { BaseEdge } from "~/app/(app)/(workspace)/workspace/types/node";
import { WebGLCanvas } from "~/app/(app)/(workspace)/workspace/components/webgl/webgl-canvas";
import { api } from "~/trpc/client/server";
import { EdgeStoreProvider } from "../../../../providers/edge-store-provider";
import { TextureRenderStoreProvider } from "../../../../providers/texture-render-store-provider";
import { convertToBaseEdge, convertToBaseNode } from "../../../../types/node";
import { RenderChain } from "./render-chain";

interface WindowPageProps {
  params: {
    id: string;
    windowId: string;
  };
}

export default async function WindowPage({ params }: WindowPageProps) {
  // Fetch nodes and edges on the server
  const [nodes, edges] = await Promise.all([
    api.tenant.node.base.getAll({
      workspaceId: params.id,
    }),
    api.tenant.edge.getAll({
      workspaceId: params.id,
    }),
  ]);

  // Convert to base types
  const baseNodes = convertToBaseNode(nodes);
  const baseEdges = convertToBaseEdge(edges);

  // Find the edge connected to this window
  const windowEdge = baseEdges.find(
    (edge: BaseEdge) => edge.target === params.windowId,
  );

  if (!windowEdge) {
    return notFound();
  }

  return (
    <div className="relative flex h-screen flex-col">
      <TextureRenderStoreProvider initialNodes={baseNodes}>
        <EdgeStoreProvider initialEdges={baseEdges}>
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
            <div className="h-screen w-screen border">
              {/* <TextureRenderPipeline /> */}
            </div>
          </WebGLCanvas>

          <div className="h-screen w-screen border">
            <Suspense fallback={<div>Loading...</div>}>
              <RenderChain firstNodeId={windowEdge.source} edges={baseEdges} />
            </Suspense>
          </div>
        </EdgeStoreProvider>
      </TextureRenderStoreProvider>
    </div>
  );
}
