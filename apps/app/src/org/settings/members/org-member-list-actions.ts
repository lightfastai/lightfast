import { toast } from "@repo/ui/components/ui/sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  type OrgMembersData,
  type OrgRole,
  removeInvitation,
  removeMember,
  restoreInvitation,
  restoreMember,
  updateMemberRole,
} from "./org-member-cache";
import {
  orgMemberQueryKeys,
  removeOrgMemberMutationOptions,
  revokeOrgInvitationMutationOptions,
  updateOrgMemberRoleMutationOptions,
} from "./org-member-queries";

export function useOrgMemberListActions({
  orgId,
}: {
  orgId: string | null | undefined;
}) {
  const queryClient = useQueryClient();
  const listQueryKey = orgMemberQueryKeys.list(orgId);

  const updateRoleMutation = useMutation({
    ...updateOrgMemberRoleMutationOptions(),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: listQueryKey });

      const previous = queryClient.getQueryData<OrgMembersData>(listQueryKey);
      const previousRole = previous?.members.find(
        (member) => member.userId === input.userId
      )?.role as OrgRole | undefined;

      queryClient.setQueryData(
        listQueryKey,
        (old: OrgMembersData | undefined) =>
          updateMemberRole(old, input.userId, input.role)
      );

      return { previousRole };
    },
    onError: (_err, input, context) => {
      const previousRole = context?.previousRole;
      if (!previousRole) {
        return;
      }

      queryClient.setQueryData(
        listQueryKey,
        (old: OrgMembersData | undefined) =>
          updateMemberRole(old, input.userId, previousRole)
      );
    },
    onSuccess: () => toast.success("Role updated"),
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: listQueryKey }),
  });

  const removeMutation = useMutation({
    ...removeOrgMemberMutationOptions(),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: listQueryKey });

      const previous = queryClient.getQueryData<OrgMembersData>(listQueryKey);
      const { removedIndex, removedMember } = removeMember(
        previous,
        input.userId
      );

      queryClient.setQueryData(
        listQueryKey,
        (old: OrgMembersData | undefined) =>
          removeMember(old, input.userId).data
      );

      return { removedIndex, removedMember };
    },
    onError: (_err, _input, context) => {
      if (!context?.removedMember) {
        return;
      }

      queryClient.setQueryData(
        listQueryKey,
        (old: OrgMembersData | undefined) =>
          restoreMember(old, context.removedMember, context.removedIndex)
      );
    },
    onSuccess: () => toast.success("Member removed"),
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: listQueryKey }),
  });

  const revokeInvitationMutation = useMutation({
    ...revokeOrgInvitationMutationOptions(),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: listQueryKey });

      const previous = queryClient.getQueryData<OrgMembersData>(listQueryKey);
      const removedIndex =
        previous?.invitations.findIndex(
          (invitation) => invitation.id === input.invitationId
        ) ?? -1;
      const removedInvitation =
        removedIndex >= 0 ? previous?.invitations[removedIndex] : undefined;

      queryClient.setQueryData(
        listQueryKey,
        (old: OrgMembersData | undefined) =>
          removeInvitation(old, input.invitationId)
      );

      return { removedIndex, removedInvitation };
    },
    onError: (_err, _input, context) => {
      if (!context?.removedInvitation) {
        return;
      }

      queryClient.setQueryData(
        listQueryKey,
        (old: OrgMembersData | undefined) =>
          restoreInvitation(
            old,
            context.removedInvitation,
            context.removedIndex
          )
      );
    },
    onSuccess: () => toast.success("Invitation revoked"),
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: listQueryKey }),
  });

  const updateRole = useCallback(
    (userId: string, role: OrgRole) =>
      updateRoleMutation.mutate({ role, userId }),
    [updateRoleMutation.mutate]
  );
  const removeOrgMember = useCallback(
    (userId: string) => removeMutation.mutate({ userId }),
    [removeMutation.mutate]
  );
  const revokeInvitation = useCallback(
    (invitationId: string) => revokeInvitationMutation.mutate({ invitationId }),
    [revokeInvitationMutation.mutate]
  );

  return {
    pendingInvitationId: revokeInvitationMutation.isPending
      ? revokeInvitationMutation.variables?.invitationId
      : undefined,
    pendingRemoveUserId: removeMutation.isPending
      ? removeMutation.variables?.userId
      : undefined,
    pendingRoleUserId: updateRoleMutation.isPending
      ? updateRoleMutation.variables?.userId
      : undefined,
    removeOrgMember,
    revokeInvitation,
    updateRole,
  };
}
