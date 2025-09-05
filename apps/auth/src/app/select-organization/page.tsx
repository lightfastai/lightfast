"use client";

import { useState, useEffect } from "react";
import { useOrganizationList } from "@clerk/nextjs";
import { getAppUrl } from "@repo/vercel-config";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Icons } from "@repo/ui/components/icons";

/**
 * Custom Organization Selection Page
 * 
 * Simple organization creation flow that redirects to the cloud app root after
 * setting the active organization, letting the cloud app handle proper routing.
 */
export default function SelectOrganizationPage() {
  const redirectUrlComplete = getAppUrl("cloud");
  const [orgName, setOrgName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { createOrganization, setActive, userMemberships } = useOrganizationList();


  // CRITICAL: This page is ONLY for initial onboarding - NEVER for creating second organizations
  // If user already has organizations, immediately redirect them out
  useEffect(() => {
    if (userMemberships?.data && userMemberships.data.length > 0) {
      const firstMembership = userMemberships.data[0];
      if (!firstMembership) return; // Type guard
      const firstOrg = firstMembership.organization;
      console.log('⚠️ CRITICAL: User already has organization, this page is ONLY for initial onboarding');
      console.log('🔄 User has existing org:', firstOrg.id, 'redirecting immediately');
      
      if (firstOrg && setActive) {
        setActive({ organization: firstOrg.id }).then(() => {
          console.log('✅ Active organization set, redirecting to:', redirectUrlComplete);
          window.location.href = redirectUrlComplete;
        }).catch((error) => {
          console.error('❌ Error setting active organization:', error);
          window.location.href = redirectUrlComplete;
        });
      } else {
        // Fallback: redirect even without setting active
        console.log('⚠️ Fallback redirect for user with existing org');
        window.location.href = redirectUrlComplete;
      }
    }
  }, [userMemberships, setActive, redirectUrlComplete]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!orgName.trim() || !createOrganization) return;

    // CRITICAL: Double-check that user doesn't already have organizations (client-side)
    if (userMemberships?.data && userMemberships.data.length > 0) {
      console.error('🚫 CLIENT-SIDE BLOCKED: Attempted to create second organization');
      console.error('🚫 User already has organizations:', userMemberships.data.map((membership) => membership.organization.id));
      window.location.href = redirectUrlComplete;
      return;
    }
    
    setIsLoading(true);
    console.log('🚀 Starting organization creation...', { orgName: orgName.trim() });

    // CRITICAL: Server-side validation to prevent race conditions and bypasses
    try {
      const validationResponse = await fetch('/api/validate-org-creation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const validationResult = await validationResponse.json();
      
      if (!validationResponse.ok || !validationResult.canCreate) {
        console.error('🚫 SERVER-SIDE BLOCKED:', validationResult.error);
        window.location.href = redirectUrlComplete;
        return;
      }
      
      console.log('✅ Server-side validation passed, proceeding with org creation');
    } catch (error) {
      console.error('❌ Server validation failed:', error);
      setIsLoading(false);
      return;
    }
    
    try {
      // Create organization using Clerk JS SDK
      console.log('📝 Calling createOrganization...');
      const organization = await createOrganization({
        name: orgName.trim(),
      });
      
      console.log('✅ Organization created:', organization);

      // Set the newly created organization as active and redirect
      if (setActive && organization) {
        console.log('🔄 Setting active organization...', organization.id);
        await setActive({ organization: organization.id });
        console.log('✅ Active organization set, redirecting to:', redirectUrlComplete);
        
        // Redirect to root and let the cloud app handle routing
        window.location.href = redirectUrlComplete;
      } else {
        console.warn('⚠️ Could not set active organization - missing setActive or organization');
        setIsLoading(false);
      }
      
    } catch (error) {
      console.error('❌ Error creating organization:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Don't redirect on error - let user see the error and try again
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    // Skip org creation and go directly to cloud app root
    console.log('⏭️ Skipping organization creation, redirecting to:', redirectUrlComplete);
    window.location.href = redirectUrlComplete;
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