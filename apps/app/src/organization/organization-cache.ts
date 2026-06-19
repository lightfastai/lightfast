import type {
  ListOrganizationDomainsResult,
  ListUserOrganizationsResult,
} from "@api/app/tanstack/organizations";

export type UserOrganizationsData = ListUserOrganizationsResult;
export type OrganizationDomainsData = ListOrganizationDomainsResult;

export const ORGANIZATION_STALE_TIME = 5 * 60 * 1000;

export const organizationQueryKeys = {
  all: ["organizations"] as const,
  bySlug: (slug: string) => ["organizations", "by-slug", slug] as const,
  domains: (slug: string) => ["organizations", "domains", slug] as const,
  list: () => ["organizations", "list"] as const,
};
