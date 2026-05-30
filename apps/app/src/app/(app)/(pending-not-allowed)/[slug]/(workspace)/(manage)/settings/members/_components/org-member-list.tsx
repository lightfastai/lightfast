"use client";

import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
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
import { cn } from "@repo/ui/lib/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useAuth } from "@vendor/clerk";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import {
  Mail,
  MoreHorizontal,
  Search,
  Trash2,
  UserRoundX,
  Users,
} from "lucide-react";
import { memo, useMemo } from "react";
import { useTRPC } from "~/trpc/react";
import {
  isOptimisticInvitation,
  type OrgInvitation,
  type OrgMember,
  type OrgRole,
} from "./org-member-cache";
import { useOrgMemberListActions } from "./org-member-list-actions";

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

export function OrgMemberList({ searchQuery = "" }: { searchQuery?: string }) {
  const { has, isLoaded } = useAuth();
  const canManageMembers = isLoaded && !!has?.({ role: "org:admin" });
  const trpc = useTRPC();

  const { data } = useSuspenseQuery({
    ...trpc.org.settings.orgMembers.list.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });
  const {
    pendingInvitationId,
    pendingRemoveUserId,
    pendingRoleUserId,
    removeOrgMember,
    revokeInvitation,
    updateRole,
  } = useOrgMemberListActions();

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleMembers = useMemo(() => {
    const sorted = [...data.members].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    if (!normalizedQuery) {
      return sorted;
    }
    return sorted.filter(
      (member) =>
        member.name.toLowerCase().includes(normalizedQuery) ||
        member.emailAddress.toLowerCase().includes(normalizedQuery)
    );
  }, [data.members, normalizedQuery]);

  const visibleInvitations = useMemo(() => {
    const sorted = [...data.invitations].sort(
      (a, b) => b.createdAt - a.createdAt
    );
    if (!normalizedQuery) {
      return sorted;
    }
    return sorted.filter((invitation) =>
      invitation.emailAddress.toLowerCase().includes(normalizedQuery)
    );
  }, [data.invitations, normalizedQuery]);

  const hasNoRows = data.members.length === 0 && data.invitations.length === 0;
  const hasNoMatches =
    visibleMembers.length === 0 && visibleInvitations.length === 0;

  if (hasNoRows) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 py-16 text-center">
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

  if (hasNoMatches) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 py-16 text-center">
        <div className="mb-4 rounded-full bg-muted/20 p-3">
          <Search className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="font-semibold text-sm">No members found</p>
        <p className="mt-1 max-w-sm text-muted-foreground text-sm">
          No members or invitations match your search.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      {visibleMembers.map((member) => (
        <MemberRow
          canManageMembers={canManageMembers}
          isPending={
            pendingRoleUserId === member.userId ||
            pendingRemoveUserId === member.userId
          }
          key={member.id}
          member={member}
          onRemove={removeOrgMember}
          onUpdateRole={updateRole}
        />
      ))}
      {visibleInvitations.map((invitation) => (
        <InvitationRow
          canManageMembers={canManageMembers}
          invitation={invitation}
          isPending={pendingInvitationId === invitation.id}
          key={invitation.id}
          onRevoke={revokeInvitation}
        />
      ))}
    </div>
  );
}

const MemberRow = memo(function MemberRow({
  canManageMembers,
  isPending,
  member,
  onRemove,
  onUpdateRole,
}: {
  canManageMembers: boolean;
  isPending: boolean;
  member: OrgMember;
  onRemove: (userId: string) => void;
  onUpdateRole: (userId: string, role: OrgRole) => void;
}) {
  const canManage = canManageMembers && !member.isCurrentUser;

  return (
    <div className="flex items-center justify-between gap-4 border-border/60 border-b px-4 py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-9">
          <AvatarFallback className="bg-foreground text-background text-xs">
            {initials(member.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-sm">{member.name}</p>
            {member.isCurrentUser && <Badge variant="secondary">You</Badge>}
          </div>
          <p className="truncate text-muted-foreground text-sm">
            {member.emailAddress}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {canManage ? (
          <Select
            disabled={isPending}
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
          <span className="text-muted-foreground text-sm">
            {roleLabel(member.role)}
          </span>
        )}

        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="text-muted-foreground hover:text-foreground"
                disabled={isPending}
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
                Remove member
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="size-6" />
        )}
      </div>
    </div>
  );
});

const InvitationRow = memo(function InvitationRow({
  canManageMembers,
  invitation,
  isPending,
  onRevoke,
}: {
  canManageMembers: boolean;
  invitation: OrgInvitation;
  isPending: boolean;
  onRevoke: (invitationId: string) => void;
}) {
  const isOptimistic = isOptimisticInvitation(invitation);
  const canManage = canManageMembers && !isOptimistic;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-border/60 border-b px-4 py-3 last:border-b-0",
        isOptimistic && "opacity-60"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted/40">
          <Mail className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="truncate font-medium text-sm">
            {invitation.emailAddress}
          </p>
          <p className="truncate text-muted-foreground text-xs">
            Invited{" "}
            {formatRelativeTimeToNow(invitation.createdAt, { addSuffix: true })}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="text-muted-foreground text-sm">
          {roleLabel(invitation.role)}
        </span>
        <Badge variant="secondary">Pending</Badge>

        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="text-muted-foreground hover:text-foreground"
                disabled={isPending}
                size="icon-sm"
                variant="ghost"
              >
                <MoreHorizontal className="size-3.5" />
                <span className="sr-only">Invitation actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="space-y-1">
              <DropdownMenuItem
                className="cursor-pointer rounded-xl px-2"
                onClick={() => onRevoke(invitation.id)}
                variant="destructive"
              >
                <Trash2 />
                Revoke invitation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="size-6" />
        )}
      </div>
    </div>
  );
});
