import { z } from "zod";

export const orgMemberRoleSchema = z.enum(["org:admin", "org:member"]);

export const inviteOrgMemberSchema = z.object({
  emailAddress: z.string().email().max(320),
  role: orgMemberRoleSchema.default("org:member"),
});

export const updateOrgMemberRoleSchema = z.object({
  userId: z.string().min(1),
  role: orgMemberRoleSchema,
});

export const removeOrgMemberSchema = z.object({
  userId: z.string().min(1),
});

export const revokeOrgInvitationSchema = z.object({
  invitationId: z.string().min(1),
});
