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
import { useToast } from "@repo/ui/hooks/use-toast";
import { useTRPC } from "@repo/console-trpc/react";
import { useOrganizationList } from "@clerk/nextjs";
import { useWorkspaceForm } from "./workspace-form-provider";
import type { WorkspaceFormValues } from "@repo/console-validation/forms";

/**
 * Create Workspace Button
 * Client island for workspace creation mutation and navigation
 */
export function CreateWorkspaceButton() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
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

  // Get GitHub-related state from context
  const { selectedRepository, userSourceId, selectedInstallation } =
    useWorkspaceForm();

  // Find the organization by ID from tRPC cache
  const selectedOrg = organizations.find((org) => org.id === selectedOrgId);

  // Create workspace mutation with optimistic updates
  // Use workspaceAccess (user router) for pending user support
  // Optionally connects GitHub repository atomically (prevents race conditions)
  const createWorkspaceMutation = useMutation(
    trpc.workspaceAccess.create.mutationOptions({
      onMutate: async (variables) => {
        // Only proceed with optimistic update if we have an org slug
        if (!selectedOrg?.slug) {
          return { previous: undefined };
        }

        const orgSlug = selectedOrg.slug;

        // Cancel outgoing queries to prevent race conditions
        // Use workspaceAccess (user router) instead of workspace (org router) for pending users
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
                name: variables.workspaceName, // User-facing name used in URLs
                slug: variables.workspaceName
                  .toLowerCase()
                  .replace(/\s+/g, "-"), // Internal slug
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

  const handleCreateWorkspace = async () => {
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

    if (!selectedOrgId) {
      toast({
        title: "Organization required",
        description: "Please select an organization.",
        variant: "destructive",
      });
      return;
    }

    if (!workspaceName) {
      toast({
        title: "Workspace name required",
        description: "Please enter a workspace name.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Build repository connection data if repository is selected
      let githubRepository = undefined;
      if (selectedRepository && userSourceId && selectedInstallation) {
        githubRepository = {
          userSourceId,
          installationId: selectedInstallation.id,
          repoId: selectedRepository.id,
          repoName: selectedRepository.name,
          repoFullName: selectedRepository.fullName,
          defaultBranch: selectedRepository.defaultBranch,
          isPrivate: selectedRepository.isPrivate,
          isArchived: selectedRepository.isArchived,
          syncConfig: {
            branches: [selectedRepository.defaultBranch],
            paths: ["**/*"],
            events: [],
            autoSync: true,
          },
        };
      }

      // Create workspace (and optionally connect repository atomically)
      const workspace = await createWorkspaceMutation.mutateAsync({
        clerkOrgId: selectedOrgId,
        workspaceName,
        githubRepository,
      });

      // Show success toast
      const hasRepository = Boolean(githubRepository);
      toast({
        title: "Workspace created!",
        description: hasRepository
          ? `${workspaceName} has been created and is syncing.`
          : `${workspaceName} workspace is ready. Add sources to get started.`,
      });

      // Set active organization before navigation (prevents race conditions)
      // Ensures Clerk cookies are updated before RSC request
      if (setActive) {
        await setActive({ organization: selectedOrgId });
      }

      // Redirect to workspace
      const orgSlug = selectedOrg?.slug;
      const wsName = workspace.workspaceName;
      router.push(`/${orgSlug}/${wsName}`);
    } catch (error) {
      console.error("Workspace creation failed:", error);
      toast({
        title: "Creation failed",
        description: error instanceof Error ? error.message : "Failed to create workspace. Please try again.",
        variant: "destructive",
      });
    }
  };

  const isDisabled =
    !form.formState.isValid || createWorkspaceMutation.isPending;

  const isLoading = createWorkspaceMutation.isPending;

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
