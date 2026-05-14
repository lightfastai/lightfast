import { auth, getUserOrgMemberships } from "@vendor/clerk/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Post-login relay page.
 *
 * Auth app always lands here after sign-in/sign-up. We determine
 * the right destination server-side so there's no client-side delay:
 *
 * - Has active org in JWT → /:orgSlug (returning user, org already active)
 * - Has org memberships (cached) → first org's slug (returning user, JWT stale)
 * - No orgs → /account/teams/new (new user, needs to create a team)
 */
export default async function WelcomePage() {
  const { userId, orgSlug } = await auth();

  if (orgSlug) {
    redirect(`/${orgSlug}`);
  }

  if (userId) {
    const memberships = await getUserOrgMemberships(userId);
    const first = memberships.find((m) => m.organizationSlug);
    if (first?.organizationSlug) {
      redirect(`/${first.organizationSlug}`);
    }
  }

  redirect("/account/teams/new");
}
