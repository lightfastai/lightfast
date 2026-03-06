// POST /api/cli/setup
// Auth: Clerk JWT in Authorization header
// Body: { orgId: "org_xxx" }
//
// Response: { apiKey, orgId, orgSlug, orgName }

import { clerkClient } from "@clerk/nextjs/server";
import { generateOrgApiKey, hashApiKey } from "@repo/console-api-key";
import { db } from "@db/console/client";
import { orgApiKeys } from "@db/console/schema";
import { verifyCliJwt } from "../lib/verify-jwt";

export async function POST(req: Request) {
  const session = await verifyCliJwt(req);
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

  // Generate org API key
  const { key, prefix, suffix } = generateOrgApiKey();
  const keyHash = hashApiKey(key);

  await db.insert(orgApiKeys).values({
    clerkOrgId: orgId,
    createdByUserId: session.userId,
    name: "CLI (auto-generated)",
    keyHash,
    keyPrefix: prefix,
    keySuffix: suffix,
  });

  return Response.json({
    apiKey: key,
    orgId: membership.organization.id,
    orgSlug: membership.organization.slug,
    orgName: membership.organization.name,
  });
}
