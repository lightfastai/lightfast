import { DeusApiService } from "./base-service";

export class RepositoriesService extends DeusApiService {
  /**
   * Find active repository by GitHub repo ID (for webhooks)
   */
  async findActiveByGithubRepoId(githubRepoId: string) {
    return await this.call(
      "repository.findActiveByGithubRepoId",
      (caller) => caller.repository.findActiveByGithubRepoId({ githubRepoId }),
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
  async markInactive(params: { githubRepoId: string; githubInstallationId?: string }) {
    return await this.call(
      "repository.markInactive",
      (caller) => caller.repository.markInactive(params),
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
   * Update repository metadata (for webhooks)
   */
  async updateMetadata(githubRepoId: string, metadata: Record<string, unknown>) {
    return await this.call(
      "repository.updateMetadata",
      (caller) => caller.repository.updateMetadata({ githubRepoId, metadata }),
      {
        fallbackMessage: "Failed to update repository metadata",
        details: { githubRepoId, metadata },
      },
    );
  }

  /**
   * Mark repository as deleted (for webhooks)
   */
  async markDeleted(githubRepoId: string) {
    return await this.call(
      "repository.markDeleted",
      (caller) => caller.repository.markDeleted({ githubRepoId }),
      {
        fallbackMessage: "Failed to mark repository as deleted",
        details: { githubRepoId },
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
    workspaceId: string;
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
