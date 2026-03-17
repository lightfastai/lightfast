"use server";

import { clerkOrgSlugSchema } from "@repo/console-validation";
import { auth, clerkClient } from "@vendor/clerk/server";
import { redirect } from "next/navigation";
import { serializeTeamParams } from "../_lib/search-params";

export async function createTeam(formData: FormData) {
  const rawSlug = (formData.get("teamSlug") as string | null) ?? "";

  const parsed = clerkOrgSlugSchema.safeParse(rawSlug);
  if (!parsed.success) {
    const message =
      parsed.error.flatten().formErrors[0] ??
      Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ??
      "Invalid team name";
    redirect(serializeTeamParams("/account/teams/new", { error: message }));
  }

  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const clerk = await clerkClient();
  let orgSlug: string;

  try {
    const org = await clerk.organizations.createOrganization({
      name: parsed.data,
      slug: parsed.data,
      createdBy: userId,
    });
    orgSlug = org.slug ?? parsed.data;
  } catch (error: unknown) {
    const clerkError = error as {
      errors?: { code: string; message: string }[];
    };

    if (
      clerkError.errors?.[0]?.code === "duplicate_record" ||
      clerkError.errors?.[0]?.code === "form_identifier_exists" ||
      clerkError.errors?.[0]?.message?.includes("already exists") ||
      clerkError.errors?.[0]?.message?.includes("slug is taken")
    ) {
      redirect(
        serializeTeamParams("/account/teams/new", {
          error: `A team named "${parsed.data}" already exists. Please choose a different name.`,
        })
      );
    }

    redirect(
      serializeTeamParams("/account/teams/new", {
        error: "Failed to create team. Please try again.",
      })
    );
  }

  redirect(`/account/teams/invite?teamSlug=${orgSlug}`);
}
