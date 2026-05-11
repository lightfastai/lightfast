// POST /api/cli/login
// Auth: Clerk JWT in Authorization header (from localhost callback)
//
// Response: { organizations: [{ id, slug, name, role }] }

import { clerkClient } from "@clerk/nextjs/server";
import { verifyBearerJwt } from "~/app/(auth-api)/_server/verify-bearer-jwt";

export async function POST(req: Request) {
  const session = await verifyBearerJwt(req);
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const clerk = await clerkClient();
  const memberships = await clerk.users.getOrganizationMembershipList({
    userId: session.userId,
  });

  const organizations = memberships.data.map((m) => ({
    id: m.organization.id,
    slug: m.organization.slug,
    name: m.organization.name,
    role: m.role,
  }));

  return Response.json({ organizations });
}
