import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getOrCreateDefaultWorkspace } from "@db/console/utils";

/**
 * Create Organization API Route
 *
 * Creates a new Clerk organization using slug as both name and slug.
 * Clerk is the source of truth - no Console DB organization table.
 *
 * Flow:
 * 1. Validate slug format
 * 2. Create Clerk organization (slug used for both name and slug)
 * 3. User becomes admin automatically via createdBy
 * 4. Create default workspace in Console DB
 * 5. Return organization ID and workspace ID
 *
 * Auth: Requires authenticated user (pending sessions allowed)
 */
export async function POST(request: NextRequest) {
	console.log("=== [CREATE ORG] Starting create organization request ===");

	// Treat pending sessions as signed in
	const { userId } = await auth({ treatPendingAsSignedOut: false });
	console.log("[CREATE ORG] Auth result:", { userId });

	if (!userId) {
		console.log("[CREATE ORG] ❌ No userId - unauthorized");
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = (await request.json()) as { slug: string };
		const { slug } = body;
		console.log("[CREATE ORG] Request body:", { slug });

		if (!slug) {
			console.log("[CREATE ORG] ❌ Missing slug");
			return NextResponse.json(
				{ error: "Slug is required" },
				{ status: 400 },
			);
		}

		// Validate slug format (lowercase alphanumeric + hyphens, no leading/trailing/consecutive hyphens)
		if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
			console.log("[CREATE ORG] ❌ Invalid slug format");
			return NextResponse.json(
				{
					error: "Invalid slug format",
					message:
						"Slug must be lowercase alphanumeric with hyphens, no leading/trailing/consecutive hyphens",
				},
				{ status: 400 },
			);
		}

		// Create Clerk organization (slug used for both name and slug)
		console.log("[CREATE ORG] Creating Clerk organization...");
		const clerk = await clerkClient();
		const clerkOrg = await clerk.organizations.createOrganization({
			name: slug,  // Use slug as name
			slug: slug,
			createdBy: userId,
		});
		console.log("[CREATE ORG] ✓ Clerk org created:", {
			clerkOrgId: clerkOrg.id,
			clerkOrgSlug: clerkOrg.slug,
		});

		// Create default workspace for new organization
		console.log("[CREATE ORG] Creating default workspace in Console DB...");
		try {
			const workspaceId = await getOrCreateDefaultWorkspace(clerkOrg.id);
			console.log("[CREATE ORG] ✓ Default workspace created:", workspaceId);

			console.log("[CREATE ORG] ✅ Successfully created new org");

			return NextResponse.json({
				organizationId: clerkOrg.id,
				slug: clerkOrg.slug || slug,
				workspaceId,
			});
		} catch (error) {
			// Rollback: Delete Clerk org if workspace creation failed
			console.error(
				"[CREATE ORG] ❌ Failed to create workspace, rolling back Clerk org:",
				error,
			);
			try {
				await clerk.organizations.deleteOrganization(clerkOrg.id);
				console.log("[CREATE ORG] ✓ Rolled back Clerk org");
			} catch (rollbackError) {
				console.error(
					"[CREATE ORG] ❌ Failed to rollback Clerk organization:",
					rollbackError,
				);
			}
			throw error;
		}
	} catch (error) {
		console.error("[CREATE ORG] ❌ Unexpected error:", error);
		return NextResponse.json(
			{
				error: "Failed to create organization",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
