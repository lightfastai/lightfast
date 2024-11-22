import { RouterInputs } from "@repo/api";

import { api, HydrateClient } from "~/trpc/server";
import { EditorCommandDialog } from "../components/app/editor-command-dialog";
import { Workspace } from "../components/workspace/workspace";
import { WorkspaceProvider } from "../components/workspace/workspace-provider";
import { EditorStoreProvider } from "../providers/editor-store-provider";
import { SelectionStoreProvider } from "../providers/selection-store-provider";

interface WorkspacePageProps {
  params: {
    id: RouterInputs["workspace"]["get"]["id"];
  };
}

const getWorkspaceNodes = async ({
  id,
}: RouterInputs["workspace"]["get"] & { id: string }) => {
  const nodes = await api.node.getAllNodeIds({ workspaceId: id });
  return nodes;
};

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { id } = params;
  const nodes = await getWorkspaceNodes({ id });
  nodes.forEach((nodeId) => {
    void api.node.get.prefetch({ id: nodeId });
    void api.node.getData.prefetch({ id: nodeId });
  });
  return (
    <HydrateClient>
      <SelectionStoreProvider>
        <EditorStoreProvider>
          <WorkspaceProvider>
            <Workspace params={{ id, initialNodeIds: nodes }} />
            <EditorCommandDialog />
          </WorkspaceProvider>
        </EditorStoreProvider>
      </SelectionStoreProvider>
    </HydrateClient>
  );
}
