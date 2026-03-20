"use client";

import {
  PROVIDER_DISPLAY,
  type ProviderSlug,
} from "@repo/app-providers/client";
import { useTRPC } from "@repo/app-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import { toast } from "@repo/ui/components/ui/sonner";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSourceSelection } from "./source-selection-provider";

interface LinkSourcesButtonProps {
  clerkOrgSlug: string;
  workspaceName: string;
}

export function LinkSourcesButton({
  clerkOrgSlug,
  workspaceName,
}: LinkSourcesButtonProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { getState, hasAnySelection } = useSourceSelection();

  const { data: sourcesData } = useSuspenseQuery({
    ...trpc.workspace.sources.list.queryOptions({
      clerkOrgSlug,
      workspaceName,
    }),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const workspaceId = sourcesData.workspaceId;

  const linkMutation = useMutation(
    trpc.workspace.integrations.bulkLinkResources.mutationOptions({
      onError: (error) => {
        console.error("Failed to link sources:", error);
        toast.error("Sources not linked", {
          description: "Failed to connect sources. You can try again.",
        });
      },
    })
  );

  const handleLinkSources = async () => {
    const mutations = (Object.keys(PROVIDER_DISPLAY) as ProviderSlug[])
      .map((providerKey) => {
        const state = getState(providerKey);
        if (state.selectedResources.length === 0) {
          return null;
        }
        const installation = state.selectedInstallation;
        if (!installation) {
          return null;
        }
        return linkMutation.mutateAsync({
          provider: providerKey,
          workspaceId,
          gwInstallationId: installation.id,
          resources: state.selectedResources.map((r) => ({
            resourceId: r.id,
            resourceName: r.linkName ?? r.name,
          })),
        });
      })
      .filter(Boolean);

    const results = await Promise.allSettled(mutations);

    let totalLinked = 0;
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        totalLinked += result.value.created + result.value.reactivated;
      }
    }

    if (totalLinked > 0) {
      toast.success("Sources linked!", {
        description: `${totalLinked} source${totalLinked === 1 ? "" : "s"} connected to this workspace.`,
      });
    }

    void queryClient.invalidateQueries({
      queryKey: trpc.workspace.sources.list.queryOptions({
        clerkOrgSlug,
        workspaceName,
      }).queryKey,
    });

    router.push(`/${clerkOrgSlug}/${workspaceName}/sources`);
  };

  return (
    <div className="mt-8 flex items-center justify-between">
      <Button asChild size="sm" variant="outline">
        <Link href={`/${clerkOrgSlug}/${workspaceName}/sources`}>
          Go back to sources
        </Link>
      </Button>
      <Button
        disabled={!hasAnySelection() || linkMutation.isPending}
        onClick={handleLinkSources}
        size="sm"
      >
        {linkMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Linking sources...
          </>
        ) : (
          "Link Sources"
        )}
      </Button>
    </div>
  );
}
