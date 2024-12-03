import { RouterOutputs } from "@dahlia/trpc";

import { api } from "~/trpc/react";

interface UseGetWorkspaceProps {
  id: RouterOutputs["tenant"]["workspace"]["get"]["id"];
  initialData?: RouterOutputs["tenant"]["workspace"]["get"];
}

export const useGetWorkspace = ({ id, initialData }: UseGetWorkspaceProps) => {
  const { data } = api.tenant.workspace.get.useQuery({ id }, { initialData });
  return { data };
};
