import { DeusApiService } from "./base-service";

export class IntegrationsService extends DeusApiService {
  /**
   * Get user's GitHub integration with installations
   */
  async getGitHubIntegration(userId: string) {
    return await this.call(
      "integration.github.list",
      (caller) => caller.integration.github.list(),
      {
        fallbackMessage: "Failed to get GitHub integration",
        details: { userId },
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
   * Validate and update GitHub installations from API
   */
  async validateGitHubInstallations() {
    return await this.call(
      "integration.github.validate",
      (caller) => caller.integration.github.validate(),
      {
        fallbackMessage: "Failed to validate GitHub installations",
      },
    );
  }

  /**
   * Store OAuth result (access token + installations)
   * Called from OAuth callback route
   */
  async storeOAuthResult(params: {
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt?: string;
    installations: Array<{
      id: string;
      accountId: string;
      accountLogin: string;
      accountType: "User" | "Organization";
      avatarUrl: string;
      permissions: Record<string, string>;
      installedAt: string;
      lastValidatedAt: string;
    }>;
  }) {
    return await this.call(
      "integration.github.storeOAuthResult",
      (caller) => caller.integration.github.storeOAuthResult(params),
      {
        fallbackMessage: "Failed to store OAuth result",
        details: { installationCount: params.installations.length },
      },
    );
  }

  /**
   * Get repositories for a GitHub installation
   */
  async getRepositories(params: { integrationId: string; installationId: string }) {
    return await this.call(
      "integration.github.repositories",
      (caller) => caller.integration.github.repositories(params),
      {
        fallbackMessage: "Failed to get repositories",
        details: params,
      },
    );
  }

  /**
   * Connect repository directly to workspace (NEW simplified 2-table API)
   */
  async connectDirectToWorkspace(params: {
    clerkOrgSlug: string;
    workspaceName: string;
    userSourceId: string;
    installationId: string;
    repoId: string;
    repoName: string;
    repoFullName: string;
    defaultBranch: string;
    isPrivate: boolean;
    isArchived: boolean;
    syncConfig: {
      branches?: string[];
      paths?: string[];
      events?: string[];
      autoSync: boolean;
    };
  }) {
    return await this.call(
      "integration.workspace.connectDirect",
      (caller) => caller.integration.workspace.connectDirect(params),
      {
        fallbackMessage: "Failed to connect repository to workspace",
        details: params,
      },
    );
  }
}
