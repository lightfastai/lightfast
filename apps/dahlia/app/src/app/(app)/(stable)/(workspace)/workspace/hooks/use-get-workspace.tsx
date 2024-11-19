import { RouterOutputs } from "@repo/api";

import { api } from "~/trpc/react";

interface UseGetWorkspaceProps {
  id: RouterOutputs["workspace"]["get"]["id"];
}

export const useGetWorkspace = ({ id }: UseGetWorkspaceProps) => {
  const { data } = api.workspace.get.useQuery({ id });
  return { data };
};
