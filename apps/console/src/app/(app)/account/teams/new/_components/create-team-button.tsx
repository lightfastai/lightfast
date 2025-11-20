"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useFormContext } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { useToast } from "@repo/ui/hooks/use-toast";
import type { TeamFormValues } from "./team-form-schema";

/**
 * Create Team Button
 * Client island for team creation mutation and navigation
 *
 * Features:
 * - Form validation before submission
 * - API call to create Clerk organization
 * - Sets active organization in Clerk session
 * - Redirects to workspace creation with teamSlug
 * - Toast notifications for success/error states
 */
export function CreateTeamButton() {
  const router = useRouter();
  const { toast } = useToast();
  const { setActive } = useClerk();
  const form = useFormContext<TeamFormValues>();
  const [isCreating, setIsCreating] = useState(false);

  const teamName = form.watch("teamName");

  const handleCreateTeam = async () => {
    // Trigger form validation
    const isValid = await form.trigger();
    if (!isValid) {
      toast({
        title: "Validation failed",
        description: "Please fix the errors in the form before submitting.",
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
          slug: teamName,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as {
          error?: string;
          message?: string;
        };
        throw new Error(
          error.message ?? error.error ?? "Failed to create team"
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
        description: `Successfully created ${teamName}`,
      });

      // Redirect to new workspace page with teamSlug
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

  const isDisabled = !form.formState.isValid || isCreating;

  return (
    <Button
      onClick={handleCreateTeam}
      className="h-12 w-full text-base font-medium"
      disabled={isDisabled}
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
  );
}
