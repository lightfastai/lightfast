import { RouterInputs } from "@repo/api";

import { api } from "~/trpc/react";

interface UseGetWorkspaceNodesProps {
  workspaceId: RouterInputs["node"]["getAllNodes"]["workspaceId"];
}

export const useGetWorkspaceNodes = ({
  workspaceId,
}: UseGetWorkspaceNodesProps) => {
  const [data] = api.node.getAllNodes.useSuspenseQuery({
    workspaceId,
  });
  return { data };
};
