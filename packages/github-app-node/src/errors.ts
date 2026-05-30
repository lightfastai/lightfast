export type GitHubAppNodeErrorCode =
  | "GITHUB_OAUTH_EXCHANGE_FAILED"
  | "GITHUB_OAUTH_REFRESH_TOKEN_INVALID"
  | "GITHUB_OAUTH_REVOKE_FAILED"
  | "GITHUB_USER_NOT_VERIFIED"
  | "INSTALLATION_NOT_VERIFIED"
  | "PERSONAL_ACCOUNT_NOT_SUPPORTED";

export class GitHubAppNodeError extends Error {
  constructor(
    readonly code: GitHubAppNodeErrorCode,
    message: string
  ) {
    super(message);
    this.name = "GitHubAppNodeError";
  }
}
