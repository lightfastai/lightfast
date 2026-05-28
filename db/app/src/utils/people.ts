import { and, desc, eq, like, lt, or, sql } from "drizzle-orm";

import type { Database } from "../client";
import {
  PERSON_DISPLAY_NAME_LENGTH,
  PERSON_NORMALIZED_IDENTITY_VALUE_LENGTH,
  type Person,
  type PersonIdentityProvider,
  type PersonIdentityType,
  people,
} from "../schema";

export interface ListCursor {
  createdAt: Date;
  id: number;
}

export interface ListResult<T> {
  items: T[];
  nextCursor: ListCursor | null;
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return 50;
  }
  return Math.max(1, Math.min(Math.trunc(limit), 100));
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export interface ListPeopleParams {
  clerkOrgId: string;
  cursor?: ListCursor | null;
  limit?: number;
  search?: string;
}

export async function listPeople(
  db: Database,
  input: ListPeopleParams
): Promise<ListResult<Person>> {
  const limit = normalizeLimit(input.limit);
  const search = input.search?.trim();
  const conditions = [
    eq(people.clerkOrgId, input.clerkOrgId),
    search
      ? or(
          like(people.displayName, `%${search}%`),
          like(people.identityProvider, `%${search}%`),
          like(people.identityValue, `%${search}%`),
          like(people.normalizedIdentityValue, `%${search}%`)
        )
      : undefined,
    input.cursor
      ? or(
          lt(people.createdAt, input.cursor.createdAt),
          and(
            eq(people.createdAt, input.cursor.createdAt),
            lt(people.id, input.cursor.id)
          )
        )
      : undefined,
  ].filter(isDefined);

  const rows = await db
    .select()
    .from(people)
    .where(and(...conditions))
    .orderBy(desc(people.createdAt), desc(people.id))
    .limit(limit + 1);

  const items = rows.slice(0, limit);
  const lastItem = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > limit && lastItem
        ? { createdAt: lastItem.createdAt, id: lastItem.id }
        : null,
  };
}

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
  candidates: UpsertPeopleCandidate[];
  clerkOrgId: string;
  sourceSignalId: string;
}

export async function upsertPeopleFromCandidates(
  db: Database,
  input: UpsertPeopleFromCandidatesInput
): Promise<Person[]> {
  const rows: Person[] = [];
  const seenIdentityKeys = new Set<string>();

  for (const candidate of input.candidates) {
    const normalized = normalizePersonIdentityCandidate(candidate);
    if (!normalized) {
      continue;
    }
    if (
      normalized.normalizedIdentityValue.length >
      PERSON_NORMALIZED_IDENTITY_VALUE_LENGTH
    ) {
      continue;
    }

    const identityKey = createPersonIdentityKey(normalized);
    if (seenIdentityKeys.has(identityKey)) {
      continue;
    }
    seenIdentityKeys.add(identityKey);

    const displayName = normalizeDisplayName(candidate.displayName);
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

function normalizeDisplayName(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, PERSON_DISPLAY_NAME_LENGTH);
}
