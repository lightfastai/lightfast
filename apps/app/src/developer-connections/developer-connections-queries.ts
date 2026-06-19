import { listDeveloperConnections } from "@api/app/tanstack/developer-connections";
import { queryOptions } from "@tanstack/react-query";

export const developerConnectionQueryKeys = {
  all: ["developer-connections"] as const,
  list: () => ["developer-connections", "list"] as const,
};

export function developerConnectionsQueryOptions(input?: {
  staleTime?: number;
}) {
  return queryOptions({
    queryFn: () => listDeveloperConnections(),
    queryKey: developerConnectionQueryKeys.list(),
    staleTime: input?.staleTime,
  });
}
