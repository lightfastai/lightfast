import {
  type ListOrgMcpConnectionsResult,
  listOrgMcpConnections,
  revokeOrgMcpConnection,
} from "@api/app/tanstack/mcp-connections";
import { mutationOptions, queryOptions } from "@tanstack/react-query";

export type OrgMcpConnectionListData = ListOrgMcpConnectionsResult;
export type OrgMcpConnection = OrgMcpConnectionListData[number];

export const orgMcpConnectionQueryKeys = {
  all: ["org-mcp-connections"] as const,
  list: () => ["org-mcp-connections", "list"] as const,
};

export function orgMcpConnectionsQueryOptions(input?: {
  enabled?: boolean;
  staleTime?: number;
}) {
  return queryOptions({
    enabled: (input?.enabled ?? true) && typeof window !== "undefined",
    queryFn: () => listOrgMcpConnections(),
    queryKey: orgMcpConnectionQueryKeys.list(),
    staleTime: input?.staleTime,
  });
}

export function revokeOrgMcpConnectionMutationOptions() {
  return mutationOptions({
    meta: { errorTitle: "Failed to revoke MCP connection" },
    mutationFn: (data: { grantId: string }) => revokeOrgMcpConnection({ data }),
  });
}
