"use client";

import { useRouter } from "next/navigation";
import { useOrganizationList } from "@clerk/nextjs";
import { useFormContext } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
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

  // Resolve workspace from organization
  const { data: workspace, isLoading: isLoadingWorkspace } = useQuery({
    ...trpc.workspace.resolveFromClerkOrgId.queryOptions({
      clerkOrgId: selectedOrgId ?? "",
    }),
    enabled: Boolean(selectedOrgId),
  });

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
      onSuccess: (data) => {
        toast({
          title: "Workspace created!",
          description: `${workspaceName} has been created and is syncing.`,
        });

        // Find the organization by ID
        const selectedOrg = userMemberships?.data?.find(
          (membership) => membership.organization.id === selectedOrgId,
        );

        // Redirect to specific workspace page
        const orgSlug = selectedOrg?.organization.slug;
        const wsSlug = workspace?.workspaceSlug;
        router.push(`/${orgSlug}/${wsSlug}`);
      },
      onError: (error) => {
        toast({
          title: "Creation failed",
          description:
            error.message ?? "Failed to create workspace. Please try again.",
          variant: "destructive",
        });
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

    if (!workspace?.workspaceId) {
      toast({
        title: "Workspace not found",
        description: "Failed to resolve workspace for this organization.",
        variant: "destructive",
      });
      return;
    }

    // Find the organization by ID for redirect
    const selectedOrg = userMemberships?.data?.find(
      (membership) => membership.organization.id === selectedOrgId,
    );

    // If no repository selected, just redirect to workspace
    if (!selectedRepository) {
      toast({
        title: "Workspace ready!",
        description: `${workspaceName} workspace is ready. Add sources to get started.`,
      });
      const orgSlug = selectedOrg?.organization.slug;
      const wsSlug = workspace?.workspaceSlug;
      router.push(`/${orgSlug}/${wsSlug}`);
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

    try {
      // Step 1: Create integration resource
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

      // Step 2: Connect resource to workspace
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
    } catch (error) {
      console.error("Workspace creation failed:", error);
    }
  };

  const isDisabled =
    !form.formState.isValid ||
    createResourceMutation.isPending ||
    connectWorkspaceMutation.isPending ||
    isLoadingWorkspace ||
    !workspace?.workspaceId;

  const isLoading =
    createResourceMutation.isPending || connectWorkspaceMutation.isPending;

  return (
    <div className="mt-8 flex justify-end">
      <Button onClick={handleCreateWorkspace} disabled={isDisabled} size="lg">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {createResourceMutation.isPending ? "Creating..." : "Connecting..."}
          </>
        ) : (
          "Create workspace"
        )}
      </Button>
    </div>
  );
}
