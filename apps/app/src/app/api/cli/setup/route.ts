// POST /api/cli/setup
// Auth: Clerk JWT in Authorization header
// Body: { orgId: "org_xxx" }
//
// Response: { apiKey, orgId, orgSlug, orgName }

import { clerkClient } from "@clerk/nextjs/server";
import { verifyBearerJwt } from "~/app/(auth-api)/_server/verify-bearer-jwt";

export async function POST(req: Request) {
  const session = await verifyBearerJwt(req);
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const { orgId } = body;
  if (!orgId || typeof orgId !== "string") {
    return Response.json({ error: "orgId required" }, { status: 400 });
  }

  // Verify user is a member of this org
  const clerk = await clerkClient();
  const memberships = await clerk.users.getOrganizationMembershipList({
    userId: session.userId,
  });
  const membership = memberships.data.find((m) => m.organization.id === orgId);
  if (!membership) {
    return Response.json({ error: "not_a_member" }, { status: 403 });
  }

  const key = await clerk.apiKeys.create({
    name: "CLI (auto-generated)",
    subject: orgId,
    createdBy: session.userId,
  });

  if (!key.secret) {
    // create() returns secret on success; absence indicates Clerk SDK contract drift.
    return Response.json({ error: "missing_secret" }, { status: 500 });
  }

  return Response.json({
    apiKey: key.secret,
    orgId: membership.organization.id,
    orgSlug: membership.organization.slug,
    orgName: membership.organization.name,
  });
}
