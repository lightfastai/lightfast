import { UserSourceControlAccountConflictError } from "@db/app";
import type { GitHubUserAccountBindErrorCode } from "@lightfast/connector-github/contract";
import { GitHubAppNodeError } from "@lightfast/connector-github/node";

export function mapGitHubUserAccountError(
  error: unknown
): GitHubUserAccountBindErrorCode {
  if (error instanceof UserSourceControlAccountConflictError) {
    return error.code === "PROVIDER_USER_ALREADY_BOUND"
      ? "github_account_already_bound"
      : "lightfast_user_already_bound";
  }

  if (error instanceof GitHubAppNodeError) {
    return error.code === "GITHUB_USER_NOT_VERIFIED"
      ? "github_user_not_verified"
      : "github_transient_error";
  }

  return "github_transient_error";
}
