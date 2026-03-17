"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { serializeInviteParams } from "../_lib/search-params";

const inviteSchema = z.object({
  teamSlug: z.string().min(1, "Team slug is required"),
  email1: z.union([z.string().email(), z.literal("")]),
  email2: z.union([z.string().email(), z.literal("")]),
  email3: z.union([z.string().email(), z.literal("")]),
});

export async function inviteTeammates(formData: FormData) {
  const rawTeamSlug = (formData.get("teamSlug") as string | null) ?? "";

  const parsed = inviteSchema.safeParse({
    teamSlug: rawTeamSlug,
    email1: (formData.get("email1") as string | null) ?? "",
    email2: (formData.get("email2") as string | null) ?? "",
    email3: (formData.get("email3") as string | null) ?? "",
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const message =
      fieldErrors.email1?.[0] ??
      fieldErrors.email2?.[0] ??
      fieldErrors.email3?.[0] ??
      "Please enter valid email addresses.";
    redirect(
      serializeInviteParams("/account/teams/invite", {
        teamSlug: rawTeamSlug || null,
        error: message,
      })
    );
  }

  const { teamSlug, email1, email2, email3 } = parsed.data;
  const invitedEmails = [email1, email2, email3].filter(Boolean);

  // Mock: log invitations (no real email sending yet)
  if (invitedEmails.length > 0) {
    console.log(
      `[invite-teammates] Mock: inviting to "${teamSlug}":`,
      invitedEmails
    );
  }

  redirect(`/new?teamSlug=${teamSlug}`);
}
