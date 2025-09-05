import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Root page that handles authenticated user redirects
 * 
 * This page serves as the landing point for authenticated users and ensures
 * they are redirected to the appropriate location based on their organization status.
 */
export default async function HomePage() {
  const { userId, orgId, sessionClaims } = await auth();

  // If user is not authenticated, they'll be redirected by middleware
  if (!userId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Welcome to Lightfast</h1>
          <p className="text-muted-foreground mt-2">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  // Check if user has pending organization tasks
  if (sessionClaims?.currentTask) {
    console.log(`[ROOT] User ${userId} has pending task: ${sessionClaims.currentTask}, redirecting to onboarding`);
    redirect("/onboarding");
  }

  // Check if user has an active organization
  if (!orgId) {
    console.log(`[ROOT] User ${userId} has no active organization, redirecting to onboarding`);
    redirect("/onboarding");
  }

  // User is authenticated and has an organization, fetch org details and redirect to org-based dashboard
  try {
    const orgResponse = await fetch(`https://api.clerk.com/v1/organizations/${orgId}`, {
      headers: {
        "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (orgResponse.ok) {
      const orgData = await orgResponse.json() as { slug: string | null };
      const orgSlug = orgData.slug || orgId; // Use slug if available, otherwise fall back to ID
      
      console.log(`[ROOT] User ${userId} with org ${orgId} (slug: ${orgSlug}) accessing root, redirecting to org dashboard`);
      redirect(`/${orgSlug}/dashboard`);
    } else {
      console.error("[ROOT] Failed to fetch organization details, redirecting with org ID");
      redirect(`/${orgId}/dashboard`);
    }
  } catch (error) {
    console.error("[ROOT] Error fetching organization details:", error);
    redirect(`/${orgId}/dashboard`);
  }
}