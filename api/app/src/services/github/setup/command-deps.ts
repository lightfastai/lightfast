import type { Database } from "@db/app";
import { buildGitHubInstallationUrl } from "@lightfast/connector-github/node";

import {
  getOrgAccessBySlug,
  isOrgAccessError,
} from "../../../auth/organization-access";
import type { GitHubSetupCommandDeps } from "../../../domain/github-setup";
import { getGitHubAppConfig } from "../config";
import { issueGitHubInstallAttempt } from "./attempts";
import { syncGitHubBindingClaim } from "./flow";
import { verifyGitHubLightfastRepositorySetup } from "./lightfast-repository";

type GitHubSetupCommandDepOverrides = Partial<
  Omit<GitHubSetupCommandDeps, "db">
>;

export function createDefaultGitHubSetupCommandDeps(
  input: { db: Database } & GitHubSetupCommandDepOverrides
): GitHubSetupCommandDeps {
  return {
    buildGitHubInstallationUrl:
      input.buildGitHubInstallationUrl ?? buildGitHubInstallationUrl,
    db: input.db,
    getGitHubAppConfig: input.getGitHubAppConfig ?? getGitHubAppConfig,
    getOrgAccessBySlug: input.getOrgAccessBySlug ?? getOrgAccessBySlug,
    isOrgAccessError: input.isOrgAccessError ?? isOrgAccessError,
    issueGitHubInstallAttempt:
      input.issueGitHubInstallAttempt ?? issueGitHubInstallAttempt,
    syncGitHubBindingClaim:
      input.syncGitHubBindingClaim ?? syncGitHubBindingClaim,
    verifyGitHubLightfastRepositorySetup:
      input.verifyGitHubLightfastRepositorySetup ??
      verifyGitHubLightfastRepositorySetup,
  };
}
