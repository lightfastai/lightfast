import {
  getOrgIdentity,
  type OrgIdentityResult,
} from "@api/app/tanstack/org-identity";
import { queryOptions } from "@tanstack/react-query";

export type OrgIdentitySettings = OrgIdentityResult;
export type ConfiguredOrgIdentitySettings = Extract<
  OrgIdentityResult,
  { configured: true }
>;
export type OrgIdentitySettingsFile =
  ConfiguredOrgIdentitySettings["files"][number];

export const orgIdentityQueryKeys = {
  all: ["org-identity"] as const,
  get: () => ["org-identity", "get"] as const,
};

export function orgIdentityQueryOptions() {
  return queryOptions({
    queryFn: () => getOrgIdentity(),
    queryKey: orgIdentityQueryKeys.get(),
    staleTime: 5 * 60 * 1000,
  });
}
