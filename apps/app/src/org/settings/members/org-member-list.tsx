import { useAuth } from "@clerk/tanstack-react-start";
import {
  Mail01Icon as Mail,
  MoreHorizontalIcon as MoreHorizontal,
  Search01Icon as Search,
  Delete02Icon as Trash2,
  UserRemove01Icon as UserRoundX,
  UserGroupIcon as Users,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { cn } from "@repo/ui/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui-v2/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { formatRelativeTimeToNow } from "@vendor/lib/time";
import { memo, type ReactNode, useMemo } from "react";
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

function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-border bg-transparent text-foreground">
      {children}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "org:admin";

  return (
    <Badge
      className={cn(
        "shrink-0 gap-1.5",
        isAdmin
          ? "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300"
          : "border-border bg-muted/40 text-muted-foreground"
      )}
      variant="outline"
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {roleLabel(role)}
    </Badge>
  );
}

function CurrentUserBadge() {
  return (
    <Badge
      className="shrink-0 rounded-[7px] px-1.5 py-0 text-[10px] text-muted-foreground"
      variant="outline"
    >
      You
    </Badge>
  );
}

function PendingInvitationBadge() {
  return (
    <Badge
      className="shrink-0 gap-1.5 border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      variant="outline"
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      Pending
    </Badge>
  );
}

function EmptyState({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="rounded-[12px] border border-border bg-background p-4">
      <div className="flex items-start gap-3">
        <IconTile>{icon}</IconTile>
        <div className="space-y-1">
          <p className="font-medium text-foreground text-sm">{title}</p>
          <p className="text-muted-foreground text-sm">{children}</p>
        </div>
      </div>
    </div>
  );
}

export function OrgMemberList({ searchQuery = "" }: { searchQuery?: string }) {
  const { has, isLoaded } = useAuth();
  const canManageMembers = isLoaded && !!has?.({ role: "org:admin" });
  const trpc = useTRPC();

  const { data, error, isPending } = useQuery({
    ...trpc.org.settings.orgMembers.list.queryOptions(),
    enabled: typeof window !== "undefined",
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
  const members = data?.members ?? [];
  const invitations = data?.invitations ?? [];

  const visibleMembers = useMemo(() => {
    const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));
    if (!normalizedQuery) {
      return sorted;
    }
    return sorted.filter(
      (member) =>
        member.name.toLowerCase().includes(normalizedQuery) ||
        member.emailAddress.toLowerCase().includes(normalizedQuery)
    );
  }, [members, normalizedQuery]);

  const visibleInvitations = useMemo(() => {
    const sorted = [...invitations].sort((a, b) => b.createdAt - a.createdAt);
    if (!normalizedQuery) {
      return sorted;
    }
    return sorted.filter((invitation) =>
      invitation.emailAddress.toLowerCase().includes(normalizedQuery)
    );
  }, [invitations, normalizedQuery]);

  if (isPending) {
    return (
      <div className="divide-y divide-border rounded-[12px] border border-border bg-background">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="flex items-center justify-between gap-4 p-3"
            key={index}
          >
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-[9px] bg-muted" />
              <div className="space-y-2">
                <div className="h-3.5 w-36 rounded bg-muted" />
                <div className="h-3 w-48 rounded bg-muted" />
              </div>
            </div>
            <div className="h-7 w-24 rounded-[9px] bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[12px] border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
        {error.message}
      </div>
    );
  }

  const hasNoRows = members.length === 0 && invitations.length === 0;
  const hasNoMatches =
    visibleMembers.length === 0 && visibleInvitations.length === 0;

  if (hasNoRows) {
    return (
      <EmptyState
        icon={
          <HugeiconsIcon
            aria-hidden="true"
            className="size-4 text-muted-foreground"
            icon={Users}
          />
        }
        title="No members yet"
      >
        Invite teammates to collaborate in this organization.
      </EmptyState>
    );
  }

  if (hasNoMatches) {
    return (
      <EmptyState
        icon={
          <HugeiconsIcon
            aria-hidden="true"
            className="size-4 text-muted-foreground"
            icon={Search}
          />
        }
        title="No members found"
      >
        No members or invitations match your search.
      </EmptyState>
    );
  }

  return (
    <div className="divide-y divide-border rounded-[12px] border border-border bg-background">
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
    <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar className="size-9 rounded-[9px] border border-border">
          <AvatarFallback className="rounded-[9px] bg-transparent font-medium text-foreground text-xs">
            {initials(member.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-foreground text-sm">{member.name}</p>
            {member.isCurrentUser ? <CurrentUserBadge /> : null}
          </div>
          <p className="truncate text-muted-foreground text-xs">
            {member.emailAddress}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
        {canManage ? (
          <Select
            disabled={isPending}
            onValueChange={(role) =>
              onUpdateRole(member.userId, role as OrgRole)
            }
            value={member.role}
          >
            <SelectTrigger
              aria-label={`Role for ${member.name}`}
              className="w-28"
              size="sm"
              variant="lf"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="org:member">Member</SelectItem>
              <SelectItem value="org:admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <RoleBadge role={member.role} />
        )}

        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={`Member actions for ${member.name}`}
                  className="size-7 rounded-[9px]"
                  disabled={isPending}
                  size="sm"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <HugeiconsIcon
                aria-hidden="true"
                className="size-3.5 text-muted-foreground"
                icon={MoreHorizontal}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="gap-2"
                onClick={() => onRemove(member.userId)}
                variant="destructive"
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-4"
                  icon={UserRoundX}
                />
                Remove member
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
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
        "flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between",
        isOptimistic && "opacity-60"
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <IconTile>
          <HugeiconsIcon
            aria-hidden="true"
            className="size-4 text-muted-foreground"
            icon={Mail}
          />
        </IconTile>
        <div className="min-w-0">
          <p className="truncate text-foreground text-sm">
            {invitation.emailAddress}
          </p>
          <p className="truncate text-muted-foreground text-xs">
            Invited{" "}
            {formatRelativeTimeToNow(invitation.createdAt, { addSuffix: true })}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
        <RoleBadge role={invitation.role} />
        <PendingInvitationBadge />

        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={`Invitation actions for ${invitation.emailAddress}`}
                  className="size-7 rounded-[9px]"
                  disabled={isPending}
                  size="sm"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <HugeiconsIcon
                aria-hidden="true"
                className="size-3.5 text-muted-foreground"
                icon={MoreHorizontal}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="gap-2"
                onClick={() => onRevoke(invitation.id)}
                variant="destructive"
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-4"
                  icon={Trash2}
                />
                Revoke invitation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
});
