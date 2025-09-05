"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";

/**
 * Organization Selection Task Page
 * 
 * This page handles the organization selection flow for authenticated users.
 * Since the user has already been authenticated and has organizations, 
 * we auto-redirect them to the cloud app dashboard.
 */
export default function SelectOrganizationPage() {
  useEffect(() => {
    // Auto-redirect to cloud app after a short delay
    const timer = setTimeout(() => {
      window.location.href = "http://localhost:4103/dashboard";
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleManualRedirect = () => {
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
            Setting up your workspace...
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-center p-8">
            <Icons.spinner className="h-8 w-8 animate-spin" />
            <span className="ml-3 text-muted-foreground">
              Redirecting to dashboard...
            </span>
          </div>

          <div className="text-center">
            <Button 
              onClick={handleManualRedirect}
              variant="outline"
              className="w-full h-12"
            >
              Continue to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}