import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

export function useAutomationsListQuery() {
  const trpc = useTRPC();
  const options = trpc.org.workspace.automations.list.queryOptions(undefined, {
    staleTime: 30_000,
  });

  return useQuery({
    ...options,
    enabled: typeof window !== "undefined",
  });
}
