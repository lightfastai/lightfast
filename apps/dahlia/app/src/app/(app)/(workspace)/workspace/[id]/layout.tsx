import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

import { RouterInputs, RouterOutputs } from "@repo/api";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@repo/ui/components/ui/breadcrumb";

import { api, HydrateClient } from "~/trpc/server";
import { $NodeType } from "../../../../../../../../../../packages/db/dist/app/src/schema";
import { EditorCommandDialog } from "../components/app/editor-command-dialog";
import { EditorWorkspaceNameInput } from "../components/app/editor-workspace-name-input";
import { EditorWorkspaceSelect } from "../components/app/editor-workspace-select";
import { TextureRenderPipeline } from "../components/webgl/texture-render-pipeline";
import { EdgeStoreProvider } from "../providers/edge-store-provider";
import { EditorStoreProvider } from "../providers/editor-store-provider";
import { InspectorStoreProvider } from "../providers/inspector-store-provider";
import { NodeStoreProvider } from "../providers/node-store-provider";
import { SelectionStoreProvider } from "../providers/selection-store-provider";
import { TextureRenderStoreProvider } from "../providers/texture-render-store-provider";
import { convertToBaseEdge, convertToBaseNode } from "../types/node";

const WebGLCanvas = dynamic(
  () =>
    import("../components/webgl/webgl-canvas").then((mod) => mod.WebGLCanvas),
  {
    ssr: false,
  },
);

const Inspector = dynamic(
  () =>
    import("../components/inspector/inspector").then((mod) => mod.Inspector),
  {
    ssr: false,
  },
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
  id,
}: RouterInputs["workspace"]["get"]): Promise<
  RouterOutputs["workspace"]["get"] | null
> => {
  const workspace = await api.workspace.get({ id });
  return workspace;
};

/**
 * Get workspace node ids
 * @todo - handle unauthorized and not found errors more gracefully
 */
const getWorkspaceNodeBaseAll = async ({
  workspaceId,
}: RouterInputs["node"]["base"]["getAll"]): Promise<
  RouterOutputs["node"]["base"]["getAll"]
> => {
  const nodes = await api.node.base.getAll({ workspaceId });
  return nodes;
};

/**
 * Get workspace edges
 */
const getWorkspaceEdgeAll = async ({
  workspaceId,
}: RouterInputs["edge"]["getAll"]): Promise<
  RouterOutputs["edge"]["getAll"]
> => {
  const edges = await api.edge.getAll({ workspaceId });
  return edges;
};

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { id } = params;
  const [workspace, nodes, edges] = await Promise.all([
    getWorkspace({ id }),
    getWorkspaceNodeBaseAll({ workspaceId: id }),
    getWorkspaceEdgeAll({ workspaceId: id }),
  ]);

  if (!workspace) {
    notFound();
  }

  /** Prefetch node data using <HydrateClient> (tRPC SSR) & useSuspenseQuery (Tanstack Query) */
  nodes.forEach((node) => {
    void api.node.data.get.prefetch({ id: node.id });
  });

  const baseNodes = convertToBaseNode(nodes);
  const baseEdges = convertToBaseEdge(edges);

  return (
    <div className="relative flex h-screen flex-col">
      <div className="fixed inset-x-20 top-4 z-50 flex w-max items-center">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <EditorWorkspaceSelect />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <EditorWorkspaceNameInput initialWorkspace={workspace} />
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <HydrateClient>
        <NodeStoreProvider initialNodes={baseNodes}>
          <EdgeStoreProvider initialEdges={baseEdges}>
            <SelectionStoreProvider>
              <EditorStoreProvider>
                <TextureRenderStoreProvider
                  initialNodes={baseNodes.filter(
                    (node) => node.type === $NodeType.Enum.texture,
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
                      <TextureRenderPipeline />
                    </WebGLCanvas>
                    {children}
                    <div className="absolute right-4 top-4">
                      <Inspector />
                    </div>
                    <EditorCommandDialog />
                  </InspectorStoreProvider>
                </TextureRenderStoreProvider>
              </EditorStoreProvider>
            </SelectionStoreProvider>
          </EdgeStoreProvider>
        </NodeStoreProvider>
      </HydrateClient>
    </div>
  );
}
