import { DeusApiService } from "./base-service";

export class OrganizationsService extends DeusApiService {
  /**
   * Find organization by GitHub org ID (for API routes)
   */
  async findByGithubOrgId(githubOrgId: number) {
    return await this.call(
      "organization.findByGithubOrgId",
      (caller) => caller.organization.findByGithubOrgId({ githubOrgId }),
      {
        fallbackMessage: "Failed to find organization by GitHub org ID",
        details: { githubOrgId },
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
   * Find organization by ID
   */
  async findById(id: string) {
    return await this.call(
      "organization.findById",
      (caller) => caller.organization.findById({ id }),
      {
        fallbackMessage: "Failed to find organization",
        details: { id },
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
   * Find organization by Clerk org ID
   */
  async findByClerkOrgId(clerkOrgId: string) {
    return await this.call(
      "organization.findByClerkOrgId",
      (caller) => caller.organization.findByClerkOrgId({ clerkOrgId }),
      {
        fallbackMessage: "Failed to find organization by Clerk org ID",
        details: { clerkOrgId },
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
   * Find organization by Clerk org slug
   */
  async findByClerkOrgSlug(clerkOrgSlug: string) {
    return await this.call(
      "organization.findByClerkOrgSlug",
      (caller) => caller.organization.findByClerkOrgSlug({ clerkOrgSlug }),
      {
        fallbackMessage: "Failed to find organization by Clerk org slug",
        details: { clerkOrgSlug },
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
   * Find organization by GitHub org slug
   */
  async findByGithubOrgSlug(githubOrgSlug: string) {
    return await this.call(
      "organization.findByGithubOrgSlug",
      (caller) => caller.organization.findByGithubOrgSlug({ githubOrgSlug }),
      {
        fallbackMessage: "Failed to find organization by GitHub org slug",
        details: { githubOrgSlug },
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
   * Update organization with Clerk details
   */
  async updateClerkDetails(params: {
    id: string;
    clerkOrgId: string;
    clerkOrgSlug: string;
  }) {
    return await this.call(
      "organization.updateClerkDetails",
      (caller) => caller.organization.updateClerkDetails(params),
      {
        fallbackMessage: "Failed to update organization Clerk details",
        details: params,
      },
    );
  }

  /**
   * Update organization installation ID
   */
  async updateInstallationId(params: { id: string; installationId: number }) {
    return await this.call(
      "organization.updateInstallationId",
      (caller) => caller.organization.updateInstallationId(params),
      {
        fallbackMessage: "Failed to update organization installation ID",
        details: params,
      },
    );
  }

  /**
   * Create new organization
   */
  async create(params: {
    githubInstallationId: number;
    githubOrgId: number;
    githubOrgSlug: string;
    githubOrgName: string;
    githubOrgAvatarUrl: string | null;
    claimedBy: string;
    clerkOrgId: string;
    clerkOrgSlug: string;
  }) {
    return await this.call(
      "organization.create",
      (caller) => caller.organization.create(params),
      {
        fallbackMessage: "Failed to create organization",
        details: params,
      },
    );
  }
}
