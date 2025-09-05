"use client";

import { useState } from "react";
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

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!orgName.trim()) return;
    
    setIsLoading(true);
    
    // Simulate org creation delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Redirect to cloud app
    window.location.href = "http://localhost:4103/dashboard";
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