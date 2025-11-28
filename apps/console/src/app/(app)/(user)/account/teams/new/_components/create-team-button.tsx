"use client";

import { useRouter } from "next/navigation";
import { useFormContext } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { produce } from "immer";
import { Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { useToast } from "@repo/ui/hooks/use-toast";
import { useTRPC } from "@repo/console-trpc/react";
import type { TeamFormValues } from "@repo/console-validation/forms";

/**
 * Create Team Button
 * Client island for team creation mutation
 *
 * Features:
 * - Form validation before submission
 * - tRPC mutation to create Clerk organization
 * - Optimistic updates with rollback on error
 * - Client-side navigation to workspace creation
 * - Toast notifications for success/error states
 *
 * Note: No setActive() call needed - user can select org from dropdown.
 * The middleware will activate the org when they navigate to /:slug routes.
 */
export function CreateTeamButton() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const form = useFormContext<TeamFormValues>();

  const teamName = form.watch("teamName");

  // Create organization mutation with optimistic updates
  const createOrgMutation = useMutation(
    trpc.organization.create.mutationOptions({
      onMutate: async (variables) => {
        // Cancel outgoing queries to prevent race conditions
        await queryClient.cancelQueries({
          queryKey: trpc.organization.listUserOrganizations.queryOptions()
            .queryKey,
        });

        // Snapshot previous data for rollback
        const previousOrgs = queryClient.getQueryData(
          trpc.organization.listUserOrganizations.queryOptions().queryKey,
        );

        // Optimistically update the organization list
        if (previousOrgs) {
          queryClient.setQueryData(
            trpc.organization.listUserOrganizations.queryOptions().queryKey,
            produce(previousOrgs, (draft) => {
              // Add the new organization to the list
              draft.unshift({
                id: "temp-" + Date.now(), // Temporary ID
                name: variables.slug,
                slug: variables.slug,
                role: "org:admin",
                imageUrl: "",
              });
            }),
          );
        }

        return { previousOrgs };
      },
      onError: (err, variables, context) => {
        // Rollback on error
        if (context?.previousOrgs) {
          queryClient.setQueryData(
            trpc.organization.listUserOrganizations.queryOptions().queryKey,
            context.previousOrgs,
          );
        }

        toast({
          title: "Failed to create team",
          description: err.message || "Please try again.",
          variant: "destructive",
        });
      },
      onSuccess: (data) => {
        toast({
          title: "Team created!",
          description: `Successfully created ${teamName}`,
        });

        // Navigate to workspace creation
        // The org is already in the cache (optimistic update)
        // and will be available via organization.listUserOrganizations on the /new page
        router.push(`/new?teamSlug=${data.slug}`);
      },
      onSettled: () => {
        // Invalidate to ensure consistency with server
        void queryClient.invalidateQueries({
          queryKey: trpc.organization.listUserOrganizations.queryOptions()
            .queryKey,
        });
      },
    }),
  );

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

    // Call tRPC mutation
    createOrgMutation.mutate({
      slug: teamName,
    });
  };

  const isDisabled = !form.formState.isValid || createOrgMutation.isPending;

  return (
    <Button
      onClick={handleCreateTeam}
      className="h-12 w-full text-base font-medium"
      disabled={isDisabled}
    >
      {createOrgMutation.isPending ? (
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
