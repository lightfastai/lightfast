import { notFound } from "next/navigation";

import { RouterInputs, RouterOutputs } from "@repo/api";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@repo/ui/components/ui/breadcrumb";

import { api } from "~/trpc/server";
import { EditorCommandDialog } from "../components/app/editor-command-dialog";
import { EditorWorkspaceNameInput } from "../components/app/editor-workspace-name-input";
import { EditorWorkspaceSelect } from "../components/app/editor-workspace-select";
import { EditorStoreProvider } from "../providers/editor-store-provider";
import { NodeStoreProvider } from "../providers/node-store-provider";
import { SelectionStoreProvider } from "../providers/selection-store-provider";
import { convertToBaseNode } from "../types/node";

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

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { id } = params;
  const [workspace, nodes] = await Promise.all([
    getWorkspace({ id }),
    getWorkspaceNodeBaseAll({ workspaceId: id }),
  ]);

  if (!workspace) {
    notFound();
  }

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

      <NodeStoreProvider initialNodes={convertToBaseNode(nodes)}>
        <SelectionStoreProvider>
          <EditorStoreProvider>
            {children}
            <EditorCommandDialog />
          </EditorStoreProvider>
        </SelectionStoreProvider>
      </NodeStoreProvider>
    </div>
  );
}
