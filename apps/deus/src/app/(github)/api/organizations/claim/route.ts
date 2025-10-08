import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@db/deus";
import { organizations } from "@db/deus/schema";
import { eq } from "drizzle-orm";
import {
	getUserInstallations,
	getAuthenticatedUser,
	getOrganizationMembership,
} from "~/lib/github-app";
import type { OrgMembershipRole } from "~/lib/github-app";

/**
 * Map GitHub organization role to Clerk role
 *
 * GitHub admins become org:admin, all other members become org:member
 */
function mapGitHubRoleToClerkRole(
	githubRole: OrgMembershipRole
): "org:admin" | "org:member" {
	return githubRole === "admin" ? "org:admin" : "org:member";
}

/**
 * Create or get Clerk organization for a Deus organization
 *
 * If organization already has a Clerk org linked, returns the existing one.
 * Otherwise creates a new Clerk organization.
 */
async function createOrGetClerkOrganization(params: {
	userId: string;
	orgName: string;
	orgSlug: string;
}): Promise<{ clerkOrgId: string; clerkOrgSlug: string }> {
	const { userId, orgName, orgSlug } = params;

	try {
		const clerk = await clerkClient();

		// Create Clerk organization with the user as creator/admin
		const clerkOrg = await clerk.organizations.createOrganization({
			name: orgName,
			slug: orgSlug,
			createdBy: userId,
		});

		return {
			clerkOrgId: clerkOrg.id,
			clerkOrgSlug: clerkOrg.slug,
		};
	} catch (error) {
		// If slug is taken, try with a suffix
		if (error instanceof Error && error.message.includes("slug")) {
			const clerk = await clerkClient();
			const uniqueSlug = `${orgSlug}-${Date.now()}`;

			const clerkOrg = await clerk.organizations.createOrganization({
				name: orgName,
				slug: uniqueSlug,
				createdBy: userId,
			});

			return {
				clerkOrgId: clerkOrg.id,
				clerkOrgSlug: clerkOrg.slug,
			};
		}
		throw error;
	}
}

/**
 * Claim Organization API Route
 *
 * Allows a user to claim a GitHub organization in Deus.
 *
 * For new organizations:
 * - Creates Clerk organization (user becomes admin automatically via createdBy)
 * - Creates Deus organization record linked to Clerk org
 * - Rollback Clerk org if Deus org creation fails
 *
 * For existing organizations:
 * - Ensures Clerk org is linked (creates if missing)
 * - Verifies user's GitHub membership
 * - Adds user to Clerk organization with appropriate role
 *
 * Note: All membership management is handled by Clerk. No Deus organizationMembers table.
 */
