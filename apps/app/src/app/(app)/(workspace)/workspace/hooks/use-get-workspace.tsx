import { useSuspenseQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "~/trpc/server";
import { useTRPC } from "~/trpc/client/react";

interface UseGetWorkspaceProps {
  id: RouterOutputs["tenant"]["workspace"]["get"]["id"];
  initialData?: RouterOutputs["tenant"]["workspace"]["get"];
}

export const useGetWorkspace = ({ id, initialData }: UseGetWorkspaceProps) => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.tenant.workspace.get.queryOptions({ id }, { initialData }),
  );
  return { data };
};
