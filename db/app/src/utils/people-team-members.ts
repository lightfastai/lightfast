import { and, eq, inArray, notInArray, sql } from "drizzle-orm";

import type { Database } from "../client";
import {
  PERSON_DISPLAY_NAME_LENGTH,
  PERSON_NORMALIZED_IDENTITY_VALUE_LENGTH,
  type Person,
  orgPeople as people,
} from "../schema";
import { getRowsAffected } from "./drizzle-results";
import {
  createPersonIdentityKey,
  normalizePersonIdentityCandidate,
} from "./people-identities";

export interface TeamMemberPeopleCandidate {
  clerkUserId: string;
  displayName?: string;
  emailAddress: string;
  role: "org:admin" | "org:member";
}

export interface SyncOrgTeamMemberPeopleInput {
  clerkOrgId: string;
  members: TeamMemberPeopleCandidate[];
  syncedAt: Date;
}

export interface SyncOrgTeamMemberPeopleResult {
  activeIdentityKeys: string[];
  membersSeen: number;
  membersSkippedNoEmail: number;
  membersUpserted: number;
  people: Person[];
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function normalizeDisplayName(value: string | undefined, email: string) {
  const trimmed = value?.trim() || email.trim();
  return trimmed.slice(0, PERSON_DISPLAY_NAME_LENGTH);
}

export async function syncOrgTeamMemberPeople(
  db: Database,
  input: SyncOrgTeamMemberPeopleInput
): Promise<SyncOrgTeamMemberPeopleResult> {
  const activeIdentityKeys: string[] = [];
  const seenIdentityKeys = new Set<string>();
  let membersSkippedNoEmail = 0;

  for (const member of input.members) {
    const normalized = normalizePersonIdentityCandidate({
      identityProvider: "email",
      identityType: "email",
      identityValue: member.emailAddress,
    });

    if (
      !normalized ||
      normalized.normalizedIdentityValue.length >
        PERSON_NORMALIZED_IDENTITY_VALUE_LENGTH
    ) {
      membersSkippedNoEmail += 1;
      continue;
    }

    const identityKey = createPersonIdentityKey(normalized);
    if (seenIdentityKeys.has(identityKey)) {
      continue;
    }
    seenIdentityKeys.add(identityKey);
    activeIdentityKeys.push(identityKey);

    const displayName = normalizeDisplayName(
      member.displayName,
      member.emailAddress
    );

    await db
      .insert(people)
      .values({
        clerkOrgId: input.clerkOrgId,
        displayName,
        identityProvider: "email",
        identityType: "email",
        identityValue: member.emailAddress,
        normalizedIdentityValue: normalized.normalizedIdentityValue,
        identityKey,
        firstSeenSignalId: null,
        lastSeenSignalId: null,
        seenCount: 1,
        metadata: {},
        personSource: "team_member",
        memberStatus: "active",
        clerkUserId: member.clerkUserId,
        memberRole: member.role,
        memberSyncedAt: input.syncedAt,
      })
      .onDuplicateKeyUpdate({
        set: {
          displayName,
          personSource: sql`CASE WHEN ${people.personSource} = 'signal' THEN 'mixed' ELSE ${people.personSource} END`,
          memberStatus: "active",
          clerkUserId: member.clerkUserId,
          memberRole: member.role,
          memberSyncedAt: input.syncedAt,
        },
      });
  }

  const rows =
    activeIdentityKeys.length === 0
      ? []
      : await db
          .select()
          .from(people)
          .where(
            and(
              eq(people.clerkOrgId, input.clerkOrgId),
              inArray(people.identityKey, activeIdentityKeys)
            )
          )
          .limit(activeIdentityKeys.length);
  const rowByIdentityKey = new Map(
    rows.map((row) => [row.identityKey, row] as const)
  );
  const peopleRows = activeIdentityKeys
    .map((identityKey) => rowByIdentityKey.get(identityKey))
    .filter(isDefined);

  return {
    activeIdentityKeys,
    membersSeen: input.members.length,
    membersSkippedNoEmail,
    membersUpserted: peopleRows.length,
    people: peopleRows,
  };
}

export async function markFormerTeamMembersMissingFromSync(
  db: Database,
  input: {
    activeIdentityKeys: string[];
    clerkOrgId: string;
    syncedAt: Date;
  }
): Promise<number> {
  const conditions = [
    eq(people.clerkOrgId, input.clerkOrgId),
    eq(people.memberStatus, "active"),
    inArray(people.personSource, ["team_member", "mixed"]),
    input.activeIdentityKeys.length
      ? notInArray(people.identityKey, input.activeIdentityKeys)
      : undefined,
  ].filter(isDefined);

  const result = await db
    .update(people)
    .set({
      memberStatus: "former",
      memberSyncedAt: input.syncedAt,
    })
    .where(and(...conditions));

  return getRowsAffected(result);
}
