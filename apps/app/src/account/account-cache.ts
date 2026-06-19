import type {
  GitHubAccountStatusResult,
  GitHubUserAccount,
} from "@api/app/tanstack/account";

export type { GitHubAccountStatusResult, GitHubUserAccount };

export const accountProfileQueryKey = ["account", "profile"] as const;
export const accountGitHubAccountQueryKey = ["account", "github"] as const;
export const accountMcpConnectionsQueryKey = [
  "account",
  "mcp-connections",
] as const;
