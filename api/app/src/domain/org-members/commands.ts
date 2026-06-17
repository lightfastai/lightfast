import {
  inviteOrgMemberSchema,
  removeOrgMemberSchema,
  revokeOrgInvitationSchema,
  updateOrgMemberRoleSchema,
} from "@repo/app-validation/schemas";
import {
  clerkClient,
  type OrganizationInvitation,
  type OrganizationMembership,
} from "@vendor/clerk/server";
import { z } from "zod";

import { isClerkConflictError } from "../../auth/clerk-errors";
import { defineCommand } from "../command";
import { ConflictError, ValidationError } from "../errors";
import {
  requireActiveClerkOrgActor,
  requireClerkOrgAdminActor,
} from "../gates";

type ClerkClient = Awaited<ReturnType<typeof clerkClient>>;
type MaybePromise<T> = Promise<T> | T;
type ClerkOrganizationsClient = Pick<
  ClerkClient["organizations"],
  | "createOrganizationInvitation"
  | "deleteOrganizationMembership"
  | "getOrganizationInvitationList"
  | "getOrganizationMembershipList"
  | "revokeOrganizationInvitation"
  | "updateOrganizationMembership"
>;

interface OrgMembersCommandDeps {
  clerkClient: () => MaybePromise<{ organizations: ClerkOrganizationsClient }>;
  isClerkConflictError: typeof isClerkConflictError;
}

export function createDefaultOrgMembersCommandDeps(
  input: Partial<OrgMembersCommandDeps> = {}
): OrgMembersCommandDeps {
  return {
    clerkClient: input.clerkClient ?? clerkClient,
    isClerkConflictError: input.isClerkConflictError ?? isClerkConflictError,
  };
}

const orgMemberOutput = z.object({
  createdAt: z.number(),
  emailAddress: z.string(),
  firstName: z.string().nullable(),
  id: z.string(),
  imageUrl: z.string(),
  isCurrentUser: z.boolean(),
  lastName: z.string().nullable(),
  name: z.string(),
  role: z.string(),
  updatedAt: z.number(),
  userId: z.string(),
});

const orgInvitationOutput = z.object({
  createdAt: z.number(),
  emailAddress: z.string(),
  expiresAt: z.number().nullable(),
  id: z.string(),
  role: z.string(),
  roleName: z.string().nullable(),
  status: z.string(),
  updatedAt: z.number(),
});

const listOrgMembersInput = z.object({}).strict();
const listOrgMembersOutput = z.object({
  invitations: z.array(orgInvitationOutput),
  members: z.array(orgMemberOutput),
});
const successOutput = z.object({ success: z.literal(true) });
const ORG_MEMBERS_PAGE_SIZE = 100;

export type OrgMembersListResult = z.infer<typeof listOrgMembersOutput>;
export type OrgMemberResult = OrgMembersListResult["members"][number];
export type OrgInvitationResult = OrgMembersListResult["invitations"][number];

function memberName(member: OrganizationMembership) {
  const firstName = member.publicUserData?.firstName ?? "";
  const lastName = member.publicUserData?.lastName ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || member.publicUserData?.identifier || "Unknown member";
}

function toMemberDto(
  member: OrganizationMembership,
  currentUserId: string
): OrgMemberResult {
  const userId = member.publicUserData?.userId ?? "";
  return {
    createdAt: member.createdAt,
    emailAddress: member.publicUserData?.identifier ?? "",
    firstName: member.publicUserData?.firstName ?? null,
    id: member.id,
    imageUrl: member.publicUserData?.imageUrl ?? "",
    isCurrentUser: userId === currentUserId,
    lastName: member.publicUserData?.lastName ?? null,
    name: memberName(member),
    role: member.role,
    updatedAt: member.updatedAt,
    userId,
  };
}

function toInvitationDto(
  invitation: OrganizationInvitation
): OrgInvitationResult {
  return {
    createdAt: invitation.createdAt,
    emailAddress: invitation.emailAddress,
    expiresAt: invitation.expiresAt ?? null,
    id: invitation.id,
    role: invitation.role,
    roleName: invitation.roleName ?? null,
    status: invitation.status ?? "pending",
    updatedAt: invitation.updatedAt,
  };
}

