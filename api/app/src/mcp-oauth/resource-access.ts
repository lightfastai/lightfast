import type { Database } from "@db/app";

import { findUserOrganizationMembership } from "../auth/clerk-org-membership";
import { resolveOrgSetupGate } from "../auth/org-setup-gate";

export type McpClientVerificationStatus = "blocked" | "unverified" | "verified";

export type HostedMcpOrgAccessErrorCode =
  | "MISSING_MEMBERSHIP"
  | "ORG_NOT_BOUND";

export class HostedMcpOrgAccessError extends Error {
  readonly status = 403;

  constructor(
    readonly code: HostedMcpOrgAccessErrorCode,
    message: string
  ) {
    super(message);
    this.name = "HostedMcpOrgAccessError";
  }
}

export async function assertHostedMcpOrgAccess(
  db: Database,
  input: {
    orgId: string;
    userId: string;
  }
): Promise<void> {
  const membership = await findUserOrganizationMembership({
    organizationId: input.orgId,
    userId: input.userId,
  });

  if (!membership) {
    throw new HostedMcpOrgAccessError(
      "MISSING_MEMBERSHIP",
      "MCP user is not a member of the token organization."
    );
  }

  const orgGate = await resolveOrgSetupGate({
    clerkOrgId: input.orgId,
    db,
  });
  if (orgGate.bindingStatus !== "bound") {
    throw new HostedMcpOrgAccessError(
      "ORG_NOT_BOUND",
      "MCP organization is not connected."
    );
  }
}
