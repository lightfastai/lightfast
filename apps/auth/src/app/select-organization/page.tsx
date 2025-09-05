"use client";

import { useState, useEffect } from "react";
import { useOrganizationList, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Icons } from "@repo/ui/components/icons";

/**
 * Custom Organization Selection Page
 * 
 * Provides a clean, simple organization creation flow that redirects
 * users to the cloud app after completion.
 */
export default function SelectOrganizationPage() {
  const [orgName, setOrgName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { createOrganization, setActive, organizationList } = useOrganizationList();
  const { user } = useUser();
  const router = useRouter();

  // Auto-redirect if user already has organizations
  useEffect(() => {
    if (organizationList && organizationList.length > 0) {
      const firstOrg = organizationList[0];
      if (firstOrg && setActive) {
        setActive({ organization: firstOrg.id }).then(() => {
          window.location.href = "http://localhost:4103/dashboard";
        }).catch((error) => {
          console.error('Error setting active organization:', error);
          // Still redirect even if setting active fails
          window.location.href = "http://localhost:4103/dashboard";
        });
      }
    }
  }, [organizationList, setActive]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!orgName.trim() || !createOrganization) return;
    
    setIsLoading(true);
    console.log('Starting organization creation...', { orgName: orgName.trim() });
    
    try {
      // Create organization using Clerk JS SDK
      console.log('Calling createOrganization...');
      const organization = await createOrganization({
        name: orgName.trim(),
      });
      
      console.log('Organization created:', organization);

      // Set the newly created organization as active
      if (setActive && organization) {
        console.log('Setting active organization...', organization.id);
        await setActive({ organization: organization.id });
        console.log('Active organization set successfully');
      }
      
      // Wait a bit for Clerk to fully process the organization change, then redirect
      console.log('Organization setup complete, redirecting to cloud app...');
      setTimeout(() => {
        console.log('Executing redirect now...');
        window.location.replace("http://localhost:4103/dashboard");
      }, 1000);
      
    } catch (error) {
      console.error('Error creating organization:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Don't redirect on error - let user see the error and try again
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    // Skip org creation and go directly to cloud app
    window.location.href = "http://localhost:4103/dashboard";
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-foreground">
            Welcome to Lightfast
          </h1>
          <p className="mt-2 text-muted-foreground">
            Set up your organization to get started
          </p>
        </div>

        <form onSubmit={handleCreateOrg} className="space-y-6">
          <div>
            <Input
              type="text"
              placeholder="Organization name (e.g., Acme Corp)"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="h-12"
              disabled={isLoading}
            />
          </div>

          <Button 
            type="submit" 
            className="w-full h-12"
            disabled={isLoading || !orgName.trim()}
          >
            {isLoading ? (
              <>
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Organization"
            )}
          </Button>

          <div className="text-center">
            <Button 
              type="button"
              variant="ghost"
              onClick={handleSkip}
              disabled={isLoading}
              className="text-muted-foreground hover:text-foreground"
            >
              Skip for now
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}