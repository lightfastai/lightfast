"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { useToast } from "@repo/ui/hooks/use-toast";

/**
 * Onboarding Step 1: Create Team
 *
 * User creates a Clerk organization using only a slug.
 * The slug is used as both the name and slug in Clerk.
 * After creation, redirects to /new?teamSlug={slug}.
 *
 * Design: Clean, minimal form following Vercel's onboarding aesthetic.
 */
export default function OnboardingPage() {
  const [slug, setSlug] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { setActive } = useClerk();

  const handleSlugChange = (value: string) => {
    // Normalize slug: lowercase, alphanumeric + hyphens only
    const normalized = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
    setSlug(normalized);
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!slug) {
      toast({
        title: "Missing team name",
        description: "Please provide a team name",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/organizations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as {
          error?: string;
          message?: string;
        };
        throw new Error(
          error.message ?? error.error ?? "Failed to create team",
        );
      }

      const data = (await response.json()) as {
        organizationId: string;
        slug: string;
        workspaceId: string;
      };

      // Set the created organization as active in Clerk session
      await setActive({
        organization: data.organizationId,
      });

      toast({
        title: "Team created!",
        description: `Successfully created ${slug}`,
      });

      // Redirect to new project page
      router.push(`/new?teamSlug=${data.slug}`);
    } catch (error) {
      toast({
        title: "Failed to create team",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        {/* Title */}
        <h1 className="text-center text-4xl font-bold tracking-tight">
          Create Your Team
        </h1>

        {/* Form */}
        <form onSubmit={handleCreateOrg} className="space-y-6">
          {/* Team Name Input */}
          <div className="space-y-2">
            <Label htmlFor="slug" className="text-sm font-medium">
              Your Team Name
            </Label>
            <Input
              id="slug"
              type="text"
              placeholder="Acme Inc"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              disabled={isCreating}
              autoFocus
              required
              pattern="[a-z0-9-]+"
              minLength={3}
              maxLength={50}
              className="h-12 text-base"
            />
          </div>

          {/* Continue Button */}
          <Button
            type="submit"
            className="h-12 w-full text-base font-medium"
            disabled={isCreating || !slug || slug.length < 3}
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
