import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/client/react";

export const useGetAllWorkspaces = () => {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.tenant.workspace.getAll.queryOptions());
  return data;
};
