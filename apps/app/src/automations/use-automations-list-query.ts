import { useQuery } from "@tanstack/react-query";
import { automationsListQueryOptions } from "./automations-queries";

export function useAutomationsListQuery() {
  return useQuery(
    automationsListQueryOptions({
      enabled: typeof window !== "undefined",
      staleTime: 30_000,
    })
  );
}
