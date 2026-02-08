"use client";

import { useRouter } from "next/navigation";
import { useTRPC } from "@repo/console-trpc/react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@repo/ui/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "@repo/ui/components/ui/sonner";
import { useConnectForm } from "./connect-form-provider";
import { showErrorToast } from "~/lib/trpc-errors";

export function ConnectButton() {
  const router = useRouter();
  const trpc = useTRPC();
  const {
    provider,
    selectedResources,
    workspaceId,
    userSourceId,
    selectedInstallationId,
    clerkOrgSlug,
    workspaceName,
  } = useConnectForm();

  // GitHub bulk link mutation
  const githubMutation = useMutation({
    ...trpc.workspace.integrations.bulkLinkGitHubRepositories.mutationOptions(),
    onSuccess: (result) => {
      const count = result.created + result.reactivated;
      toast.success(`Connected ${count} repositor${count === 1 ? "y" : "ies"}`);
      router.push(`/${clerkOrgSlug}/${workspaceName}/sources`);
    },
    onError: (error) => {
      showErrorToast(error, "Failed to connect repositories");
    },
  });

  // Vercel bulk link mutation
  const vercelMutation = useMutation({
    ...trpc.workspace.integrations.bulkLinkVercelProjects.mutationOptions(),
    onSuccess: (result) => {
      const count = result.created + result.reactivated;
      toast.success(`Connected ${count} project${count === 1 ? "" : "s"}`);
      router.push(`/${clerkOrgSlug}/${workspaceName}/sources`);
    },
    onError: (error) => {
      showErrorToast(error, "Failed to connect projects");
    },
  });

  const isPending = githubMutation.isPending || vercelMutation.isPending;
  const isDisabled =
    selectedResources.length === 0 || !workspaceId || isPending;

  const handleConnect = () => {
    if (!workspaceId) return;

    if (provider === "github" && userSourceId && selectedInstallationId) {
      githubMutation.mutate({
        workspaceId,
        userSourceId,
        installationId: selectedInstallationId,
        repositories: selectedResources.map((r) => ({
          repoId: r.id,
          repoFullName: r.fullName ?? r.name,
        })),
      });
    } else if (provider === "vercel" && userSourceId) {
      vercelMutation.mutate({
        workspaceId,
        userSourceId,
        projects: selectedResources.map((r) => ({
          projectId: r.id,
          projectName: r.name,
        })),
      });
    }
  };

  const resourceLabel =
    provider === "github"
      ? `Repositor${selectedResources.length === 1 ? "y" : "ies"}`
      : `Project${selectedResources.length === 1 ? "" : "s"}`;

  return (
    <div className="flex items-center justify-between mt-8 pt-6 border-t">
      <Button
        variant="outline"
        onClick={() => router.push(`/${clerkOrgSlug}/${workspaceName}/sources`)}
      >
        Cancel
      </Button>
      <Button onClick={handleConnect} disabled={isDisabled}>
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Connecting...
          </>
        ) : (
          `Connect ${selectedResources.length} ${resourceLabel}`
        )}
      </Button>
    </div>
  );
}
