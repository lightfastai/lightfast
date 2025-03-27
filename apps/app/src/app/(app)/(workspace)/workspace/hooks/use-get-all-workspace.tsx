import { api } from "~/trpc/react";

export const useGetAllWorkspaces = () => {
  const { data } = api.tenant.workspace.getAll.useQuery();
  return data;
};
