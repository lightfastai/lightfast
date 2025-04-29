import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@repo/ui/components/ui/breadcrumb";
import { $NodeType } from "@vendor/db/lightfast/types";

import type { RouterInputs, RouterOutputs } from "~/trpc/server/index";
import { api, HydrateClient } from "~/trpc/client/server";
import { EditorFileMenu } from "../../components/app/editor-file-menu";
import { EditorWorkspaceNameInput } from "../../components/app/editor-workspace-name-input";
import { EditorWorkspaceListMenu } from "../../components/app/editor-worspace-list-menu";
import { EditorCommandDialog } from "../../components/command-dialog/editor-command-dialog";
import { Debug } from "../../components/webgl/webgl-debug";
import { WebGLTextureRenderPipeline } from "../../components/webgl/webgl-texture-render-pipeline";
import { EdgeStoreProvider } from "../../providers/edge-store-provider";
import { EditorStoreProvider } from "../../providers/editor-store-provider";
import { FileMenuViewProvider } from "../../providers/file-menu-view-provider";
import { InspectorStoreProvider } from "../../providers/inspector-store-provider";
import { NodeStoreProvider } from "../../providers/node-store-provider";
import { SelectionStoreProvider } from "../../providers/selection-store-provider";
import { ShaderCacheStoreProvider } from "../../providers/shader-cache-store-provider";
import { TextureRenderStoreProvider } from "../../providers/texture-render-store-provider";
import { WorkspaceReactFlowProvider } from "../../providers/workspace-react-flow-provider";
import { WorkspaceViewProvider } from "../../providers/workspace-view-provider";
import { convertToBaseEdge } from "../../types/edge";
import { convertToBaseNode } from "../../types/node";

const WebGLCanvas = dynamic(
  () => import("@repo/threejs").then((mod) => mod.WebGLCanvas),
  { ssr: true },
);

const Inspector = dynamic(
  () =>
    import("../../components/inspector/inspector").then((mod) => mod.Inspector),
  { ssr: true },
);

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: {
    id: string;
  };
}

/**
 * Get workspace from params, handling errors
 * @todo - handle unauthorized and not found errors more gracefully
 */
const getWorkspace = async ({
  workspaceId,
}: RouterInputs["tenant"]["workspace"]["get"]): Promise<
  RouterOutputs["tenant"]["workspace"]["get"] | null
> => {
  const workspace = await api.tenant.workspace.get({ workspaceId });
  return workspace;
};

/**
 * Get workspace node ids
 * @todo - handle unauthorized and not found errors more gracefully
 */
const getWorkspaceNodeBaseAll = async ({
  workspaceId,
}: RouterInputs["tenant"]["node"]["base"]["getAll"]): Promise<
  RouterOutputs["tenant"]["node"]["base"]["getAll"]
> => {
  const nodes = await api.tenant.node.base.getAll({ workspaceId });
  return nodes;
};

/**
 * Get workspace edges
 */
const getWorkspaceEdgeAll = async ({
  workspaceId,
}: RouterInputs["tenant"]["edge"]["getAll"]): Promise<
  RouterOutputs["tenant"]["edge"]["getAll"]
> => {
  const edges = await api.tenant.edge.getAll({ workspaceId });
  return edges;
};

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { id } = params;
  const [workspace, nodes, edges] = await Promise.all([
    getWorkspace({ workspaceId: id }),
    getWorkspaceNodeBaseAll({ workspaceId: id }),
    getWorkspaceEdgeAll({ workspaceId: id }),
  ]);

  if (!workspace) {
    notFound();
  }

  /** Prefetch node data using <HydrateClient> (tRPC SSR) & useSuspenseQuery (Tanstack Query) */
  nodes.forEach((node) => {
    void api.tenant.node.data.get.prefetch({ nodeId: node.id });
  });

  const baseNodes = convertToBaseNode(nodes);
  const baseEdges = convertToBaseEdge(edges);

  return (
    <div className="relative flex h-screen flex-col">
      <div className="fixed z-50 p-4">
        <FileMenuViewProvider>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <EditorFileMenu />
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <EditorWorkspaceNameInput initialWorkspace={workspace} />
                <EditorWorkspaceListMenu />
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </FileMenuViewProvider>
      </div>

      <HydrateClient>
        <NodeStoreProvider initialNodes={baseNodes}>
          <EdgeStoreProvider initialEdges={baseEdges}>
            <SelectionStoreProvider>
              <ShaderCacheStoreProvider initialShaders={{}}>
                <EditorStoreProvider>
                  <TextureRenderStoreProvider
                    initialNodes={baseNodes.filter(
                      (node) => node.type === $NodeType.enum.texture,
                    )}
                  >
                    <InspectorStoreProvider>
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
                        showPerformance={true}
                      >
                        <WebGLTextureRenderPipeline />
                      </WebGLCanvas>
                      <WorkspaceReactFlowProvider>
                        <WorkspaceViewProvider>
                          {children}
                          <Debug />
                        </WorkspaceViewProvider>
                      </WorkspaceReactFlowProvider>
                      <div className="absolute top-4 right-4">
                        <Inspector />
                      </div>
                      <EditorCommandDialog />
                    </InspectorStoreProvider>
                  </TextureRenderStoreProvider>
                </EditorStoreProvider>
              </ShaderCacheStoreProvider>
            </SelectionStoreProvider>
          </EdgeStoreProvider>
        </NodeStoreProvider>
      </HydrateClient>
    </div>
  );
}
