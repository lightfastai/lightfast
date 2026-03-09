"use client";

import { useOrganizationList } from "@clerk/nextjs";
import { useTRPC } from "@repo/console-trpc/react";
import type { WorkspaceFormValues } from "@repo/console-validation/forms";
import { Button } from "@repo/ui/components/ui/button";
import { useFormContext, useFormState } from "@repo/ui/components/ui/form";
import { toast } from "@repo/ui/components/ui/sonner";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { produce } from "immer";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { showErrorToast } from "~/lib/trpc-errors";

/**
 * Create Workspace Button
 * Client island for workspace creation mutation and navigation.
 * After creation, redirects to sources/new for source connection.
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

  // Create workspace mutation with optimistic updates
  const createWorkspaceMutation = useMutation(
    trpc.workspaceAccess.create.mutationOptions({
      onMutate: async (variables) => {
        const currentOrgId = form.getValues("organizationId");
        const currentOrg = organizations.find((org) => org.id === currentOrgId);

        if (!currentOrg?.slug) {
          return { previous: undefined };
        }

        const orgSlug = currentOrg.slug;

        await queryClient.cancelQueries({
          queryKey: trpc.workspaceAccess.listByClerkOrgSlug.queryOptions({
            clerkOrgSlug: orgSlug,
          }).queryKey,
        });

        const previous = queryClient.getQueryData(
          trpc.workspaceAccess.listByClerkOrgSlug.queryOptions({
            clerkOrgSlug: orgSlug,
          }).queryKey
        );

        if (previous) {
          queryClient.setQueryData(
            trpc.workspaceAccess.listByClerkOrgSlug.queryOptions({
              clerkOrgSlug: orgSlug,
            }).queryKey,
            produce(previous, (draft) => {
              draft.push({
                id: `temp-${Date.now()}`,
                name: variables.workspaceName,
                slug: variables.workspaceName
                  .toLowerCase()
                  .replace(/\s+/g, "-"),
                createdAt: new Date().toISOString(),
              });
            })
          );
        }

        return { previous, orgSlug };
      },
      onError: (_err, _variables, context) => {
        if (context?.previous && context.orgSlug) {
          queryClient.setQueryData(
            trpc.workspaceAccess.listByClerkOrgSlug.queryOptions({
              clerkOrgSlug: context.orgSlug,
            }).queryKey,
            context.previous
          );
        }
      },
      onSettled: (_data, _error, _variables, context) => {
        if (context?.orgSlug) {
          void queryClient.invalidateQueries({
            queryKey: trpc.workspaceAccess.listByClerkOrgSlug.queryOptions({
              clerkOrgSlug: context.orgSlug,
            }).queryKey,
          });
        }
      },
    })
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

        toast.success("Workspace created!", {
          description: `${workspace.workspaceName} workspace is ready. Add sources to get started.`,
        });

        const selectedOrg = organizations.find(
          (org) => org.id === selectedOrgId
        );
        if (!selectedOrg?.slug) {
          router.push("/");
          return;
        }
        router.push(
          `/${selectedOrg.slug}/${workspace.workspaceName}/sources/new`
        );
      })
      .catch((error: unknown) => {
        console.error("Workspace creation failed:", error);
        showErrorToast(
          error,
          "Creation failed",
          "Failed to create workspace. Please try again."
        );
      });
  };

  const isDisabled = !isValid || createWorkspaceMutation.isPending;

  return (
    <div className="mt-8 flex justify-end">
      <Button disabled={isDisabled} onClick={handleCreateWorkspace} size="sm">
        {createWorkspaceMutation.isPending ? (
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
