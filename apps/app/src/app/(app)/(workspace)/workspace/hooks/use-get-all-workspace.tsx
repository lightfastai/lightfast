import { api } from "~/trpc/client/react";

export const useGetAllWorkspaces = () => {
  const { data } = api.tenant.workspace.getAll.useQuery();
  return data;
};