export async function POST(request: NextRequest) {
	const { userId } = await auth();

	if (!userId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const userToken = request.cookies.get("github_user_token")?.value;

	if (!userToken) {
		return NextResponse.json(
			{ error: "GitHub not connected. Please authorize the app first." },
			{ status: 401 },
		);
	}

	try {
		const body = (await request.json()) as { installationId: number };
		const { installationId } = body;

		if (!installationId) {
			return NextResponse.json(
				{ error: "installationId is required" },
				{ status: 400 },
			);
		}

		// Fetch user's installations to verify access
		const installationsData = await getUserInstallations(userToken);
		const installation = installationsData.installations.find(
			(inst) => inst.id === installationId,
		);

		if (!installation) {
			return NextResponse.json(
				{ error: "Installation not found or access denied" },
				{ status: 404 },
			);
		}

		const account = installation.account;

		if (!account) {
			return NextResponse.json(
				{ error: "Installation account not found" },
				{ status: 404 },
			);
		}

		// GitHub account can be User or Organization type
		// Organizations have 'slug', Users have 'login'
		const accountSlug = "slug" in account ? account.slug : "login" in account ? account.login : null;
		const accountName = "name" in account ? account.name : "login" in account ? account.login : null;

		if (!accountSlug || !accountName) {
			return NextResponse.json(
				{ error: "Could not determine account slug or name" },
				{ status: 400 },
			);
		}

		// Check if this organization already exists (by immutable GitHub org ID)
		const existingOrg = await db.query.organizations.findFirst({
			where: eq(organizations.githubOrgId, account.id),
		});

		if (existingOrg) {
			// Organization exists - ensure it has a Clerk org linked
			if (!existingOrg.clerkOrgId) {
				try {
					const clerkOrgData = await createOrGetClerkOrganization({
						userId,
						orgName: accountName,
						orgSlug: accountSlug,
					});

					// Update the existing organization with Clerk org details
					await db
						.update(organizations)
						.set({
							clerkOrgId: clerkOrgData.clerkOrgId,
							clerkOrgSlug: clerkOrgData.clerkOrgSlug,
							updatedAt: new Date().toISOString(),
						})
						.where(eq(organizations.id, existingOrg.id));

					// Update local reference
					existingOrg.clerkOrgId = clerkOrgData.clerkOrgId;
					existingOrg.clerkOrgSlug = clerkOrgData.clerkOrgSlug;
				} catch (error) {
					console.error("Failed to create Clerk organization for existing org:", error);
					return NextResponse.json(
						{
							error: "Failed to create Clerk organization",
							message: "Could not link organization to Clerk",
						},
						{ status: 500 }
					);
				}
			}

			// Check if user is already a member of the Clerk organization
			const clerk = await clerkClient();
			const clerkMemberships = await clerk.organizations.getOrganizationMembershipList({
				organizationId: existingOrg.clerkOrgId,
				limit: 500,
			});

			const existingClerkMembership = clerkMemberships.data.find(
				(m) => m.publicUserData?.userId === userId
			);

			if (existingClerkMembership) {
				// Already a member - just return success
				return NextResponse.json({
					success: true,
					orgId: existingOrg.githubOrgId,
					slug: existingOrg.clerkOrgSlug,
					alreadyMember: true,
				});
			}

			// Not a member - verify GitHub membership and add to Clerk org
			try {
				// Get user's GitHub username
				const githubUser = await getAuthenticatedUser(userToken);
				const githubUsername = githubUser.login;

				// Verify organization membership and get role
				const membership = await getOrganizationMembership(
					userToken,
					accountSlug,
					githubUsername
				);

				// Only allow active members to join
				if (membership.state !== "active") {
					return NextResponse.json(
						{
							error: "Membership not active",
							message: "You must accept the organization invitation before claiming",
						},
						{ status: 403 }
					);
				}

				// Map GitHub role to Clerk role
				const clerkRole = mapGitHubRoleToClerkRole(membership.role);

				// Add user to Clerk organization with verified role
				await clerk.organizations.createOrganizationMembership({
					organizationId: existingOrg.clerkOrgId,
					userId,
					role: clerkRole,
				});

				// Update installation ID if it changed (app was reinstalled)
				if (existingOrg.githubInstallationId !== installationId) {
					await db
						.update(organizations)
						.set({
							githubInstallationId: installationId,
							updatedAt: new Date().toISOString(),
						})
						.where(eq(organizations.id, existingOrg.id));
				}

				return NextResponse.json({
					success: true,
					orgId: existingOrg.githubOrgId,
					slug: existingOrg.clerkOrgSlug,
					joined: true,
					role: membership.role,
				});
			} catch (error) {
				// If membership check fails, user is not a member of the organization
				console.error("Organization membership verification failed:", error);
				return NextResponse.json(
					{
						error: "Not a member",
						message:
							"You must be a member of this GitHub organization to claim it",
					},
					{ status: 403 }
				);
			}
		}

		// Create Clerk organization first (user becomes admin automatically via createdBy)
		let clerkOrgData: { clerkOrgId: string; clerkOrgSlug: string };

		try {
			clerkOrgData = await createOrGetClerkOrganization({
				userId,
				orgName: accountName,
				orgSlug: accountSlug,
			});
		} catch (error) {
			console.error("Failed to create Clerk organization:", error);
			return NextResponse.json(
				{
					error: "Failed to create Clerk organization",
					message: "Could not create organization",
				},
				{ status: 500 }
			);
		}

		// Create new organization record with Clerk org link
		try {
			const [newOrg] = await db
				.insert(organizations)
				.values({
					githubInstallationId: installationId,
					githubOrgId: account.id,
					githubOrgSlug: accountSlug,
					githubOrgName: accountName,
					githubOrgAvatarUrl: account.avatar_url || null,
					claimedBy: userId,
					clerkOrgId: clerkOrgData.clerkOrgId,
					clerkOrgSlug: clerkOrgData.clerkOrgSlug,
				})
				.$returningId();

			if (!newOrg) {
				throw new Error("Failed to create organization");
			}

			return NextResponse.json({
				success: true,
				orgId: account.id,
				slug: clerkOrgData.clerkOrgSlug,
				created: true,
			});
		} catch (error) {
			// Rollback: Delete Clerk org if Deus org creation failed
			console.error("Failed to create Deus organization, rolling back Clerk org:", error);
			try {
				const clerk = await clerkClient();
				await clerk.organizations.deleteOrganization(clerkOrgData.clerkOrgId);
			} catch (rollbackError) {
				console.error("Failed to rollback Clerk organization:", rollbackError);
			}
			throw error;
		}
	} catch (error) {
		console.error("Error claiming organization:", error);
		return NextResponse.json(
			{
				error: "Failed to claim organization",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
