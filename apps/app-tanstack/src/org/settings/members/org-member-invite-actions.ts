import { toast } from "@repo/ui/components/ui/sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  createOptimisticInvitation,
  insertInvitation,
  type OrgMembersData,
  type OrgRole,
  removeInvitation,
  replaceInvitation,
} from "./org-member-cache";

export function useOrgMemberInviteAction({
  onErrorRestore,
  onOptimisticInvite,
}: {
  onErrorRestore: (input: { emailAddress: string; role: OrgRole }) => void;
  onOptimisticInvite: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.org.settings.orgMembers.invite.mutationOptions({
      meta: { errorTitle: "Failed to send invitation" },
      onMutate: async (input) => {
        await queryClient.cancelQueries(
          trpc.org.settings.orgMembers.list.queryFilter()
        );

        const inputRole = input.role ?? "org:member";
        const optimisticInvitation = createOptimisticInvitation({
          emailAddress: input.emailAddress,
          role: inputRole,
        });
        queryClient.setQueryData(
          trpc.org.settings.orgMembers.list.queryKey(),
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
          trpc.org.settings.orgMembers.list.queryKey(),
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
            trpc.org.settings.orgMembers.list.queryKey(),
            (old: OrgMembersData | undefined) =>
              replaceInvitation(old, context.optimisticInvitationId, invitation)
          );
        }
        toast.success("Invitation sent");
      },
      onSettled: () => {
        void queryClient.invalidateQueries(
          trpc.org.settings.orgMembers.list.queryFilter()
        );
      },
    })
  );
}
