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
  const createWorkspaceMutation = useMutation(
    trpc.workspace.create.mutationOptions({
      onMutate: async (variables) => {
        // Only proceed with optimistic update if we have an org slug
        if (!selectedOrg?.slug) {
          return { previous: undefined };
        }

        const orgSlug = selectedOrg.slug;

        // Cancel outgoing queries to prevent race conditions
        await queryClient.cancelQueries({
          queryKey: trpc.workspace.listByClerkOrgSlug.queryOptions({
            clerkOrgSlug: orgSlug,
          }).queryKey,
        });

        // Snapshot previous data for rollback
        const previous = queryClient.getQueryData(
          trpc.workspace.listByClerkOrgSlug.queryOptions({
            clerkOrgSlug: orgSlug,
          }).queryKey,
        );

        // Optimistically add new workspace to the list
        if (previous) {
          queryClient.setQueryData(
            trpc.workspace.listByClerkOrgSlug.queryOptions({
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
                repositories: [],
                totalDocuments: 0,
                lastActivity: new Date().toISOString(),
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
            trpc.workspace.listByClerkOrgSlug.queryOptions({
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
            queryKey: trpc.workspace.listByClerkOrgSlug.queryOptions({
              clerkOrgSlug: context.orgSlug,
            }).queryKey,
          });
        }
      },
    }),
  );

  // Connect repository directly to workspace (NEW simplified 2-table API)
  const connectDirectMutation = useMutation(
    trpc.integration.workspace.connectDirect.mutationOptions({
      onError: (error) => {
        const message = error instanceof Error ? error.message : null;
        toast({
          title: "Connection failed",
          description:
            message ?? "Failed to connect repository. Please try again.",
          variant: "destructive",
        });
      },
      onSettled: () => {
        // Invalidate workspace list to ensure it's up to date
        const orgSlug = selectedOrg?.slug;
        if (orgSlug) {
          void queryClient.invalidateQueries({
            queryKey: trpc.workspace.listByClerkOrgSlug.queryOptions({
              clerkOrgSlug: orgSlug,
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
      // Step 1: Create workspace with user-provided name
      const workspace = await createWorkspaceMutation.mutateAsync({
        clerkOrgId: selectedOrgId,
        workspaceName,
      });

      // If no repository selected, just redirect to workspace
      if (!selectedRepository) {
        toast({
          title: "Workspace created!",
          description: `${workspaceName} workspace is ready. Add sources to get started.`,
        });
        const orgSlug = selectedOrg?.slug;
        const wsName = workspace.workspaceName;
        router.push(`/${orgSlug}/${wsName}`);
        return;
      }

      // Validate repository-specific requirements
      if (!userSourceId || !selectedInstallation) {
        toast({
          title: "GitHub not connected",
          description: "Please connect your GitHub account first.",
          variant: "destructive",
        });
        return;
      }

      // Step 2: Connect repository directly to workspace (NEW simplified API)
      const orgSlug = selectedOrg?.slug;
      if (!orgSlug) {
        throw new Error("Organization slug not found");
      }

      await connectDirectMutation.mutateAsync({
        clerkOrgSlug: orgSlug,
        workspaceName: workspace.workspaceName,
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
      });

      // Show success toast and redirect
      toast({
        title: "Workspace created!",
        description: `${workspaceName} has been created and is syncing.`,
      });

      router.push(`/${orgSlug}/${workspace.workspaceName}`);
    } catch (error) {
      console.error("Workspace creation failed:", error);
      // Error toast is shown by mutation onError handlers
    }
  };

  const isDisabled =
    !form.formState.isValid ||
    createWorkspaceMutation.isPending ||
    connectDirectMutation.isPending;

  const isLoading =
    createWorkspaceMutation.isPending || connectDirectMutation.isPending;

  return (
    <div className="mt-8 flex justify-end">
      <Button onClick={handleCreateWorkspace} disabled={isDisabled} size="lg">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {createWorkspaceMutation.isPending
              ? "Creating workspace..."
              : "Connecting repository..."}
          </>
        ) : (
          "Create workspace"
        )}
      </Button>
    </div>
  );
}
