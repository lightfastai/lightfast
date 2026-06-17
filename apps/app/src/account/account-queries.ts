import {
  createAccountUsername,
  getAccountProfile,
  updateAccountName,
} from "@api/app/tanstack/account";
import {
  listAccountMcpConnections,
  revokeAccountMcpConnection,
} from "@api/app/tanstack/mcp-connections";
import { mutationOptions, queryOptions } from "@tanstack/react-query";

export const accountQueryKeys = {
  all: ["account"] as const,
  mcpConnections: () => ["account", "mcp-connections"] as const,
  profile: () => ["account", "profile"] as const,
};

export function accountProfileQueryOptions(input?: {
  enabled?: boolean;
  staleTime?: number;
}) {
  return queryOptions({
    enabled: (input?.enabled ?? true) && typeof window !== "undefined",
    queryFn: () => getAccountProfile(),
    queryKey: accountQueryKeys.profile(),
    staleTime: input?.staleTime ?? 5 * 60 * 1000,
  });
}

export function updateAccountNameMutationOptions() {
  return mutationOptions({
    meta: { errorTitle: "Failed to update display name" },
    mutationFn: (data: { displayName: string }) => updateAccountName({ data }),
  });
}

export function createAccountUsernameMutationOptions() {
  return mutationOptions({
    meta: { suppressErrorToast: true },
    mutationFn: (data: { idempotencyKey: string; username: string }) =>
      createAccountUsername({ data }),
  });
}

export function accountMcpConnectionsQueryOptions(input?: {
  enabled?: boolean;
  staleTime?: number;
}) {
  return queryOptions({
    enabled: (input?.enabled ?? true) && typeof window !== "undefined",
    queryFn: () => listAccountMcpConnections(),
    queryKey: accountQueryKeys.mcpConnections(),
    staleTime: input?.staleTime,
  });
}

export function revokeAccountMcpConnectionMutationOptions() {
  return mutationOptions({
    meta: { errorTitle: "Failed to revoke MCP connection" },
    mutationFn: (data: { grantId: string }) =>
      revokeAccountMcpConnection({ data }),
  });
}
