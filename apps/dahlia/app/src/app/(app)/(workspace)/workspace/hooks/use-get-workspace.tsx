import { RouterOutputs } from "@repo/api";

import { api } from "~/trpc/react";

interface UseGetWorkspaceProps {
  id: RouterOutputs["workspace"]["get"]["id"];
  initialData?: RouterOutputs["workspace"]["get"];
}

export const useGetWorkspace = ({ id, initialData }: UseGetWorkspaceProps) => {
  const { data } = api.workspace.get.useQuery({ id }, { initialData });
  return { data };
};
