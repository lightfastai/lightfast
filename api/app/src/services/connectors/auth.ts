import { auth } from "@vendor/clerk/server";

import { findUserOrganizationMembership } from "../../auth/clerk-org-membership";

export class ConnectorOAuthFinalizeAccessError extends Error {
  constructor(
    readonly code:
      | "ACTIVE_ORG_MISMATCH"
      | "EXPECTED_USER_MISMATCH"
      | "MISSING_MEMBERSHIP"
      | "NON_ADMIN"
      | "UNAUTHENTICATED",
    message = "Connector OAuth finalization requires organization admin access."
  ) {
    super(message);
    this.name = "ConnectorOAuthFinalizeAccessError";
  }
}

export async function assertCurrentSessionCanFinalizeConnectorOAuth(input: {
  clerkOrgId: string;
  expectedUserId: string;
}): Promise<{ userId: string }> {
  const session = await auth();
  const userId = session.userId;
  if (!userId) {
    throw new ConnectorOAuthFinalizeAccessError("UNAUTHENTICATED");
  }

  if (userId !== input.expectedUserId) {
    throw new ConnectorOAuthFinalizeAccessError("EXPECTED_USER_MISMATCH");
  }

  if (session.orgId && session.orgId !== input.clerkOrgId) {
    throw new ConnectorOAuthFinalizeAccessError("ACTIVE_ORG_MISMATCH");
  }

  const membership = await findUserOrganizationMembership({
    organizationId: input.clerkOrgId,
    userId,
  });
  if (!membership) {
    throw new ConnectorOAuthFinalizeAccessError("MISSING_MEMBERSHIP");
  }

  if (membership.role !== "org:admin") {
    throw new ConnectorOAuthFinalizeAccessError("NON_ADMIN");
  }

  return { userId };
}
