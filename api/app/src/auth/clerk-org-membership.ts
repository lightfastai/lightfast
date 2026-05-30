import { auth, clerkClient } from "@vendor/clerk/server";

const MEMBERSHIP_PAGE_LIMIT = 100;

export class ClerkOrgMembershipAccessError extends Error {
  constructor(
    readonly code:
      | "EXPECTED_USER_MISMATCH"
      | "MISSING_MEMBERSHIP"
      | "NON_ADMIN"
      | "UNAUTHENTICATED",
    message = "Organization membership access required."
  ) {
    super(message);
    this.name = "ClerkOrgMembershipAccessError";
  }
}

type ClerkClient = Awaited<ReturnType<typeof clerkClient>>;
type ClerkUserMembershipPage = Awaited<
  ReturnType<ClerkClient["users"]["getOrganizationMembershipList"]>
>;
export type ClerkUserOrganizationMembership =
  ClerkUserMembershipPage["data"][number];

export async function listUserOrganizationMemberships(input: {
  userId: string;
}): Promise<ClerkUserOrganizationMembership[]> {
  const clerk = await clerkClient();
  const memberships: ClerkUserOrganizationMembership[] = [];
  let offset = 0;

  while (true) {
    const page = await clerk.users.getOrganizationMembershipList({
      limit: MEMBERSHIP_PAGE_LIMIT,
      offset,
      userId: input.userId,
    });

    memberships.push(...page.data);
    offset += MEMBERSHIP_PAGE_LIMIT;

    if (
      !page.data.length ||
      page.data.length < MEMBERSHIP_PAGE_LIMIT ||
      (typeof page.totalCount === "number" && offset >= page.totalCount)
    ) {
      return memberships;
    }
  }
}

export async function findUserOrganizationMembership(input: {
  organizationId?: string;
  organizationSlug?: string;
  userId: string;
}): Promise<ClerkUserOrganizationMembership | null> {
  if (!(input.organizationId || input.organizationSlug)) {
    throw new Error("organizationId or organizationSlug is required.");
  }

  const memberships = await listUserOrganizationMemberships({
    userId: input.userId,
  });

  return (
    memberships.find((membership) => {
      if (
        input.organizationId &&
        membership.organization.id === input.organizationId
      ) {
        return true;
      }
      return (
        !!input.organizationSlug &&
        membership.organization.slug === input.organizationSlug
      );
    }) ?? null
  );
}

export async function assertCurrentUserIsOrgAdmin(input: {
  clerkOrgId: string;
  expectedUserId?: string;
}): Promise<{ userId: string }> {
  const session = await auth();
  const userId = session.userId;
  if (!userId) {
    throw new ClerkOrgMembershipAccessError("UNAUTHENTICATED");
  }

  if (input.expectedUserId && input.expectedUserId !== userId) {
    throw new ClerkOrgMembershipAccessError("EXPECTED_USER_MISMATCH");
  }

  const membership = await findUserOrganizationMembership({
    organizationId: input.clerkOrgId,
    userId,
  });

  if (!membership) {
    throw new ClerkOrgMembershipAccessError("MISSING_MEMBERSHIP");
  }

  if (membership.role !== "org:admin") {
    throw new ClerkOrgMembershipAccessError("NON_ADMIN");
  }

  return { userId };
}
