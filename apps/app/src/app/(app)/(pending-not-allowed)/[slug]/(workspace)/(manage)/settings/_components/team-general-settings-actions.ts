"use client";

import { toast } from "@repo/ui/components/ui/sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTRPC } from "~/trpc/react";

export function normalizeTeamSlugInput(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
}

export function renameOrganizationSlug<T extends { slug: string }>(
  organizations: T[] | undefined,
  {
    name,
    slug,
  }: {
    name: string;
    slug: string;
  }
) {
  return organizations?.map((organization) =>
    organization.slug === slug ? { ...organization, slug: name } : organization
  );
}

export function useTeamNameUpdate({
  onUpdated,
}: {
  onUpdated: (data: { id: string; name: string }) => Promise<void>;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const updateNameMutation = useMutation(
    trpc.org.settings.organization.updateName.mutationOptions({
      meta: { errorTitle: "Failed to update team name" },
      onMutate: async (input) => {
        await queryClient.cancelQueries(
          trpc.viewer.organization.listUserOrganizations.queryFilter()
        );
        const previousOrgs = queryClient.getQueryData(
          trpc.viewer.organization.listUserOrganizations.queryKey()
        );
        queryClient.setQueryData(
          trpc.viewer.organization.listUserOrganizations.queryKey(),
          (old: typeof previousOrgs) => renameOrganizationSlug(old, input)
        );
        return { previousOrgs };
      },
      onError: (_err, _input, context) => {
        if (context?.previousOrgs) {
          queryClient.setQueryData(
            trpc.viewer.organization.listUserOrganizations.queryKey(),
            context.previousOrgs
          );
        }
      },
      onSuccess: async (data) => {
        toast.success("Team updated!", {
          description: `Team name changed to "${data.name}"`,
        });
        await onUpdated(data);
      },
      onSettled: () => {
        void queryClient.invalidateQueries(
          trpc.viewer.organization.listUserOrganizations.queryFilter()
        );
      },
    })
  );

  const updateTeamName = useCallback(
    (name: string, slug: string) => updateNameMutation.mutate({ name, slug }),
    [updateNameMutation.mutate]
  );

  return {
    isUpdating: updateNameMutation.isPending,
    updateTeamName,
  };
}
