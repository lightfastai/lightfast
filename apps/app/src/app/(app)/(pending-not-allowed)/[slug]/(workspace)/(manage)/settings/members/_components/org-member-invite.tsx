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
import { useAuth } from "@vendor/clerk";
import { Loader2, UserPlus } from "lucide-react";
import { useCallback, useState } from "react";
import type { OrgRole } from "./org-member-cache";
import { useOrgMemberInviteAction } from "./org-member-invite-actions";

export function OrgMemberInvite() {
  const { has, isLoaded } = useAuth();
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

  const inviteMutation = useOrgMemberInviteAction({
    onErrorRestore: restoreInviteForm,
    onOptimisticInvite: resetInviteForm,
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
