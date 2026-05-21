import {
  inviteOrgMemberSchema,
  removeOrgMemberSchema,
  revokeOrgInvitationSchema,
  updateOrgMemberRoleSchema,
} from "@repo/app-validation/schemas";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import {
  clerkClient,
  type OrganizationInvitation,
  type OrganizationMembership,
} from "@vendor/clerk/server";

import { isClerkConflictError } from "../../auth/clerk-errors";
import { orgAdminProcedure, orgProcedure } from "../../trpc";

function memberName(member: OrganizationMembership) {
  const firstName = member.publicUserData?.firstName ?? "";
  const lastName = member.publicUserData?.lastName ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || member.publicUserData?.identifier || "Unknown member";
}

function toMemberDto(member: OrganizationMembership, currentUserId: string) {
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

function toInvitationDto(invitation: OrganizationInvitation) {
  return {
    createdAt: invitation.createdAt,
    emailAddress: invitation.emailAddress,
    expiresAt: invitation.expiresAt,
    id: invitation.id,
    role: invitation.role,
    roleName: invitation.roleName,
    status: invitation.status ?? "pending",
    updatedAt: invitation.updatedAt,
  };
}

export const orgMembersRouter = {
  list: orgProcedure.query(async ({ ctx }) => {
    const clerk = await clerkClient();
    const [memberships, invitations] = await Promise.all([
      clerk.organizations.getOrganizationMembershipList({
        limit: 100,
        offset: 0,
        organizationId: ctx.auth.identity.orgId,
      }),
      clerk.organizations.getOrganizationInvitationList({
        limit: 100,
        offset: 0,
        organizationId: ctx.auth.identity.orgId,
        status: ["pending"],
      }),
    ]);

    return {
      invitations: invitations.data.map(toInvitationDto),
      members: memberships.data.map((member) =>
        toMemberDto(member, ctx.auth.identity.userId)
      ),
    };
  }),

  invite: orgAdminProcedure
    .input(inviteOrgMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const clerk = await clerkClient();
      try {
        const invitation =
          await clerk.organizations.createOrganizationInvitation({
            emailAddress: input.emailAddress,
            inviterUserId: ctx.auth.identity.userId,
            organizationId: ctx.auth.identity.orgId,
            role: input.role,
          });
        return toInvitationDto(invitation);
      } catch (error) {
        if (isClerkConflictError(error)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An invitation for this email address already exists",
            cause: error,
          });
        }
        throw error;
      }
    }),

  updateRole: orgAdminProcedure
    .input(updateOrgMemberRoleSchema)
    .mutation(async ({ ctx, input }) => {
      const clerk = await clerkClient();
      await clerk.organizations.updateOrganizationMembership({
        organizationId: ctx.auth.identity.orgId,
        role: input.role,
        userId: input.userId,
      });
      return { success: true };
    }),

  remove: orgAdminProcedure
    .input(removeOrgMemberSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.auth.identity.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Administrators cannot remove themselves",
        });
      }

      const clerk = await clerkClient();
      await clerk.organizations.deleteOrganizationMembership({
        organizationId: ctx.auth.identity.orgId,
        userId: input.userId,
      });
      return { success: true };
    }),

  revokeInvitation: orgAdminProcedure
    .input(revokeOrgInvitationSchema)
    .mutation(async ({ ctx, input }) => {
      const clerk = await clerkClient();
      await clerk.organizations.revokeOrganizationInvitation({
        invitationId: input.invitationId,
        organizationId: ctx.auth.identity.orgId,
        requestingUserId: ctx.auth.identity.userId,
      });
      return { success: true };
    }),
} satisfies TRPCRouterRecord;
