import { DeusApiService } from "./base-service";

/**
 * Sources Service
 *
 * Service wrapper for workspace source operations across all providers.
 * Currently supports GitHub repository operations for webhooks.
 *
 * Future: Will include Linear, Notion, Sentry source operations.
 */
export class SourcesService extends DeusApiService {
  /**
   * Find active repository by GitHub repo ID (for webhooks)
   */
  async findActiveByGithubRepoId(githubRepoId: string) {
    return await this.call(
      "sources.findByGithubRepoId",
      (caller) => caller.sources.findByGithubRepoId({ githubRepoId }),
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
      "sources.updateGithubSyncStatus",
      (caller) =>
        caller.sources.updateGithubSyncStatus({
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
      "sources.markGithubInstallationInactive",
      (caller) => caller.sources.markGithubInstallationInactive({ githubInstallationId }),
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
      "sources.updateGithubConfigStatus",
      (caller) => caller.sources.updateGithubConfigStatus(params),
      {
        fallbackMessage: "Failed to update repository config status",
        details: params,
      },
    );
  }

  /**
   * Mark repository as deleted (for webhooks)
   */
  async markDeleted(githubRepoId: string) {
    return await this.call(
      "sources.markGithubDeleted",
      (caller) => caller.sources.markGithubDeleted({ githubRepoId }),
      {
        fallbackMessage: "Failed to mark repository as deleted",
        details: { githubRepoId },
      },
    );
  }

  /**
   * Update repository metadata (for webhooks)
   */
  async updateMetadata(
    githubRepoId: string,
    metadata: {
      fullName?: string;
      defaultBranch?: string;
      isPrivate?: boolean;
      isArchived?: boolean;
    }
  ) {
    return await this.call(
      "sources.updateGithubMetadata",
      (caller) =>
        caller.sources.updateGithubMetadata({
          githubRepoId,
          metadata: {
            repoFullName: metadata.fullName,
            defaultBranch: metadata.defaultBranch,
            isPrivate: metadata.isPrivate,
            isArchived: metadata.isArchived,
          },
        }),
      {
        fallbackMessage: "Failed to update repository metadata",
        details: { githubRepoId, metadata },
      },
    );
  }
}
