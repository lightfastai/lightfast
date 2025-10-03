import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@db/deus";
import { organizations, organizationMembers } from "@db/deus/schema";
import { eq } from "drizzle-orm";
import { getUserInstallations } from "~/lib/github-app";

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

		// Check if this installation is already claimed
		const existingOrg = await db.query.organizations.findFirst({
			where: eq(organizations.githubInstallationId, installationId),
		});

		if (existingOrg) {
			return NextResponse.json(
				{
					error: "This organization has already been claimed",
					orgSlug: existingOrg.githubOrgSlug,
				},
				{ status: 409 },
			);
		}

		// Create organization record
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
			orgSlug: accountSlug,
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
