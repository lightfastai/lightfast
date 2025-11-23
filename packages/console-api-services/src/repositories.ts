import { DeusApiService } from "./base-service";

export class RepositoriesService extends DeusApiService {
  /**
   * Find active repository by GitHub repo ID (for webhooks)
   */
  async findActiveByGithubRepoId(githubRepoId: string) {
    return await this.call(
      "repository.findByGithubRepoId",
      (caller) => caller.repository.findByGithubRepoId({ githubRepoId }),
      {
        fallbackMessage: "Failed to find active repository",
        details: { githubRepoId },
        suppressCodes: ["NOT_FOUND"],
        recover: (error) => {
          if (error.code === "NOT_FOUND") {
            return null;
          }
          throw error;
        },
      },
    );
  }

  /**
   * Mark repository as inactive (for webhooks)
   */
  async markInactive(params: { githubRepoId: string; reason?: string }) {
    return await this.call(
      "repository.updateSyncStatus",
      (caller) =>
        caller.repository.updateSyncStatus({
          githubRepoId: params.githubRepoId,
          isActive: false,
          reason: params.reason,
        }),
      {
        fallbackMessage: "Failed to mark repository inactive",
        details: params,
      },
    );
  }

  /**
   * Mark all repositories for installation as inactive (for webhooks)
   */
  async markInstallationInactive(githubInstallationId: string) {
    return await this.call(
      "repository.markInstallationInactive",
      (caller) => caller.repository.markInstallationInactive({ githubInstallationId }),
      {
        fallbackMessage: "Failed to mark installation repositories inactive",
        details: { githubInstallationId },
      },
    );
  }

  /**
   * Update repository config status (for webhooks)
   */
  async updateConfigStatus(params: {
    githubRepoId: string;
    configStatus: "configured" | "unconfigured";
    configPath: string | null;
  }) {
    return await this.call(
      "repository.updateConfigStatus",
      (caller) => caller.repository.updateConfigStatus(params),
      {
        fallbackMessage: "Failed to update repository config status",
        details: params,
      },
    );
  }
}
