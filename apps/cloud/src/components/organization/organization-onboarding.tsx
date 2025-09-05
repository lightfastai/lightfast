"use client";

import { useSession, useOrganization } from "@clerk/nextjs";
import { CreateOrganization, OrganizationList } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Organization Onboarding Component
 * 
 * Handles the organization-first onboarding flow using Clerk's session tasks.
 * Users must create or join an organization before accessing the main application.
 */
export function OrganizationOnboarding() {
  const { session, isLoaded } = useSession();
  const { organization } = useOrganization();
  const router = useRouter();
  const [showCreateOrg, setShowCreateOrg] = useState(false);

  useEffect(() => {
    // Redirect to dashboard if user already has organization and no pending tasks
    if (isLoaded && session?.user && !session.currentTask && organization?.id) {
      router.push("/dashboard");
    }
  }, [isLoaded, session, organization, router]);

  // Show loading state while Clerk loads
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Handle session task for organization selection
  if (session?.currentTask) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            You need to select an organization to continue
          </p>
        </div>

        {/* Use Clerk's built-in task handling component */}
        <div className="space-y-4">
          {showCreateOrg ? (
            <div className="space-y-4">
              <CreateOrganization 
                hideSlug
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "shadow-none border border-border",
                  }
                }}
                afterCreateOrganizationUrl="/dashboard"
              />
              <button
                onClick={() => setShowCreateOrg(false)}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back to organization list
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <OrganizationList 
                hidePersonal
                hideSlug
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "shadow-none border border-border",
                  }
                }}
                afterSelectOrganizationUrl="/dashboard"
              />
              <button
                onClick={() => setShowCreateOrg(true)}
                className="w-full text-sm bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors"
              >
                Create new organization
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback for users without session tasks (shouldn't happen in organization-first setup)
  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-4">
          Create an organization to get started with Lightfast
        </p>
      </div>

      <CreateOrganization 
        hideSlug
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "shadow-none border border-border",
          }
        }}
        afterCreateOrganizationUrl="/dashboard"
      />
    </div>
  );
}