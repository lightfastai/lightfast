import type { Database } from "@db/app";
import { isOrgBound } from "@db/app";
import { findUserOrganizationMembership } from "./clerk-org-membership";

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

export interface OrgAccess {
  bindingStatus: "bound" | "unbound";
  org: {
    id: string;
    imageUrl: string;
    initials: string;
    name: string;
    slug: string;
  };
  role: string;
}

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

  const bound = await isOrgBound(input.db, membership.organization.id);

  return {
    bindingStatus: bound ? "bound" : "unbound",
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
