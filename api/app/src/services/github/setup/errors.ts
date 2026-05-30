import { OrgSourceControlBindingConflictError } from "@db/app";
import type { GitHubBindErrorCode } from "@repo/github-app-contract";
import { GitHubAppNodeError } from "@repo/github-app-node";

import { ClerkOrgMembershipAccessError } from "../../../auth/clerk-org-membership";

export function isUnauthenticatedSetupError(error: unknown): boolean {
  return (
    error instanceof ClerkOrgMembershipAccessError &&
    error.code === "UNAUTHENTICATED"
  );
}

export function mapGitHubSetupError(error: unknown): GitHubBindErrorCode {
  if (error instanceof ClerkOrgMembershipAccessError) {
    return "permission_required";
  }

  if (error instanceof OrgSourceControlBindingConflictError) {
    return error.code === "INSTALLATION_ALREADY_BOUND"
      ? "installation_already_bound"
      : "org_already_bound";
  }

  if (error instanceof GitHubAppNodeError) {
    switch (error.code) {
      case "INSTALLATION_NOT_VERIFIED":
        return "installation_not_verified";
      case "PERSONAL_ACCOUNT_NOT_SUPPORTED":
        return "personal_account_not_supported";
      case "GITHUB_OAUTH_EXCHANGE_FAILED":
        return "github_transient_error";
      default:
        return "github_transient_error";
    }
  }

  return "github_transient_error";
}
