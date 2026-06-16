import { toast } from "@repo/ui/components/ui/sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  organizationQueryKeys,
  type UserOrganizationsData,
  updateOrganizationNameMutationOptions,
} from "~/organization/organization-queries";
import { useTRPC } from "~/trpc/react";

const DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeTeamSlugInput(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
}

export function normalizeTeamDomainInput(value: string) {
  const trimmed = value.trim().toLowerCase();
  const withoutEmailLocalPart = trimmed.includes("@")
    ? (trimmed.split("@").at(-1) ?? "")
    : trimmed;
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(withoutEmailLocalPart)
    ? withoutEmailLocalPart
    : `https://${withoutEmailLocalPart}`;

  let hostname = "";
  try {
    hostname = new URL(withProtocol).hostname;
  } catch {
    hostname = withoutEmailLocalPart.split(/[/?#]/, 1)[0] ?? "";
  }

  return hostname
    .replace(/^\.+|\.+$/g, "")
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

export function parseTeamDomainInput(value: string) {
  const domains = value
    .split(/[\s,;]+/)
    .map(normalizeTeamDomainInput)
    .filter((domain) => DOMAIN_PATTERN.test(domain));

  return [...new Set(domains)];
}

export function normalizeTeamDomainList(domains: string[]) {
  return [...new Set(domains.flatMap(parseTeamDomainInput))];
}

export function renameOrganizationSlug(
  organizations: UserOrganizationsData | undefined,
  {
    name,
    slug,
  }: {
    name: string;
    slug: string;
  }
) {
  return organizations?.map((organization) =>
    organization.slug === slug
      ? { ...organization, name, slug: name }
      : organization
  );
}

export function useTeamNameUpdate({
  onUpdated,
}: {
  onUpdated: (data: { id: string; name: string }) => Promise<void>;
}) {
  const queryClient = useQueryClient();

  const updateNameMutation = useMutation({
    ...updateOrganizationNameMutationOptions(),
    onMutate: async (input) => {
      await queryClient.cancelQueries({
        queryKey: organizationQueryKeys.list(),
      });
      const previousOrgs = queryClient.getQueryData<UserOrganizationsData>(
        organizationQueryKeys.list()
      );
      queryClient.setQueryData<UserOrganizationsData>(
        organizationQueryKeys.list(),
        (old) => renameOrganizationSlug(old, input)
      );
      return { previousOrgs };
    },
    onError: (_err, _input, context) => {
      if (context?.previousOrgs) {
        queryClient.setQueryData(
          organizationQueryKeys.list(),
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
      void queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.list(),
      });
    },
  });

  const updateTeamName = useCallback(
    (name: string, slug: string) => updateNameMutation.mutate({ name, slug }),
    [updateNameMutation.mutate]
  );

  return {
    isUpdating: updateNameMutation.isPending,
    updateTeamName,
  };
}

export function useTeamDomainsUpdate({
  onError,
  onUpdated,
  slug,
}: {
  onError?: () => void;
  onUpdated?: (domains: { id: string; name: string }[]) => void;
  slug: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const updateDomainsMutation = useMutation(
    trpc.org.settings.organization.updateDomains.mutationOptions({
      meta: { errorTitle: "Failed to update domains" },
      onError: () => {
        onError?.();
      },
      onSuccess: (domains) => {
        toast.success("Domains updated!", {
          description: "Matching email domains will auto-join this team.",
        });
        onUpdated?.(domains);
      },
      onSettled: () => {
        void queryClient.invalidateQueries(
          trpc.org.settings.organization.listDomains.queryFilter({ slug })
        );
      },
    })
  );

  const updateTeamDomains = useCallback(
    (domains: string[]) => updateDomainsMutation.mutate({ domains, slug }),
    [slug, updateDomainsMutation.mutate]
  );

  return {
    isUpdatingDomains: updateDomainsMutation.isPending,
    updateTeamDomains,
  };
}
