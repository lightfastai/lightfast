"use client";

import { useRouter } from "next/navigation";
import { useOrganizationList } from "@clerk/nextjs";
import { useFormContext } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { produce } from "immer";
import { Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { useToast } from "@repo/ui/hooks/use-toast";
import { useTRPC } from "@repo/console-trpc/react";
import { useWorkspaceForm } from "./workspace-form-provider";
import type { WorkspaceFormValues } from "./workspace-form-schema";

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
  const { userMemberships } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });

  // Get form values
  const workspaceName = form.watch("workspaceName");
  const selectedOrgId = form.watch("organizationId");

  // Get GitHub-related state from context
  const {
    selectedRepository,
    integrationId,
    selectedInstallation,
  } = useWorkspaceForm();

  // Find the organization by ID
  const selectedOrg = userMemberships?.data?.find(
    (membership) => membership.organization.id === selectedOrgId,
  );

  // Create workspace mutation with optimistic updates
  const createWorkspaceMutation = useMutation(
    trpc.workspace.create.mutationOptions({
      onMutate: async (variables) => {
        // Only proceed with optimistic update if we have an org slug
        if (!selectedOrg?.organization.slug) {
          return { previous: undefined };
        }

        const orgSlug = selectedOrg.organization.slug;

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
                name: variables.workspaceName,  // User-facing name used in URLs
                slug: variables.workspaceName.toLowerCase().replace(/\s+/g, "-"),  // Internal slug
                isDefault: false,
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
        if (context?.previous && context?.orgSlug) {
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

  // Create integration resource mutation
  const createResourceMutation = useMutation(
    trpc.integration.resources.create.mutationOptions({
      onError: (error) => {
        toast({
          title: "Failed to create resource",
          description:
            error.message ??
            "Failed to create integration resource. Please try again.",
          variant: "destructive",
        });
      },
    }),
  );

  // Connect resource to workspace mutation (with Inngest trigger moved to server)
  const connectWorkspaceMutation = useMutation(
    trpc.integration.workspace.connect.mutationOptions({
      onError: (error) => {
        toast({
          title: "Creation failed",
          description:
            error.message ?? "Failed to create workspace. Please try again.",
          variant: "destructive",
        });
      },
      onSettled: () => {
        // Invalidate workspace list to ensure it's up to date
        const orgSlug = selectedOrg?.organization.slug;
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
        const orgSlug = selectedOrg?.organization.slug;
        const wsName = workspace.workspaceName;
        router.push(`/${orgSlug}/${wsName}`);
        return;
      }

      // Validate repository-specific requirements
      if (!integrationId || !selectedInstallation) {
        toast({
          title: "GitHub not connected",
          description: "Please connect your GitHub account first.",
          variant: "destructive",
        });
        return;
      }

      // Step 2: Create integration resource
      const resource = await createResourceMutation.mutateAsync({
        integrationId,
        installationId: selectedInstallation.id,
        repoId: selectedRepository.id,
        repoName: selectedRepository.name,
        repoFullName: selectedRepository.fullName,
        defaultBranch: selectedRepository.defaultBranch,
        isPrivate: selectedRepository.isPrivate,
        isArchived: selectedRepository.isArchived,
      });

      if (!resource) {
        throw new Error("Failed to create resource");
      }

      // Step 3: Connect resource to workspace
      // Note: Background sync is now triggered server-side in the mutation
      await connectWorkspaceMutation.mutateAsync({
        workspaceId: workspace.workspaceId,
        resourceId: resource.id,
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

      const orgSlug = selectedOrg?.organization.slug;
      const wsName = workspace.workspaceName;
      router.push(`/${orgSlug}/${wsName}`);
    } catch (error) {
      console.error("Workspace creation failed:", error);
      // Error toast is shown by mutation onError handlers
    }
  };

  const isDisabled =
    !form.formState.isValid ||
    createWorkspaceMutation.isPending ||
    createResourceMutation.isPending ||
    connectWorkspaceMutation.isPending;

  const isLoading =
    createWorkspaceMutation.isPending ||
    createResourceMutation.isPending ||
    connectWorkspaceMutation.isPending;

  return (
    <div className="mt-8 flex justify-end">
      <Button onClick={handleCreateWorkspace} disabled={isDisabled} size="lg">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {createWorkspaceMutation.isPending
              ? "Creating workspace..."
              : createResourceMutation.isPending
                ? "Setting up repository..."
                : "Connecting..."}
          </>
        ) : (
          "Create workspace"
        )}
      </Button>
    </div>
  );
}