async function collectAllPages<T>(
  fetchPage: (offset: number) => Promise<{ data: T[] }>
) {
  const items: T[] = [];

  for (let offset = 0; ; offset += ORG_MEMBERS_PAGE_SIZE) {
    const page = await fetchPage(offset);
    items.push(...page.data);

    if (page.data.length < ORG_MEMBERS_PAGE_SIZE) {
      return items;
    }
  }
}

export const listOrgMembersCommand = defineCommand<
  "orgMembers.list",
  typeof listOrgMembersInput,
  typeof listOrgMembersOutput,
  OrgMembersCommandDeps
>({
  name: "orgMembers.list",
  input: listOrgMembersInput,
  output: listOrgMembersOutput,
  run: async ({ ctx, deps }) => {
    const actor = requireActiveClerkOrgActor(ctx);
    const clerk = await deps.clerkClient();
    const [memberships, invitations] = await Promise.all([
      collectAllPages((offset) =>
        clerk.organizations.getOrganizationMembershipList({
          limit: ORG_MEMBERS_PAGE_SIZE,
          offset,
          organizationId: actor.orgId,
        })
      ),
      collectAllPages((offset) =>
        clerk.organizations.getOrganizationInvitationList({
          limit: ORG_MEMBERS_PAGE_SIZE,
          offset,
          organizationId: actor.orgId,
          status: ["pending"],
        })
      ),
    ]);

    return {
      invitations: invitations.map(toInvitationDto),
      members: memberships.map((member) => toMemberDto(member, actor.userId)),
    };
  },
});

export const inviteOrgMemberCommand = defineCommand<
  "orgMembers.invite",
  typeof inviteOrgMemberSchema,
  typeof orgInvitationOutput,
  OrgMembersCommandDeps
>({
  name: "orgMembers.invite",
  input: inviteOrgMemberSchema,
  output: orgInvitationOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkOrgAdminActor(ctx);
    const clerk = await deps.clerkClient();
    try {
      const invitation = await clerk.organizations.createOrganizationInvitation(
        {
          emailAddress: input.emailAddress,
          inviterUserId: actor.userId,
          organizationId: actor.orgId,
          role: input.role,
        }
      );
      return toInvitationDto(invitation);
    } catch (error) {
      if (deps.isClerkConflictError(error)) {
        throw new ConflictError(
          "ORG_MEMBER_INVITATION_EXISTS",
          "An invitation for this email address already exists",
          {},
          { cause: error }
        );
      }
      throw error;
    }
  },
});

export const updateOrgMemberRoleCommand = defineCommand<
  "orgMembers.updateRole",
  typeof updateOrgMemberRoleSchema,
  typeof successOutput,
  OrgMembersCommandDeps
>({
  name: "orgMembers.updateRole",
  input: updateOrgMemberRoleSchema,
  output: successOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkOrgAdminActor(ctx);
    const clerk = await deps.clerkClient();
    await clerk.organizations.updateOrganizationMembership({
      organizationId: actor.orgId,
      role: input.role,
      userId: input.userId,
    });
    return { success: true as const };
  },
});

export const removeOrgMemberCommand = defineCommand<
  "orgMembers.remove",
  typeof removeOrgMemberSchema,
  typeof successOutput,
  OrgMembersCommandDeps
>({
  name: "orgMembers.remove",
  input: removeOrgMemberSchema,
  output: successOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkOrgAdminActor(ctx);
    if (input.userId === actor.userId) {
      throw new ValidationError(
        "CANNOT_REMOVE_CURRENT_MEMBER",
        "Administrators cannot remove themselves"
      );
    }

    const clerk = await deps.clerkClient();
    await clerk.organizations.deleteOrganizationMembership({
      organizationId: actor.orgId,
      userId: input.userId,
    });
    return { success: true as const };
  },
});

export const revokeOrgInvitationCommand = defineCommand<
  "orgMembers.revokeInvitation",
  typeof revokeOrgInvitationSchema,
  typeof successOutput,
  OrgMembersCommandDeps
>({
  name: "orgMembers.revokeInvitation",
  input: revokeOrgInvitationSchema,
  output: successOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkOrgAdminActor(ctx);
    const clerk = await deps.clerkClient();
    await clerk.organizations.revokeOrganizationInvitation({
      invitationId: input.invitationId,
      organizationId: actor.orgId,
      requestingUserId: actor.userId,
    });
    return { success: true as const };
  },
});
