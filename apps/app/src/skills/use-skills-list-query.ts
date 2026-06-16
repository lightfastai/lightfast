import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

export function useSkillsListQuery() {
  const trpc = useTRPC();
  const options = {
    ...trpc.org.workspace.skills.list.queryOptions(undefined, { staleTime: 0 }),
    enabled: typeof window !== "undefined",
  };

  return { query: useQuery(options), queryKey: options.queryKey };
}
