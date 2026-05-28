import { auth, clerkClient } from "@vendor/clerk/server";

export class GitHubSetupAdminAccessError extends Error {
  constructor(message = "Organization administrator access required.") {
    super(message);
    this.name = "GitHubSetupAdminAccessError";
  }
}

export async function assertCurrentUserIsOrgAdmin(input: {
  clerkOrgId: string;
  expectedUserId?: string;
}): Promise<{ userId: string }> {
  const session = await auth();
  const userId = session.userId;
  if (!userId || (input.expectedUserId && input.expectedUserId !== userId)) {
    throw new GitHubSetupAdminAccessError();
  }

  const clerk = await clerkClient();
  const memberships = await clerk.users.getOrganizationMembershipList({
    userId,
  });
  const membership = memberships.data.find(
    (entry) => entry.organization.id === input.clerkOrgId
  );

  if (membership?.role !== "org:admin") {
    throw new GitHubSetupAdminAccessError();
  }

  return { userId };
}
