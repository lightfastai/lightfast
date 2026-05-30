"use client";

import type { AppRouterOutputs } from "@api/app";
import { toast } from "@repo/ui/components/ui/sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTRPC } from "~/trpc/react";
import {
  type OrgMembersData,
  type OrgRole,
  removeInvitation,
  removeMember,
  restoreInvitation,
  restoreMember,
  updateMemberRole,
} from "./org-member-cache";

type OrgMembersOutput =
  AppRouterOutputs["org"]["settings"]["orgMembers"]["list"];

export function useOrgMemberListActions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const updateRoleMutation = useMutation(
    trpc.org.settings.orgMembers.updateRole.mutationOptions({
      meta: { errorTitle: "Failed to update role" },
      onMutate: async (input) => {
        await queryClient.cancelQueries(
          trpc.org.settings.orgMembers.list.queryFilter()
        );

        const previous = queryClient.getQueryData<OrgMembersOutput>(
          trpc.org.settings.orgMembers.list.queryKey()
        );
        const previousRole = previous?.members.find(
          (member) => member.userId === input.userId
        )?.role as OrgRole | undefined;

        queryClient.setQueryData(
          trpc.org.settings.orgMembers.list.queryKey(),
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
          trpc.org.settings.orgMembers.list.queryKey(),
          (old: OrgMembersData | undefined) =>
            updateMemberRole(old, input.userId, previousRole)
        );
      },
      onSuccess: () => toast.success("Role updated"),
      onSettled: () =>
        void queryClient.invalidateQueries(
          trpc.org.settings.orgMembers.list.queryFilter()
        ),
    })
  );

  const removeMutation = useMutation(
    trpc.org.settings.orgMembers.remove.mutationOptions({
      meta: { errorTitle: "Failed to remove member" },
      onMutate: async (input) => {
        await queryClient.cancelQueries(
          trpc.org.settings.orgMembers.list.queryFilter()
        );

        const previous = queryClient.getQueryData<OrgMembersOutput>(
          trpc.org.settings.orgMembers.list.queryKey()
        );
        const { removedIndex, removedMember } = removeMember(
          previous,
          input.userId
        );

        queryClient.setQueryData(
          trpc.org.settings.orgMembers.list.queryKey(),
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
          trpc.org.settings.orgMembers.list.queryKey(),
          (old: OrgMembersData | undefined) =>
            restoreMember(old, context.removedMember, context.removedIndex)
        );
      },
      onSuccess: () => toast.success("Member removed"),
      onSettled: () =>
        void queryClient.invalidateQueries(
          trpc.org.settings.orgMembers.list.queryFilter()
        ),
    })
  );

  const revokeInvitationMutation = useMutation(
    trpc.org.settings.orgMembers.revokeInvitation.mutationOptions({
      meta: { errorTitle: "Failed to revoke invitation" },
      onMutate: async (input) => {
        await queryClient.cancelQueries(
          trpc.org.settings.orgMembers.list.queryFilter()
        );

        const previous = queryClient.getQueryData<OrgMembersOutput>(
          trpc.org.settings.orgMembers.list.queryKey()
        );
        const removedIndex =
          previous?.invitations.findIndex(
            (invitation) => invitation.id === input.invitationId
          ) ?? -1;
        const removedInvitation =
          removedIndex >= 0 ? previous?.invitations[removedIndex] : undefined;

        queryClient.setQueryData(
          trpc.org.settings.orgMembers.list.queryKey(),
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
          trpc.org.settings.orgMembers.list.queryKey(),
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
        void queryClient.invalidateQueries(
          trpc.org.settings.orgMembers.list.queryFilter()
        ),
    })
  );

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
