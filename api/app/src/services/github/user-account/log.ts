import { log } from "@vendor/observability/log/next";

type GitHubUserAccountLogMetadata = Record<string, unknown>;

const GITHUB_USER_ACCOUNT_LOG_PREFIX = "[github-user-account]";

export function logGitHubUserAccountInfo(
  event: string,
  metadata: GitHubUserAccountLogMetadata
) {
  log.info(`${GITHUB_USER_ACCOUNT_LOG_PREFIX} ${event}`, metadata);
}

export function logGitHubUserAccountWarn(
  event: string,
  metadata: GitHubUserAccountLogMetadata
) {
  log.warn(`${GITHUB_USER_ACCOUNT_LOG_PREFIX} ${event}`, metadata);
}
