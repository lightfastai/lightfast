import {
  createOrganization,
  getOrganizationBySlug,
  type ListUserOrganizationsResult,
  listUserOrganizations,
  updateOrganizationName,
} from "@api/app/tanstack/organizations";
import { mutationOptions, queryOptions } from "@tanstack/react-query";

export type UserOrganizationsData = ListUserOrganizationsResult;

export const organizationQueryKeys = {
  all: ["organizations"] as const,
  bySlug: (slug: string) => ["organizations", "by-slug", slug] as const,
  list: () => ["organizations", "list"] as const,
};

export function listUserOrganizationsQueryOptions(input?: {
  enabled?: boolean;
}) {
  return queryOptions({
    enabled: (input?.enabled ?? true) && typeof window !== "undefined",
    queryFn: () => listUserOrganizations(),
    queryKey: organizationQueryKeys.list(),
    staleTime: 5 * 60 * 1000,
  });
}

export function organizationBySlugQueryOptions(input: {
  enabled?: boolean;
  slug: string;
}) {
  return queryOptions({
    enabled: (input.enabled ?? true) && typeof window !== "undefined",
    queryFn: () => getOrganizationBySlug({ data: { slug: input.slug } }),
    queryKey: organizationQueryKeys.bySlug(input.slug),
    staleTime: 5 * 60 * 1000,
  });
}

export function createOrganizationMutationOptions() {
  return mutationOptions({
    meta: { suppressErrorToast: true },
    mutationFn: (data: { idempotencyKey: string; slug: string }) =>
      createOrganization({ data }),
  });
}

export function updateOrganizationNameMutationOptions() {
  return mutationOptions({
    meta: { errorTitle: "Failed to update team name" },
    mutationFn: (data: { name: string; slug: string }) =>
      updateOrganizationName({ data }),
  });
}
