import { getUserOrgMemberships } from "@vendor/clerk/server";

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
  slug: string;
  userId: string;
}): Promise<OrgAccess> {
  const memberships = await getUserOrgMemberships(input.userId);
  const membership = memberships.find(
    (entry) => entry.organizationSlug === input.slug
  );

  if (!membership?.organizationSlug) {
    throw new OrgAccessError();
  }

  return {
    org: {
      id: membership.organizationId,
      imageUrl: membership.imageUrl,
      initials: orgInitials(membership.organizationName),
      name: membership.organizationName,
      slug: membership.organizationSlug,
    },
    role: membership.role,
  };
}
