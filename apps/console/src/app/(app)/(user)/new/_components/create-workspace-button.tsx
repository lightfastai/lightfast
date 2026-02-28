"use client";

import { useRouter } from "next/navigation";
import { useFormContext, useFormState } from "@repo/ui/components/ui/form";
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
import { showErrorToast } from "~/lib/trpc-errors";
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
  const { isValid } = useFormState({ control: form.control });

  // Read cached organization list
  const { data: organizations } = useSuspenseQuery({
    ...trpc.organization.listUserOrganizations.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Get source selection state from context
  const { selectedRepositories, gwInstallationId, selectedInstallation, vercelInstallationId, selectedProjects } =
    useWorkspaceForm();

  // Create workspace mutation with optimistic updates
  const createWorkspaceMutation = useMutation(
    trpc.workspaceAccess.create.mutationOptions({
      onMutate: async (variables) => {
        // Read current org at call time to avoid stale closures
        const currentOrgId = form.getValues("organizationId");
        const currentOrg = organizations.find((org) => org.id === currentOrgId);

        // Only proceed with optimistic update if we have an org slug
        if (!currentOrg?.slug) {
          return { previous: undefined };
        }

        const orgSlug = currentOrg.slug;

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

  // Bulk link GitHub repositories mutation
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

  // Bulk link Vercel projects mutation
  const bulkLinkVercelMutation = useMutation(
    trpc.workspace.integrations.bulkLinkVercelProjects.mutationOptions({
      onError: (error) => {
        console.error("Failed to link Vercel projects:", error);
        toast.error("Vercel projects not linked", {
          description: "Workspace created, but failed to connect Vercel projects. You can add them later.",
        });
      },
    }),
  );

  const handleCreateWorkspace = async () => {
    const formValid = await form.trigger();
    if (!formValid) {
      toast.error("Validation failed", {
        description: "Please fix the errors in the form before submitting.",
      });
      return;
    }

    const selectedOrgId = form.getValues("organizationId");
    const workspaceName = form.getValues("workspaceName");

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

    createWorkspaceMutation
      .mutateAsync({
        clerkOrgId: selectedOrgId,
        workspaceName,
      })
      .then(async (workspace) => {
        if (setActive) {
          await setActive({ organization: selectedOrgId });
        }

        // Bulk-link selected sources in parallel
        const [githubResult, vercelResult] = await Promise.allSettled([
          selectedRepositories.length > 0 && gwInstallationId && selectedInstallation
            ? bulkLinkMutation.mutateAsync({
                workspaceId: workspace.workspaceId,
                gwInstallationId,
                installationId: selectedInstallation.id,
                repositories: selectedRepositories.map((repo) => ({
                  repoId: repo.id,
                  repoFullName: repo.fullName,
                })),
              })
            : Promise.resolve(null),
          selectedProjects.length > 0 && vercelInstallationId
            ? bulkLinkVercelMutation.mutateAsync({
                workspaceId: workspace.workspaceId,
                gwInstallationId: vercelInstallationId,
                projects: selectedProjects.map((p) => ({
                  projectId: p.id,
                  projectName: p.name,
                })),
              })
            : Promise.resolve(null),
        ]);

        const repoCount =
          githubResult.status === "fulfilled" && githubResult.value
            ? githubResult.value.created + githubResult.value.reactivated
            : 0;
        const projectCount =
          vercelResult.status === "fulfilled" && vercelResult.value
            ? vercelResult.value.created + vercelResult.value.reactivated
            : 0;
        const totalLinked = repoCount + projectCount;

        toast.success("Workspace created!", {
          description:
            totalLinked > 0
              ? `${workspace.workspaceName} has been created with ${totalLinked} source${totalLinked === 1 ? "" : "s"} linked.`
              : `${workspace.workspaceName} workspace is ready. Add sources to get started.`,
        });

        const selectedOrg = organizations.find((org) => org.id === selectedOrgId);
        if (!selectedOrg?.slug) {
          router.push("/");
          return;
        }
        router.push(`/${selectedOrg.slug}/${workspace.workspaceName}`);
      })
      .catch((error: unknown) => {
        console.error("Workspace creation failed:", error);
        showErrorToast(error, "Creation failed", "Failed to create workspace. Please try again.");
      });
  };

  const isDisabled =
    !isValid || createWorkspaceMutation.isPending || bulkLinkMutation.isPending || bulkLinkVercelMutation.isPending;

  const isLoading = createWorkspaceMutation.isPending || bulkLinkMutation.isPending || bulkLinkVercelMutation.isPending;

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
