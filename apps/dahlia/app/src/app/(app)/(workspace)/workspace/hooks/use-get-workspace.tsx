import { RouterOutputs } from "@repo/api";

import { api } from "~/trpc/react";

interface UseGetWorkspaceProps {
  id: RouterOutputs["workspace"]["get"]["id"];
  initialData?: RouterOutputs["workspace"]["get"];
}

export const useGetWorkspace = ({ id, initialData }: UseGetWorkspaceProps) => {
  const { data } = api.tenant.workspaceget.useQuery({ id }, { initialData });
  return { data };
};
