"use client";

import { useTRPC } from "@repo/app-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
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
import { useAuth } from "@vendor/clerk/client";
import { Loader2, UserPlus } from "lucide-react";
import { useState } from "react";

export function OrgMemberInvite() {
  const { has, isLoaded } = useAuth();
  const canManageMembers = isLoaded && !!has?.({ role: "org:admin" });
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listQueryKey =
    trpc.pendingNotAllowed.orgMembers.list.queryOptions().queryKey;

  const [isOpen, setIsOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [role, setRole] = useState<"org:admin" | "org:member">("org:member");

  const inviteMutation = useMutation(
    trpc.pendingNotAllowed.orgMembers.invite.mutationOptions({
      meta: { errorTitle: "Failed to send invitation" },
      onSuccess: () => {
        toast.success("Invitation sent");
        setEmailAddress("");
        setRole("org:member");
        setIsOpen(false);
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
        <Button size="sm" variant="secondary">
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
            onValueChange={(value) =>
              setRole(value as "org:admin" | "org:member")
            }
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

        <DialogFooter>
          <Button
            disabled={!emailAddress.trim() || inviteMutation.isPending}
            onClick={handleInvite}
            variant="secondary"
          >
            {inviteMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Invite"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
