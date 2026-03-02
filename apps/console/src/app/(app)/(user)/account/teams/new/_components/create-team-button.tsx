"use client";

import { useRouter } from "next/navigation";
import { useFormContext, useFormState } from "@repo/ui/components/ui/form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { produce } from "immer";
import { Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "@repo/ui/components/ui/sonner";
import { useTRPC } from "@repo/console-trpc/react";
import { useOrganizationList } from "@clerk/nextjs";
import type { TeamFormValues } from "@repo/console-validation/forms";
import { showErrorToast } from "~/lib/trpc-errors";

/**
 * Create Team Button
 * Client island for team creation mutation
 *
 * Features:
 * - Form validation before submission
 * - tRPC mutation to create Clerk organization
 * - Optimistic updates with rollback on error
 * - setActive() to activate new org in Clerk session before navigation
 * - Client-side navigation to workspace creation
 * - Toast notifications for success/error states
 */
export function CreateTeamButton() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setActive } = useOrganizationList();
  const form = useFormContext<TeamFormValues>();
  const { isValid } = useFormState({ control: form.control });

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

        showErrorToast(err, "Failed to create team", "Failed to create team. Please try again.");
      },
      onSuccess: async (data) => {
        toast.success(`Team created! Successfully created ${data.slug}`);

        // Activate the new org in Clerk's session before navigating
        // This ensures the /new page's org-scoped prefetch has the correct org context
        if (setActive) {
          await setActive({ organization: data.organizationId });
        }

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
    const valid = await form.trigger();
    if (!valid) {
      toast.error("Please fix the errors in the form before submitting.");
      return;
    }

    // Read current value imperatively — form.watch() subscriptions are
    // broken by React Compiler's memoization, causing stale closures.
    const currentTeamName = form.getValues("teamName");
    createOrgMutation.mutate({
      slug: currentTeamName,
    });
  };

  const isDisabled = !isValid || createOrgMutation.isPending;

  return (
    <Button
      onClick={handleCreateTeam}
      className="w-full"
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
