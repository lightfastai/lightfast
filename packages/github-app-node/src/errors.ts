export type GitHubAppNodeErrorCode =
  | "GITHUB_API_REQUEST_FAILED"
  | "GITHUB_API_RESPONSE_INVALID"
  | "GITHUB_OAUTH_EXCHANGE_FAILED"
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
