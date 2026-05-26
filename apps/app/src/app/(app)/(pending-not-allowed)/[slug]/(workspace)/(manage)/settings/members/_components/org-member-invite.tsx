"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogActionButton,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogDescription,
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
import { useAuth } from "@vendor/clerk";
import { Loader2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useTRPC } from "~/trpc/react";
import {
  createOptimisticInvitation,
  insertInvitation,
  type OrgMembersData,
  type OrgRole,
  removeInvitation,
  replaceInvitation,
} from "./org-member-cache";

export function OrgMemberInvite() {
  const { has, isLoaded } = useAuth();
  const canManageMembers = isLoaded && !!has?.({ role: "org:admin" });
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listQueryKey =
    trpc.org.settings.orgMembers.list.queryOptions().queryKey;

  const [isOpen, setIsOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [role, setRole] = useState<OrgRole>("org:member");

  const inviteMutation = useMutation(
    trpc.org.settings.orgMembers.invite.mutationOptions({
      meta: { errorTitle: "Failed to send invitation" },
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

        setEmailAddress("");
        setRole("org:member");
        setIsOpen(false);

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
        setEmailAddress(context.emailAddress);
        setRole(context.role);
        setIsOpen(true);
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
    })
  );

  if (!canManageMembers) {
    return null;
  }

  function handleInvite() {
    const trimmed = emailAddress.trim();
    if (!trimmed || inviteMutation.isPending) {
      return;
    }
    inviteMutation.mutate({ emailAddress: trimmed, role });
  }

  return (
    <Dialog onOpenChange={setIsOpen} open={isOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <UserPlus className="mr-1.5 h-4 w-4" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
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
            type="email"
            value={emailAddress}
          />
          <Select
            onValueChange={(value) => setRole(value as OrgRole)}
            value={role}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="org:member">Member</SelectItem>
              <SelectItem value="org:admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogActions>
          <DialogClose asChild>
            <DialogActionButton>Cancel</DialogActionButton>
          </DialogClose>
          <DialogActionButton
            disabled={!emailAddress.trim() || inviteMutation.isPending}
            onClick={handleInvite}
            variant="primary"
          >
            {inviteMutation.isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Sending...
              </>
            ) : (
              "Send Invite"
            )}
          </DialogActionButton>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
