import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

/**
 * Server-side validation endpoint for organization creation
 * Ensures users can only create one organization (initial onboarding only)
 */
export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized", canCreate: false },
        { status: 401 }
      );
    }

    // Check existing organizations for this user
    const existingOrgs = await clerkClient().users.getOrganizationMembershipList({ userId });
    
    if (existingOrgs && existingOrgs.data && existingOrgs.data.length > 0) {
      console.log(`🚫 Server-side org creation blocked for user ${userId}: already has ${existingOrgs.data.length} organizations`);
      return NextResponse.json(
        { 
          error: "User already has an organization", 
          canCreate: false,
          organizationCount: existingOrgs.data.length 
        },
        { status: 403 }
      );
    }

    console.log(`✅ Server-side org creation validated for user ${userId}: no existing organizations`);
    return NextResponse.json({ canCreate: true, organizationCount: 0 });

  } catch (error) {
    console.error("❌ Error validating organization creation:", error);
    return NextResponse.json(
      { error: "Internal server error", canCreate: false },
      { status: 500 }
    );
  }
}