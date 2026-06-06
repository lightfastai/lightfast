import type {
  Database,
  SyncOrgTeamMemberPeopleResult,
  TeamMemberPeopleCandidate,
} from "@db/app";
import {
  markFormerTeamMembersMissingFromSync,
  syncOrgTeamMemberPeople,
} from "@db/app";
import type { clerkClient, OrganizationMembership } from "@vendor/clerk/server";

const DEFAULT_PAGE_SIZE = 100;

type ClerkClient = Awaited<ReturnType<typeof clerkClient>>;
type ClerkOrganizationMembershipListInput = Parameters<
  ClerkClient["organizations"]["getOrganizationMembershipList"]
>[0];
type ClerkOrganizationMembershipPage = Awaited<
  ReturnType<ClerkClient["organizations"]["getOrganizationMembershipList"]>
>;
export type ClerkOrganizationMembership = Pick<
  OrganizationMembership,
  "publicUserData" | "role"
>;
type ClerkOrganizationMembershipListPage = Omit<
  ClerkOrganizationMembershipPage,
  "data"
> & {
  data: ClerkOrganizationMembership[];
};

export interface ClerkOrganizationMembershipListClient {
  organizations: Pick<
    {
      getOrganizationMembershipList(
        input: ClerkOrganizationMembershipListInput
      ): Promise<ClerkOrganizationMembershipListPage>;
    },
    "getOrganizationMembershipList"
  >;
}

export interface SyncTeamMembersForOrgResult {
  clerkOrgId: string;
  membersMarkedFormer: number;
  membersSeen: number;
  membersSkippedNoEmail: number;
  membersUpserted: number;
  status: "synced";
}

export async function listAcceptedOrgMemberships(
  clerk: ClerkOrganizationMembershipListClient,
  input: { clerkOrgId: string; pageSize?: number }
): Promise<ClerkOrganizationMembership[]> {
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
  const memberships: ClerkOrganizationMembership[] = [];
  let offset = 0;

  while (true) {
    const page = await clerk.organizations.getOrganizationMembershipList({
      limit: pageSize,
      offset,
      organizationId: input.clerkOrgId,
    });

    memberships.push(...page.data);
    offset += pageSize;

    const totalCount = page.totalCount ?? memberships.length;
    if (page.data.length === 0 || memberships.length >= totalCount) {
      break;
    }
  }

  return memberships;
}

function memberDisplayName(member: ClerkOrganizationMembership) {
  const firstName = member.publicUserData?.firstName ?? "";
  const lastName = member.publicUserData?.lastName ?? "";
  return `${firstName} ${lastName}`.trim();
}

function memberToCandidate(
  member: ClerkOrganizationMembership
): TeamMemberPeopleCandidate | null {
  const clerkUserId = member.publicUserData?.userId?.trim();
  const emailAddress = member.publicUserData?.identifier?.trim() ?? "";
  const role = member.role === "org:admin" ? "org:admin" : "org:member";

  if (!clerkUserId) {
    return null;
  }

  return {
    clerkUserId,
    displayName: memberDisplayName(member) || emailAddress,
    emailAddress,
    role,
  };
}

export async function syncTeamMembersForOrg(input: {
  clerk: ClerkOrganizationMembershipListClient;
  clerkOrgId: string;
  db: Database;
  syncedAt: Date;
}): Promise<SyncTeamMembersForOrgResult> {
  const memberships = await listAcceptedOrgMemberships(input.clerk, {
    clerkOrgId: input.clerkOrgId,
  });
  const members = memberships
    .map(memberToCandidate)
    .filter((member): member is TeamMemberPeopleCandidate => Boolean(member));

  const synced: SyncOrgTeamMemberPeopleResult = await syncOrgTeamMemberPeople(
    input.db,
    {
      clerkOrgId: input.clerkOrgId,
      members,
      syncedAt: input.syncedAt,
    }
  );

  const membersMarkedFormer = await markFormerTeamMembersMissingFromSync(
    input.db,
    {
      activeIdentityKeys: synced.activeIdentityKeys,
      clerkOrgId: input.clerkOrgId,
      syncedAt: input.syncedAt,
    }
  );

  return {
    clerkOrgId: input.clerkOrgId,
    membersMarkedFormer,
    membersSeen: synced.membersSeen,
    membersSkippedNoEmail: synced.membersSkippedNoEmail,
    membersUpserted: synced.membersUpserted,
    status: "synced",
  };
}
