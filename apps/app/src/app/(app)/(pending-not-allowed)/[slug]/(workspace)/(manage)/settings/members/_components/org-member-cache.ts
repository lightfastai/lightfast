import type { AppRouterOutputs } from "@api/app";

export type OrgMembersData =
  AppRouterOutputs["pendingNotAllowed"]["orgMembers"]["list"];
export type OrgMember = OrgMembersData["members"][number];
export type OrgInvitation = OrgMembersData["invitations"][number];
export type OrgRole = "org:admin" | "org:member";

let optimisticInvitationSequence = 0;

export function nextOptimisticInvitationId() {
  optimisticInvitationSequence += 1;
  return `optimistic:${Date.now()}:${optimisticInvitationSequence}`;
}

export function isOptimisticInvitation(invitation: Pick<OrgInvitation, "id">) {
  return invitation.id.startsWith("optimistic:");
}

function roleName(role: OrgRole) {
  return role === "org:admin" ? "Admin" : "Member";
}

function insertAt<T>(items: T[], item: T, index: number) {
  const next = [...items];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, item);
  return next;
}

export function createOptimisticInvitation({
  emailAddress,
  id = nextOptimisticInvitationId(),
  now = Date.now(),
  role,
}: {
  emailAddress: string;
  id?: string;
  now?: number;
  role: OrgRole;
}): OrgInvitation {
  return {
    createdAt: now,
    emailAddress,
    expiresAt: now,
    id,
    role,
    roleName: roleName(role),
    status: "pending",
    updatedAt: now,
  };
}

export function insertInvitation(
  data: OrgMembersData | undefined,
  invitation: OrgInvitation
): OrgMembersData | undefined {
  if (!data) {
    return data;
  }

  return {
    ...data,
    invitations: [invitation, ...data.invitations],
  };
}

export function replaceInvitation(
  data: OrgMembersData | undefined,
  invitationId: string,
  invitation: OrgInvitation
): OrgMembersData | undefined {
  if (!data) {
    return data;
  }

  return {
    ...data,
    invitations: data.invitations.map((item) =>
      item.id === invitationId ? invitation : item
    ),
  };
}

export function removeInvitation(
  data: OrgMembersData | undefined,
  invitationId: string
): OrgMembersData | undefined {
  if (!data) {
    return data;
  }

  return {
    ...data,
    invitations: data.invitations.filter((item) => item.id !== invitationId),
  };
}

export function restoreInvitation(
  data: OrgMembersData | undefined,
  invitation: OrgInvitation | undefined,
  index: number
): OrgMembersData | undefined {
  if (!data || !invitation) {
    return data;
  }
  if (data.invitations.some((item) => item.id === invitation.id)) {
    return data;
  }

  return {
    ...data,
    invitations: insertAt(data.invitations, invitation, index),
  };
}

export function updateMemberRole(
  data: OrgMembersData | undefined,
  userId: string,
  role: OrgRole
): OrgMembersData | undefined {
  if (!data) {
    return data;
  }

  return {
    ...data,
    members: data.members.map((member) =>
      member.userId === userId ? { ...member, role } : member
    ),
  };
}

export function removeMember(
  data: OrgMembersData | undefined,
  userId: string
): {
  data: OrgMembersData | undefined;
  removedIndex: number;
  removedMember: OrgMember | undefined;
} {
  if (!data) {
    return { data, removedIndex: -1, removedMember: undefined };
  }

  const removedIndex = data.members.findIndex(
    (member) => member.userId === userId
  );
  if (removedIndex === -1) {
    return { data, removedIndex, removedMember: undefined };
  }

  const removedMember = data.members[removedIndex];
  return {
    data: {
      ...data,
      members: data.members.filter((member) => member.userId !== userId),
    },
    removedIndex,
    removedMember,
  };
}

export function restoreMember(
  data: OrgMembersData | undefined,
  member: OrgMember | undefined,
  index: number
): OrgMembersData | undefined {
  if (!data || !member) {
    return data;
  }
  if (data.members.some((item) => item.userId === member.userId)) {
    return data;
  }

  return {
    ...data,
    members: insertAt(data.members, member, index),
  };
}
