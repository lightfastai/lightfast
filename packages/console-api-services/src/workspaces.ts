import { DeusApiService } from "./base-service";

export class WorkspacesService extends DeusApiService {
  /**
   * Resolve workspace from GitHub organization slug
   * Used by webhooks to map GitHub events to workspaces
   *
   * Returns workspace ID (UUID), workspace key (ws-<slug>), and slug
   */
  async resolveFromGithubOrgSlug(githubOrgSlug: string) {
    return await this.call(
      "workspace.resolveFromGithubOrgSlug",
      (caller) => caller.workspace.resolveFromGithubOrgSlug({ githubOrgSlug }),
      {
        fallbackMessage: `Failed to resolve workspace from GitHub org slug: ${githubOrgSlug}`,
        details: { githubOrgSlug },
      },
    );
  }
}
