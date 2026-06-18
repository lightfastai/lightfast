import { useAuth } from "@clerk/tanstack-react-start";
import {
  Loading03Icon as Loader2,
  UserAdd01Icon as UserPlus,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { toast } from "@repo/ui/components/ui/sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
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

export function OrgMemberInvite() {
  const { has, isLoaded, orgId } = useAuth();
  const queryClient = useQueryClient();
  const listQueryKey = orgMemberQueryKeys.list(orgId);
  const canManageMembers = isLoaded && !!has?.({ role: "org:admin" });

  const [isOpen, setIsOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [role, setRole] = useState<OrgRole>("org:member");

  const restoreInviteForm = useCallback(
    (input: { emailAddress: string; role: OrgRole }) => {
      setEmailAddress(input.emailAddress);
      setRole(input.role);
      setIsOpen(true);
    },
    []
  );

  const resetInviteForm = useCallback(() => {
    setEmailAddress("");
    setRole("org:member");
    setIsOpen(false);
  }, []);

  const inviteMutation = useMutation({
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

      resetInviteForm();

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
      restoreInviteForm({
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

  const handleInvite = useCallback(() => {
    const trimmed = emailAddress.trim();
    if (!trimmed || inviteMutation.isPending) {
      return;
    }
    inviteMutation.mutate({ emailAddress: trimmed, role });
  }, [emailAddress, inviteMutation.isPending, inviteMutation.mutate, role]);

  if (!canManageMembers) {
    return null;
  }

  return (
    <Dialog onOpenChange={setIsOpen} open={isOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-[9px]" size="lf" variant="secondary">
          <HugeiconsIcon
            aria-hidden="true"
            className="size-3.5"
            icon={UserPlus}
          />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>
            Send an organization invitation by email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            autoFocus
            onChange={(event) => setEmailAddress(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleInvite();
              }
            }}
            placeholder="name@example.com"
            size="lf"
            type="email"
            value={emailAddress}
            variant="lf"
          />
          <Select
            onValueChange={(value) => setRole(value as OrgRole)}
            value={role}
          >
            <SelectTrigger className="w-full" size="sm" variant="lf">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="org:member">Member</SelectItem>
              <SelectItem value="org:admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            disabled={!emailAddress.trim() || inviteMutation.isPending}
            onClick={handleInvite}
            type="button"
          >
            {inviteMutation.isPending ? (
              <>
                <HugeiconsIcon
                  aria-hidden="true"
                  className="animate-spin"
                  icon={Loader2}
                />
                Sending
              </>
            ) : (
              "Send invite"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
