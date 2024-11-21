import { RouterInputs, RouterOutputs } from "@repo/api";

import { api } from "~/trpc/react";

interface UseGetWorkspaceNodesProps {
  workspaceId: RouterInputs["node"]["getAllNodeIds"]["workspaceId"];
}

export const useGetWorkspaceNodes = ({
  workspaceId,
}: UseGetWorkspaceNodesProps) => {
  const [data] = api.node.getAllNodeIds.useSuspenseQuery({
    workspaceId,
  });

  const nodeQueries = api.useQueries((t) =>
    data.map((id) => t.node.get({ id, workspaceId })),
  );

  // @ts-expect-error -- TODO: fix this
  const nodes = nodeQueries
    .map((query) => query.data)
    .filter(Boolean) as RouterOutputs["node"]["get"][];

  return { data: nodes };
};
