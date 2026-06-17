import { toast } from "@repo/ui/components/ui/sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createOptimisticInvitation,
  insertInvitation,
  type OrgMembersData,
  type OrgRole,
  removeInvitation,
  replaceInvitation,
} from "./org-member-cache";
import {
  inviteOrgMemberMutationOptions,
  orgMemberQueryKeys,
} from "./org-member-queries";

export function useOrgMemberInviteAction({
  onErrorRestore,
  onOptimisticInvite,
  orgId,
}: {
  onErrorRestore: (input: { emailAddress: string; role: OrgRole }) => void;
  onOptimisticInvite: () => void;
  orgId: string | null | undefined;
}) {
  const queryClient = useQueryClient();
  const listQueryKey = orgMemberQueryKeys.list(orgId);

  return useMutation({
    ...inviteOrgMemberMutationOptions(),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: listQueryKey });

      const inputRole = input.role ?? "org:member";
      const optimisticInvitation = createOptimisticInvitation({
        emailAddress: input.emailAddress,
        role: inputRole,
      });
      queryClient.setQueryData(
        listQueryKey,
        (old: OrgMembersData | undefined) =>
          insertInvitation(old, optimisticInvitation)
      );

      onOptimisticInvite();

      return {
        emailAddress: input.emailAddress,
        optimisticInvitationId: optimisticInvitation.id,
        role: inputRole,
      };
    },
    onError: (_err, _input, context) => {
      if (!context) {
        return;
      }

      queryClient.setQueryData(
        listQueryKey,
        (old: OrgMembersData | undefined) =>
          removeInvitation(old, context.optimisticInvitationId)
      );
      onErrorRestore({
        emailAddress: context.emailAddress,
        role: context.role,
      });
    },
    onSuccess: (invitation, _input, context) => {
      if (context) {
        queryClient.setQueryData(
          listQueryKey,
          (old: OrgMembersData | undefined) =>
            replaceInvitation(old, context.optimisticInvitationId, invitation)
        );
      }
      toast.success("Invitation sent");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: listQueryKey });
    },
  });
}
