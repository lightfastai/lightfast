import {
  type ListOrgMembersResult,
  listOrgMembers,
} from "@api/app/tanstack/org-members";
import { queryOptions } from "@tanstack/react-query";

export type OrgMembersListData = ListOrgMembersResult;
export type OrgMember = OrgMembersListData["members"][number];
export type OrgInvitation = OrgMembersListData["invitations"][number];
export type OrgRole = "org:admin" | "org:member";

export const orgMemberQueryKeys = {
  all: ["org-members"] as const,
  list: (orgId: string | null | undefined) =>
    ["org-members", "list", orgId ?? "no-org"] as const,
};

export function orgMembersQueryOptions(input: {
  orgId: string | null | undefined;
}) {
  return queryOptions({
    enabled: Boolean(input.orgId),
    queryFn: () => listOrgMembers(),
    queryKey: orgMemberQueryKeys.list(input.orgId),
    staleTime: 5 * 60 * 1000,
  });
}
