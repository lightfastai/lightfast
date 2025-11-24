import { currentUser } from "@clerk/nextjs/server";
import { SignOutButton } from "./sign-out-button";

/**
 * Organization Not Found page
 *
 * Shown when:
 * - User tries to access an organization that doesn't exist
 * - User doesn't have access to the organization (not a member)
 * - Organization slug is invalid
 * - User's org membership was removed while they were viewing the org
 *
 * Triggered by notFound() in [slug]/layout.tsx when requireOrgAccess fails
 */
export default async function OrganizationNotFound() {
  const user = await currentUser();

  const emailAddress =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    user?.username ??
    "";

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <div className="rounded-sm border border-dashed border-border p-32 text-center">
        {/* Geometric icon - circle and triangle */}
        <div className="mb-8 flex justify-center">
          <div className="relative h-24 w-24">
            {/* Outer circle */}
            <div className="h-24 w-24 rounded-full border-2 border-border" />
            {/* Inner filled circle */}
            <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" />
          </div>
        </div>

        {/* 404 text */}
        <h1 className="mb-6 text-8xl font-bold text-foreground">404</h1>

        {/* User info */}
        {emailAddress && (
          <p className="mb-8 text-lg text-muted-foreground">
            You are logged in as {emailAddress}
          </p>
        )}

        {/* Action button */}
        <SignOutButton />
      </div>
    </div>
  );
}
