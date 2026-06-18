import {
  getOrganizationBySlug,
  type ListOrganizationDomainsResult,
  type ListUserOrganizationsResult,
  listOrganizationDomains,
  listUserOrganizations,
} from "@api/app/tanstack/organizations";
import { queryOptions } from "@tanstack/react-query";

export type UserOrganizationsData = ListUserOrganizationsResult;
export type OrganizationDomainsData = ListOrganizationDomainsResult;

export const organizationQueryKeys = {
  all: ["organizations"] as const,
  bySlug: (slug: string) => ["organizations", "by-slug", slug] as const,
  domains: (slug: string) => ["organizations", "domains", slug] as const,
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

export function organizationDomainsQueryOptions(input: {
  enabled?: boolean;
  slug: string;
}) {
  return queryOptions({
    enabled: (input.enabled ?? true) && typeof window !== "undefined",
    queryFn: () => listOrganizationDomains({ data: { slug: input.slug } }),
    queryKey: organizationQueryKeys.domains(input.slug),
    staleTime: 5 * 60 * 1000,
  });
}
