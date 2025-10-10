import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { OrganizationsService } from "@repo/deus-api-services";
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
	githubRole: OrgMembershipRole,
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
 *
 * Auth: This route must support PENDING sessions (user authenticated but no org claimed yet).
 * We use treatPendingAsSignedOut: false to treat pending sessions as authenticated.
 */
export async function POST(request: NextRequest) {
	console.log("=== [CLAIM ORG] Starting claim organization request ===");

	// Treat pending sessions as signed in to allow claiming org
	const { userId } = await auth({ treatPendingAsSignedOut: false });
	console.log("[CLAIM ORG] Auth result:", { userId });

	if (!userId) {
		console.log("[CLAIM ORG] ❌ No userId - unauthorized");
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const userToken = request.cookies.get("github_user_token")?.value;
	console.log("[CLAIM ORG] GitHub token present:", !!userToken);

	if (!userToken) {
		console.log("[CLAIM ORG] ❌ No GitHub token");
		return NextResponse.json(
			{ error: "GitHub not connected. Please authorize the app first." },
			{ status: 401 },
		);
	}

	try {
		const body = (await request.json()) as { installationId: number };
		const { installationId } = body;
		console.log("[CLAIM ORG] Request body:", { installationId });

		if (!installationId) {
			console.log("[CLAIM ORG] ❌ No installationId provided");
			return NextResponse.json(
				{ error: "installationId is required" },
				{ status: 400 },
			);
		}

		// Fetch user's installations to verify access
		console.log("[CLAIM ORG] Fetching user installations...");
		const installationsData = await getUserInstallations(userToken);
		console.log("[CLAIM ORG] Found installations:", installationsData.installations.length);

		const installation = installationsData.installations.find(
			(inst) => inst.id === installationId,
		);

		if (!installation) {
			console.log("[CLAIM ORG] ❌ Installation not found:", installationId);
			return NextResponse.json(
				{ error: "Installation not found or access denied" },
				{ status: 404 },
			);
		}

		console.log("[CLAIM ORG] ✓ Installation found:", {
			id: installation.id,
			accountType: installation.account ? ("type" in installation.account ? installation.account.type : "unknown") : "no account",
		});

		const account = installation.account;

		if (!account) {
			console.log("[CLAIM ORG] ❌ Installation account not found");
			return NextResponse.json(
				{ error: "Installation account not found" },
				{ status: 404 },
			);
		}

		// GitHub account can be User or Organization type
		// Organizations have 'slug', Users have 'login'
		const accountSlug =
			"slug" in account
				? account.slug
				: "login" in account
					? account.login
					: null;
		const accountName =
			"name" in account
				? account.name
				: "login" in account
					? account.login
					: null;

		console.log("[CLAIM ORG] Account details:", {
			githubOrgId: account.id,
			accountSlug,
			accountName,
		});

		if (!accountSlug || !accountName) {
			console.log("[CLAIM ORG] ❌ Could not determine account slug or name");
			return NextResponse.json(
				{ error: "Could not determine account slug or name" },
				{ status: 400 },
			);
		}

		// Check if this organization already exists (by immutable GitHub org ID)
		console.log("[CLAIM ORG] Checking for existing org in DB...");
		const organizationsService = new OrganizationsService();
		const existingOrg = await organizationsService.findByGithubOrgId(account.id);
		console.log("[CLAIM ORG] Existing org found:", !!existingOrg);

		if (existingOrg) {
			console.log("[CLAIM ORG] → Handling existing org flow");

			// Organization exists - ensure it has a Clerk org linked
			if (!existingOrg.clerkOrgId) {
				console.log("[CLAIM ORG] No Clerk org linked, creating one...");
				try {
					const clerkOrgData = await createOrGetClerkOrganization({
						userId,
						orgName: accountName,
						orgSlug: accountSlug,
					});
					console.log("[CLAIM ORG] ✓ Clerk org created:", {
						clerkOrgId: clerkOrgData.clerkOrgId,
						clerkOrgSlug: clerkOrgData.clerkOrgSlug,
					});

					// Update the existing organization with Clerk org details
					await organizationsService.updateClerkDetails({
						id: existingOrg.id,
						clerkOrgId: clerkOrgData.clerkOrgId,
						clerkOrgSlug: clerkOrgData.clerkOrgSlug,
					});

					console.log("[CLAIM ORG] ✓ DB updated with Clerk org details");

					// Update local reference
					existingOrg.clerkOrgId = clerkOrgData.clerkOrgId;
					existingOrg.clerkOrgSlug = clerkOrgData.clerkOrgSlug;
				} catch (error) {
					console.error(
						"[CLAIM ORG] ❌ Failed to create Clerk organization for existing org:",
						error,
					);
					return NextResponse.json(
						{
							error: "Failed to create Clerk organization",
							message: "Could not link organization to Clerk",
						},
						{ status: 500 },
					);
				}
			} else {
				console.log("[CLAIM ORG] ✓ Clerk org already linked:", existingOrg.clerkOrgId);
			}

			// Check if user is already a member of the Clerk organization
			console.log("[CLAIM ORG] Checking Clerk org membership...");
			const clerk = await clerkClient();
			const clerkMemberships =
				await clerk.organizations.getOrganizationMembershipList({
					organizationId: existingOrg.clerkOrgId,
					limit: 500,
				});

			console.log("[CLAIM ORG] Clerk org members:", clerkMemberships.data.length);

			const existingClerkMembership = clerkMemberships.data.find(
				(m) => m.publicUserData?.userId === userId,
			);

			if (existingClerkMembership) {
				console.log("[CLAIM ORG] ✓ User already a member, returning success");
				// Already a member - just return success
				return NextResponse.json({
					success: true,
					orgId: existingOrg.githubOrgId,
					slug: existingOrg.clerkOrgSlug,
					alreadyMember: true,
				});
			}

			console.log("[CLAIM ORG] User not a member, verifying GitHub membership...");

			// Not a member - verify GitHub membership and add to Clerk org
			try {
				// Get user's GitHub username
				console.log("[CLAIM ORG] Getting GitHub user info...");
				const githubUser = await getAuthenticatedUser(userToken);
				const githubUsername = githubUser.login;
				console.log("[CLAIM ORG] GitHub username:", githubUsername);

				// Verify organization membership and get role
				console.log("[CLAIM ORG] Verifying GitHub org membership...");
				const membership = await getOrganizationMembership(
					userToken,
					accountSlug,
					githubUsername,
				);
				console.log("[CLAIM ORG] GitHub membership:", {
					state: membership.state,
					role: membership.role,
				});

				// Only allow active members to join
				if (membership.state !== "active") {
					console.log("[CLAIM ORG] ❌ Membership not active:", membership.state);
					return NextResponse.json(
						{
							error: "Membership not active",
							message:
								"You must accept the organization invitation before claiming",
						},
						{ status: 403 },
					);
				}

				// Map GitHub role to Clerk role
				const clerkRole = mapGitHubRoleToClerkRole(membership.role);
				console.log("[CLAIM ORG] Mapped role:", { githubRole: membership.role, clerkRole });

				// Add user to Clerk organization with verified role
				console.log("[CLAIM ORG] Adding user to Clerk org...");
				await clerk.organizations.createOrganizationMembership({
					organizationId: existingOrg.clerkOrgId,
					userId,
					role: clerkRole,
				});
				console.log("[CLAIM ORG] ✓ User added to Clerk org");

				// Update installation ID if it changed (app was reinstalled)
				if (existingOrg.githubInstallationId !== installationId) {
					console.log("[CLAIM ORG] Updating installation ID...");
					await organizationsService.updateInstallationId({
						id: existingOrg.id,
						installationId,
					});
					console.log("[CLAIM ORG] ✓ Installation ID updated");
				}

				console.log("[CLAIM ORG] ✅ Successfully joined existing org");
				return NextResponse.json({
					success: true,
					orgId: existingOrg.githubOrgId,
					slug: existingOrg.clerkOrgSlug,
					joined: true,
					role: membership.role,
				});
			} catch (error) {
				// If membership check fails, user is not a member of the organization
				console.error("[CLAIM ORG] ❌ Organization membership verification failed:", error);
				return NextResponse.json(
					{
						error: "Not a member",
						message:
							"You must be a member of this GitHub organization to claim it",
					},
					{ status: 403 },
				);
			}
		}

		// Create Clerk organization first (user becomes admin automatically via createdBy)
		console.log("[CLAIM ORG] → Creating new org flow");
		console.log("[CLAIM ORG] Creating Clerk organization...");
		let clerkOrgData: { clerkOrgId: string; clerkOrgSlug: string };

		try {
			clerkOrgData = await createOrGetClerkOrganization({
				userId,
				orgName: accountName,
				orgSlug: accountSlug,
			});
			console.log("[CLAIM ORG] ✓ Clerk org created:", {
				clerkOrgId: clerkOrgData.clerkOrgId,
				clerkOrgSlug: clerkOrgData.clerkOrgSlug,
			});
		} catch (error) {
			console.error("[CLAIM ORG] ❌ Failed to create Clerk organization:", error);
			return NextResponse.json(
				{
					error: "Failed to create Clerk organization",
					message: "Could not create organization",
				},
				{ status: 500 },
			);
		}

		// Create new organization record with Clerk org link
		console.log("[CLAIM ORG] Creating Deus org record in DB...");
		try {
			const newOrg = await organizationsService.create({
				githubInstallationId: installationId,
				githubOrgId: account.id,
				githubOrgSlug: accountSlug,
				githubOrgName: accountName,
				githubOrgAvatarUrl: account.avatar_url || null,
				claimedBy: userId,
				clerkOrgId: clerkOrgData.clerkOrgId,
				clerkOrgSlug: clerkOrgData.clerkOrgSlug,
			});

			console.log("[CLAIM ORG] ✓ Deus org created in DB:", newOrg);
			console.log("[CLAIM ORG] ✅ Successfully created new org");

			return NextResponse.json({
				success: true,
				orgId: account.id,
				slug: clerkOrgData.clerkOrgSlug,
				created: true,
			});
		} catch (error) {
			// Rollback: Delete Clerk org if Deus org creation failed
			console.error(
				"[CLAIM ORG] ❌ Failed to create Deus organization, rolling back Clerk org:",
				error,
			);
			try {
				const clerk = await clerkClient();
				await clerk.organizations.deleteOrganization(clerkOrgData.clerkOrgId);
				console.log("[CLAIM ORG] ✓ Rolled back Clerk org");
			} catch (rollbackError) {
				console.error("[CLAIM ORG] ❌ Failed to rollback Clerk organization:", rollbackError);
			}
			throw error;
		}
	} catch (error) {
		console.error("[CLAIM ORG] ❌ Unexpected error:", error);
		return NextResponse.json(
			{
				error: "Failed to claim organization",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
