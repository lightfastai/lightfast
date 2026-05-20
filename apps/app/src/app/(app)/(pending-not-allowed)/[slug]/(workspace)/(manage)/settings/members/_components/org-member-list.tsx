"use client";

import type { AppRouterOutputs } from "@api/app";
import { useTRPC } from "@repo/app-trpc/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { toast } from "@repo/ui/components/ui/sonner";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk/client";
import { formatDistanceToNow } from "date-fns";
import { Mail, MoreHorizontal, Trash2, UserRoundX, Users } from "lucide-react";
import { useCallback } from "react";

type OrgMembersOutput =
  AppRouterOutputs["pendingNotAllowed"]["orgMembers"]["list"];
type OrgMember = OrgMembersOutput["members"][number];
type OrgInvitation = OrgMembersOutput["invitations"][number];
type OrgRole = "org:admin" | "org:member";

function initials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return letters || "?";
}

function roleLabel(role: string) {
  return role === "org:admin" ? "Admin" : "Member";
}

export function OrgMemberList() {
  const { has, isLoaded } = useAuth();
  const canManageMembers = isLoaded && !!has?.({ role: "org:admin" });
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listQueryOptions =
    trpc.pendingNotAllowed.orgMembers.list.queryOptions();

  const { data } = useSuspenseQuery({
    ...listQueryOptions,
    staleTime: 5 * 60 * 1000,
  });

  const invalidateList = useCallback(
    () =>
      queryClient.invalidateQueries({ queryKey: listQueryOptions.queryKey }),
    [queryClient, listQueryOptions.queryKey]
  );

  const updateRoleMutation = useMutation(
    trpc.pendingNotAllowed.orgMembers.updateRole.mutationOptions({
      meta: { errorTitle: "Failed to update role" },
      onSuccess: () => toast.success("Role updated"),
      onSettled: () => void invalidateList(),
    })
  );

  const removeMutation = useMutation(
    trpc.pendingNotAllowed.orgMembers.remove.mutationOptions({
      meta: { errorTitle: "Failed to remove member" },
      onSuccess: () => toast.success("Member removed"),
      onSettled: () => void invalidateList(),
    })
  );

  const revokeInvitationMutation = useMutation(
    trpc.pendingNotAllowed.orgMembers.revokeInvitation.mutationOptions({
      meta: { errorTitle: "Failed to revoke invitation" },
      onSuccess: () => toast.success("Invitation revoked"),
      onSettled: () => void invalidateList(),
    })
  );

  const hasNoRows = data.members.length === 0 && data.invitations.length === 0;

  if (hasNoRows) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-muted/20 p-3">
          <Users className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="font-semibold text-sm">No members yet</p>
        <p className="mt-1 max-w-sm text-muted-foreground text-sm">
          Invite teammates to collaborate in this organization.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-lg border border-border/60">
        {data.members.map((member) => (
          <MemberRow
            canManageMembers={canManageMembers}
            key={member.id}
            member={member}
            onRemove={(userId) => removeMutation.mutate({ userId })}
            onUpdateRole={(userId, role) =>
              updateRoleMutation.mutate({ role, userId })
            }
          />
        ))}
      </div>

      {data.invitations.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground text-sm">
            Pending Invitations
          </h3>
          <div className="overflow-hidden rounded-lg border border-border/60">
            {data.invitations.map((invitation) => (
              <InvitationRow
                canManageMembers={canManageMembers}
                invitation={invitation}
                key={invitation.id}
                onRevoke={(invitationId) =>
                  revokeInvitationMutation.mutate({ invitationId })
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MemberRow({
  canManageMembers,
  member,
  onRemove,
  onUpdateRole,
}: {
  canManageMembers: boolean;
  member: OrgMember;
  onRemove: (userId: string) => void;
  onUpdateRole: (userId: string, role: OrgRole) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-border/60 border-b px-4 py-4 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-9">
          <AvatarImage alt="" src={member.imageUrl} />
          <AvatarFallback>{initials(member.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-sm">{member.name}</p>
            {member.isCurrentUser && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                You
              </span>
            )}
          </div>
          <p className="truncate text-muted-foreground text-xs">
            {member.emailAddress}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {canManageMembers && !member.isCurrentUser ? (
          <Select
            onValueChange={(role) =>
              onUpdateRole(member.userId, role as OrgRole)
            }
            value={member.role}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="org:member">Member</SelectItem>
              <SelectItem value="org:admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground text-xs">
            {roleLabel(member.role)}
          </span>
        )}

        {canManageMembers && !member.isCurrentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="text-muted-foreground hover:text-foreground"
                size="icon-sm"
                variant="ghost"
              >
                <MoreHorizontal className="size-3.5" />
                <span className="sr-only">Member actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="space-y-1">
              <DropdownMenuItem
                className="cursor-pointer rounded-xl px-2"
                onClick={() => onRemove(member.userId)}
                variant="destructive"
              >
                <UserRoundX />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

function InvitationRow({
  canManageMembers,
  invitation,
  onRevoke,
}: {
  canManageMembers: boolean;
  invitation: OrgInvitation;
  onRevoke: (invitationId: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-border/60 border-b px-4 py-4 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-muted/40">
          <Mail className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="truncate font-medium text-sm">
            {invitation.emailAddress}
          </p>
          <div className="flex items-center gap-3 text-muted-foreground text-xs">
            <span>{roleLabel(invitation.role)}</span>
            <span>
              Invited{" "}
              {formatDistanceToNow(invitation.createdAt, { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>

      {canManageMembers ? (
        <Button
          onClick={() => onRevoke(invitation.id)}
          size="sm"
          variant="ghost"
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          Revoke
        </Button>
      ) : (
        <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground text-xs">
          Pending
        </span>
      )}
    </div>
  );
}
