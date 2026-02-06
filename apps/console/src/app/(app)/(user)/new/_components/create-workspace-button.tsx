"use client";

import { useRouter } from "next/navigation";
import { useFormContext } from "react-hook-form";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { produce } from "immer";
import { Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "@repo/ui/components/ui/sonner";
import { useTRPC } from "@repo/console-trpc/react";
import { useOrganizationList } from "@clerk/nextjs";
import { useWorkspaceForm } from "./workspace-form-provider";
import type { WorkspaceFormValues } from "@repo/console-validation/forms";

/**
 * Create Workspace Button
 * Client island for workspace creation mutation and navigation
 * Supports multi-repo selection via two-step creation:
 * 1. Create workspace
 * 2. Bulk link selected repositories
 */
export function CreateWorkspaceButton() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setActive } = useOrganizationList();
  const form = useFormContext<WorkspaceFormValues>();

  // Read cached organization list
  const { data: organizations } = useSuspenseQuery({
    ...trpc.organization.listUserOrganizations.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Get form values
  const workspaceName = form.watch("workspaceName");
  const selectedOrgId = form.watch("organizationId");

  // Get GitHub-related state from context (now supports multiple repos)
  const { selectedRepositories, userSourceId, selectedInstallation } =
    useWorkspaceForm();

  // Find the organization by ID from tRPC cache
  const selectedOrg = organizations.find((org) => org.id === selectedOrgId);

  // Create workspace mutation with optimistic updates
  const createWorkspaceMutation = useMutation(
    trpc.workspaceAccess.create.mutationOptions({
      onMutate: async (variables) => {
        // Only proceed with optimistic update if we have an org slug
        if (!selectedOrg?.slug) {
          return { previous: undefined };
        }

        const orgSlug = selectedOrg.slug;

        // Cancel outgoing queries to prevent race conditions
        await queryClient.cancelQueries({
          queryKey: trpc.workspaceAccess.listByClerkOrgSlug.queryOptions({
            clerkOrgSlug: orgSlug,
          }).queryKey,
        });

        // Snapshot previous data for rollback
        const previous = queryClient.getQueryData(
          trpc.workspaceAccess.listByClerkOrgSlug.queryOptions({
            clerkOrgSlug: orgSlug,
          }).queryKey,
        );

        // Optimistically add new workspace to the list
        if (previous) {
          queryClient.setQueryData(
            trpc.workspaceAccess.listByClerkOrgSlug.queryOptions({
              clerkOrgSlug: orgSlug,
            }).queryKey,
            produce(previous, (draft) => {
              // Add optimistic workspace (will be replaced by server data)
              draft.push({
                id: "temp-" + Date.now(),
                name: variables.workspaceName,
                slug: variables.workspaceName
                  .toLowerCase()
                  .replace(/\s+/g, "-"),
                createdAt: new Date().toISOString(),
              });
            }),
          );
        }

        return { previous, orgSlug };
      },
      onError: (err, variables, context) => {
        // Rollback on error
        if (context?.previous && context.orgSlug) {
          queryClient.setQueryData(
            trpc.workspaceAccess.listByClerkOrgSlug.queryOptions({
              clerkOrgSlug: context.orgSlug,
            }).queryKey,
            context.previous,
          );
        }
      },
      onSettled: (data, error, variables, context) => {
        // Always invalidate to ensure consistency with server
        if (context?.orgSlug) {
          void queryClient.invalidateQueries({
            queryKey: trpc.workspaceAccess.listByClerkOrgSlug.queryOptions({
              clerkOrgSlug: context.orgSlug,
            }).queryKey,
          });
        }
      },
    }),
  );

  // Bulk link repositories mutation
  const bulkLinkMutation = useMutation(
    trpc.workspace.integrations.bulkLinkGitHubRepositories.mutationOptions({
      onError: (error) => {
        console.error("Failed to link repositories:", error);
        // Note: Workspace is already created, just show warning
        toast.error("Repositories not linked", {
          description: "Workspace created, but failed to connect repositories. You can add them later.",
        });
      },
    }),
  );

  const handleCreateWorkspace = async () => {
    // Trigger form validation
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error("Validation failed", {
        description: "Please fix the errors in the form before submitting.",
      });
      return;
    }

    if (!selectedOrgId) {
      toast.error("Organization required", {
        description: "Please select an organization.",
      });
      return;
    }

    if (!workspaceName) {
      toast.error("Workspace name required", {
        description: "Please enter a workspace name.",
      });
      return;
    }

    try {
      // Step 1: Create workspace (without repositories - we'll link them separately)
      const workspace = await createWorkspaceMutation.mutateAsync({
        clerkOrgId: selectedOrgId,
        workspaceName,
        // Note: Don't pass githubRepository here - we use bulk link instead
      });

      // Step 2: Set active organization before bulk linking (required for org-scoped procedures)
      if (setActive) {
        await setActive({ organization: selectedOrgId });
      }

      // Step 3: Bulk link repositories if any selected
      if (selectedRepositories.length > 0 && userSourceId && selectedInstallation) {
        await bulkLinkMutation.mutateAsync({
          workspaceId: workspace.workspaceId,
          userSourceId,
          installationId: selectedInstallation.id,
          repositories: selectedRepositories.map((repo) => ({
            repoId: repo.id,
            repoFullName: repo.fullName,
          })),
        });
      }

      // Show success toast
      const repoCount = selectedRepositories.length;
      toast.success("Workspace created!", {
        description: repoCount > 0
          ? `${workspaceName} has been created with ${repoCount} repositor${repoCount === 1 ? "y" : "ies"}.`
          : `${workspaceName} workspace is ready. Add sources to get started.`,
      });

      // Redirect to workspace
      const orgSlug = selectedOrg?.slug;
      const wsName = workspace.workspaceName;
      router.push(`/${orgSlug}/${wsName}`);
    } catch (error) {
      console.error("Workspace creation failed:", error);
      toast.error("Creation failed", {
        description: error instanceof Error ? error.message : "Failed to create workspace. Please try again.",
      });
    }
  };

  const isDisabled =
    !form.formState.isValid || createWorkspaceMutation.isPending || bulkLinkMutation.isPending;

  const isLoading = createWorkspaceMutation.isPending || bulkLinkMutation.isPending;

  return (
    <div className="mt-8 flex justify-end">
      <Button onClick={handleCreateWorkspace} disabled={isDisabled} size="lg">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating workspace...
          </>
        ) : (
          "Create workspace"
        )}
      </Button>
    </div>
  );
}
