import {
  type GitHubAccountStatusResult,
  type GitHubUserAccount,
  getAccountProfile,
  getGitHubAccountStatus,
} from "@api/app/tanstack/account";
import { listAccountMcpConnections } from "@api/app/tanstack/mcp-connections";
import { queryOptions } from "@tanstack/react-query";

export const accountQueryKeys = {
  all: ["account"] as const,
  githubAccount: () => ["account", "github"] as const,
  mcpConnections: () => ["account", "mcp-connections"] as const,
  profile: () => ["account", "profile"] as const,
};

export type { GitHubAccountStatusResult, GitHubUserAccount };

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

export function githubAccountStatusQueryOptions(input?: {
  enabled?: boolean;
  staleTime?: number;
}) {
  return queryOptions({
    enabled: (input?.enabled ?? true) && typeof window !== "undefined",
    queryFn: () => getGitHubAccountStatus(),
    queryKey: accountQueryKeys.githubAccount(),
    staleTime: input?.staleTime ?? 5 * 60 * 1000,
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
