export type GitHubAppNodeErrorCode =
  | "GITHUB_API_REQUEST_FAILED"
  | "GITHUB_API_RESPONSE_INVALID"
  | "GITHUB_BLOB_DECODE_FAILED"
  | "GITHUB_BLOB_NOT_FOUND"
  | "GITHUB_OAUTH_EXCHANGE_FAILED"
  | "GITHUB_OAUTH_REFRESH_TOKEN_INVALID"
  | "GITHUB_OAUTH_REVOKE_FAILED"
  | "GITHUB_REF_NOT_FOUND"
  | "GITHUB_USER_NOT_VERIFIED"
  | "GITHUB_REPOSITORY_INACCESSIBLE"
  | "GITHUB_REPOSITORY_NOT_FOUND"
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
