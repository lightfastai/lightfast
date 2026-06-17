import {
  inviteOrgMember,
  type ListOrgMembersResult,
  listOrgMembers,
  removeOrgMember,
  revokeOrgInvitation,
  updateOrgMemberRole,
} from "@api/app/tanstack/org-members";
import type {
  inviteOrgMemberSchema,
  removeOrgMemberSchema,
  revokeOrgInvitationSchema,
  updateOrgMemberRoleSchema,
} from "@repo/app-validation/schemas";
import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { z } from "zod";

export type OrgMembersListData = ListOrgMembersResult;
export type OrgMember = OrgMembersListData["members"][number];
export type OrgInvitation = OrgMembersListData["invitations"][number];
export type OrgRole = "org:admin" | "org:member";
type InviteOrgMemberInput = z.input<typeof inviteOrgMemberSchema>;
type UpdateOrgMemberRoleInput = z.infer<typeof updateOrgMemberRoleSchema>;
type RemoveOrgMemberInput = z.infer<typeof removeOrgMemberSchema>;
type RevokeOrgInvitationInput = z.infer<typeof revokeOrgInvitationSchema>;

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

export function inviteOrgMemberMutationOptions() {
  return mutationOptions({
    meta: { errorTitle: "Failed to send invitation" },
    mutationFn: (data: InviteOrgMemberInput) => inviteOrgMember({ data }),
  });
}

export function updateOrgMemberRoleMutationOptions() {
  return mutationOptions({
    meta: { errorTitle: "Failed to update role" },
    mutationFn: (data: UpdateOrgMemberRoleInput) =>
      updateOrgMemberRole({ data }),
  });
}

export function removeOrgMemberMutationOptions() {
  return mutationOptions({
    meta: { errorTitle: "Failed to remove member" },
    mutationFn: (data: RemoveOrgMemberInput) => removeOrgMember({ data }),
  });
}

export function revokeOrgInvitationMutationOptions() {
  return mutationOptions({
    meta: { errorTitle: "Failed to revoke invitation" },
    mutationFn: (data: RevokeOrgInvitationInput) =>
      revokeOrgInvitation({ data }),
  });
}
