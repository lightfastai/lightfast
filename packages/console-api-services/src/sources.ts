import { DeusApiM2MService } from "./base-service";

/**
 * Sources Service
 *
 * Service wrapper for workspace source M2M operations across all providers.
 * Currently supports GitHub repository operations for webhooks.
 *
 * Future: Will include Linear, Notion, Sentry source operations.
 */
export class SourcesService extends DeusApiM2MService {
  /**
   * Find active repository by GitHub repo ID (for webhooks)
   */
  async findActiveByGithubRepoId(githubRepoId: string) {
    return await this.call(
      "m2m.sources.findByGithubRepoId",
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
   * Get workspace source ID by GitHub repo ID
   * Used by webhooks to resolve sourceId for new event architecture
   */
  async getSourceIdByGithubRepoId(
    workspaceId: string,
    githubRepoId: string
  ): Promise<string | null> {
    return await this.call(
      "m2m.sources.getSourceIdByGithubRepoId",
      (caller) =>
        caller.sources.getSourceIdByGithubRepoId({
          workspaceId,
          githubRepoId,
        }),
      {
        fallbackMessage: "Failed to get source ID",
        details: { workspaceId, githubRepoId },
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
      "m2m.sources.updateGithubSyncStatus",
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
      "m2m.sources.markGithubInstallationInactive",
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
    configStatus: "configured" | "awaiting_config";
    configPath: string | null;
  }) {
    return await this.call(
      "m2m.sources.updateGithubConfigStatus",
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
      "m2m.sources.markGithubDeleted",
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
      "m2m.sources.updateGithubMetadata",
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
