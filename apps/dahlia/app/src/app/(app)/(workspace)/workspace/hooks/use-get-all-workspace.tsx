import { api } from "~/trpc/react";

export const useGetAllWorkspaces = () => {
  const { data } = api.workspace.getAll.useQuery();
  return data;
};
