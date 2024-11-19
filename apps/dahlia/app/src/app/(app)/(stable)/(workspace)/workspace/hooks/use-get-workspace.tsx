import { api } from "~/trpc/react";

export const useGetWorkspace = ({ id }: { id: string }) => {
  const { data } = api.workspace.get.useQuery({ id });
  return data;
};
