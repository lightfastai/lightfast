import type { Database } from "@db/app";
import type { OrgSetupGate } from "@repo/api-contract";
import { findUserOrganizationMembership } from "./clerk-org-membership";
import { resolveOrgSetupGate } from "./org-setup-gate";

export class OrgAccessError extends Error {
  constructor(message = "Organization not found") {
    super(message);
    this.name = "OrgAccessError";
  }
}

export function isOrgAccessError(error: unknown): error is OrgAccessError {
  return error instanceof OrgAccessError;
}

export function orgInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export type OrgAccess = OrgSetupGate & {
  org: {
    id: string;
    imageUrl: string;
    initials: string;
    name: string;
    slug: string;
  };
  role: string;
};

export async function getOrgAccessBySlug(input: {
  db: Database;
  slug: string;
  userId: string;
}): Promise<OrgAccess> {
  const membership = await findUserOrganizationMembership({
    organizationSlug: input.slug,
    userId: input.userId,
  });

  if (!membership?.organization.slug) {
    throw new OrgAccessError();
  }

  const gate = await resolveOrgSetupGate({
    db: input.db,
    clerkOrgId: membership.organization.id,
  });

  return {
    ...gate,
    org: {
      id: membership.organization.id,
      imageUrl: membership.organization.imageUrl,
      initials: orgInitials(membership.organization.name),
      name: membership.organization.name,
      slug: membership.organization.slug,
    },
    role: membership.role,
  };
}
