import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../client";
import {
  people,
  type Person,
  type PersonIdentityProvider,
  type PersonIdentityType,
} from "../schema";
import {
  createPersonIdentityKey,
  normalizePersonIdentityCandidate,
} from "./people-identities";

export interface UpsertPeopleCandidate {
  displayName?: string;
  identityProvider: PersonIdentityProvider;
  identityType: PersonIdentityType;
  identityValue: string;
  metadata?: Record<string, unknown>;
}

export interface UpsertPeopleFromCandidatesInput {
  clerkOrgId: string;
  candidates: UpsertPeopleCandidate[];
  sourceSignalId: string;
}

export async function upsertPeopleFromCandidates(
  db: Database,
  input: UpsertPeopleFromCandidatesInput
): Promise<Person[]> {
  const rows: Person[] = [];

  for (const candidate of input.candidates) {
    const normalized = normalizePersonIdentityCandidate(candidate);
    if (!normalized) {
      continue;
    }

    const identityKey = createPersonIdentityKey(normalized);
    const displayName = candidate.displayName?.trim() || null;
    const metadata = candidate.metadata ?? {};

    await db
      .insert(people)
      .values({
        clerkOrgId: input.clerkOrgId,
        displayName,
        identityProvider: normalized.identityProvider,
        identityType: normalized.identityType,
        identityValue: candidate.identityValue,
        normalizedIdentityValue: normalized.normalizedIdentityValue,
        identityKey,
        firstSeenSignalId: input.sourceSignalId,
        lastSeenSignalId: input.sourceSignalId,
        seenCount: 1,
        metadata,
      })
      .onDuplicateKeyUpdate({
        set: {
          displayName: sql`COALESCE(${displayName}, ${people.displayName})`,
          lastSeenSignalId: input.sourceSignalId,
          metadata,
          seenCount: sql`CASE WHEN ${people.lastSeenSignalId} = ${input.sourceSignalId} THEN ${people.seenCount} ELSE ${people.seenCount} + 1 END`,
          updatedAt: sql`CURRENT_TIMESTAMP(3)`,
        },
      });

    const row = await getPersonByIdentityKey(db, {
      clerkOrgId: input.clerkOrgId,
      identityKey,
    });
    if (row) {
      rows.push(row);
    }
  }

  return rows;
}

export async function getPersonByIdentityKey(
  db: Database,
  input: { clerkOrgId: string; identityKey: string }
): Promise<Person | undefined> {
  const [row] = await db
    .select()
    .from(people)
    .where(
      and(
        eq(people.clerkOrgId, input.clerkOrgId),
        eq(people.identityKey, input.identityKey)
      )
    )
    .limit(1);
  return row;
}
