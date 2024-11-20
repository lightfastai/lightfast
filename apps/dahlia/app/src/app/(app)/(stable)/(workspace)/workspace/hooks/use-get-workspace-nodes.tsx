import { RouterInputs } from "@repo/api";

import { api } from "~/trpc/react";

interface UseGetWorkspaceNodesProps {
  id: RouterInputs["workspace"]["getNodes"]["id"];
}

export const useGetWorkspaceNodes = ({ id }: UseGetWorkspaceNodesProps) => {
  const { data, isLoading } = api.workspace.getAllNodes.useQuery({ id });
  return { data, isLoading };
};
