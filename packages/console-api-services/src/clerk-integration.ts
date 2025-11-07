import type { OrgMembershipRole } from "@repo/console-octokit-github";
import { DeusApiService } from "./base-service";

/**
 * ClerkIntegrationService - tRPC wrapper for Clerk operations
 *
 * Provides a clean API for Clerk organization management by wrapping
 * the clerk tRPC router. All business logic is in api/console.
 */
export class ClerkIntegrationService extends DeusApiService {
	/**
	 * Create or get Clerk organization with slug collision handling
	 *
	 * Creates Clerk org with user as admin. If slug is taken, appends timestamp.
	 */
	async createOrGetClerkOrganization(params: {
		userId: string;
		orgName: string;
		orgSlug: string;
	}): Promise<{ clerkOrgId: string; clerkOrgSlug: string }> {
		return this.call("clerk.createOrGetOrganization", async (caller) =>
			caller.clerk.createOrGetOrganization(params),
		);
	}

	/**
	 * Map GitHub organization role to Clerk role
	 */
	mapGitHubRoleToClerkRole(
		githubRole: OrgMembershipRole,
	): "org:admin" | "org:member" {
		return githubRole === "admin" ? "org:admin" : "org:member";
	}

	/**
	 * Verify GitHub membership and add user to Clerk organization
	 *
	 * Verifies user is active member of GitHub org, then adds to Clerk org with appropriate role.
	 */
	async addUserToClerkOrganization(params: {
		clerkOrgId: string;
		userId: string;
		githubToken: string;
		githubOrgSlug: string;
		githubUsername: string;
	}): Promise<{ role: OrgMembershipRole }> {
		return this.call("clerk.addUserToOrganization", async (caller) =>
			caller.clerk.addUserToOrganization(params),
		);
	}
}
