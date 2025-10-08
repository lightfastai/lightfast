import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@db/deus";
import { organizations, organizationMembers } from "@db/deus/schema";
import { eq, and } from "drizzle-orm";
import {
	getUserInstallations,
	getAuthenticatedUser,
	getOrganizationMembership,
} from "~/lib/github-app";
import type { OrgMembershipRole } from "~/lib/github-app";

/**
 * Map GitHub organization role to Deus role
 *
 * GitHub admins become owners, all other members become regular members
 */
function mapGitHubRoleToDeusRole(
	githubRole: OrgMembershipRole
): "owner" | "member" {
	return githubRole === "admin" ? "owner" : "member";
}

/**
 * Claim Organization API Route
 *
 * Allows a user to claim a GitHub organization in Deus.
 * Creates an organization record and makes the user the owner.
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
			// Organization already claimed - check if user is already a member
			const existingMembership = await db.query.organizationMembers.findFirst({
				where: and(
					eq(organizationMembers.organizationId, existingOrg.id),
					eq(organizationMembers.userId, userId),
				),
			});

			if (existingMembership) {
				// Already a member, just redirect
				return NextResponse.json({
					success: true,
					orgId: existingOrg.githubOrgId,
					alreadyMember: true,
				});
			}

			// Verify user's GitHub organization membership and role
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

				// Map GitHub role to Deus role
				const deusRole = mapGitHubRoleToDeusRole(membership.role);

				// Add user to organization with verified role
				await db.insert(organizationMembers).values({
					organizationId: existingOrg.id,
					userId,
					role: deusRole,
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
					joined: true,
					role: deusRole,
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

		// Create new organization record
		const [newOrg] = await db
			.insert(organizations)
			.values({
				githubInstallationId: installationId,
				githubOrgId: account.id,
				githubOrgSlug: accountSlug,
				githubOrgName: accountName,
				githubOrgAvatarUrl: account.avatar_url || null,
				claimedBy: userId,
			})
			.$returningId();

		if (!newOrg) {
			throw new Error("Failed to create organization");
		}

		// Add user as owner
		await db.insert(organizationMembers).values({
			organizationId: newOrg.id,
			userId,
			role: "owner",
		});

		return NextResponse.json({
			success: true,
			orgId: account.id,
			created: true,
		});
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
