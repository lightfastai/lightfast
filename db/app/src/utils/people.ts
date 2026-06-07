import { and, desc, eq, inArray, like, lt, or, sql } from "drizzle-orm";

import type { Database } from "../client";
import {
  type EntityGraphMetadata,
  type EntityPerson,
  type EntitySourceIdentity,
  orgEntityPeople,
  orgEntitySourceIdentities,
  PERSON_DISPLAY_NAME_LENGTH,
  PERSON_NORMALIZED_IDENTITY_VALUE_LENGTH,
  type Person,
  type PersonIdentityProvider,
  type PersonIdentityType,
  type PersonMemberStatus,
  type PersonSource,
  orgPeople as people,
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

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export interface ListPeopleParams {
  clerkOrgId: string;
  cursor?: ListCursor | null;
  limit?: number;
  memberStatuses?: PersonMemberStatus[];
  providers?: PersonIdentityProvider[];
  search?: string;
  sources?: PersonSource[];
  types?: PersonIdentityType[];
}

export async function listPeople(
  db: Database,
  input: ListPeopleParams
): Promise<ListResult<Person>> {
  const limit = normalizeLimit(input.limit);
  const search = input.search?.trim();
  const searchPattern = search ? `%${escapeLikePattern(search)}%` : undefined;
  const conditions = [
    eq(people.clerkOrgId, input.clerkOrgId),
    searchPattern
      ? or(
          sql`${people.displayName} like ${searchPattern} escape '\\\\'`,
          sql`${people.identityProvider} like ${searchPattern} escape '\\\\'`,
          sql`${people.identityValue} like ${searchPattern} escape '\\\\'`,
          sql`${people.normalizedIdentityValue} like ${searchPattern} escape '\\\\'`
        )
      : undefined,
    input.providers?.length
      ? inArray(people.identityProvider, input.providers)
      : undefined,
    input.sources?.length
      ? inArray(people.personSource, input.sources)
      : undefined,
    input.memberStatuses?.length
      ? inArray(people.memberStatus, input.memberStatuses)
      : undefined,
    input.types?.length ? inArray(people.identityType, input.types) : undefined,
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

type BridgeableGraphSourceIdentity = EntitySourceIdentity & {
  identityType: "handle";
  provider: Extract<PersonIdentityProvider, "github" | "x">;
};

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
        personSource: "signal",
      })
      .onDuplicateKeyUpdate({
        set: {
          displayName: sql`COALESCE(${displayName}, ${people.displayName})`,
          metadata,
          personSource: sql`CASE WHEN ${people.personSource} = 'team_member' THEN 'mixed' ELSE ${people.personSource} END`,
          // seenCount MUST be assigned before lastSeenSignalId. MySQL evaluates
          // ON DUPLICATE KEY UPDATE assignments left-to-right, so this CASE has
          // to read the *previous* lastSeenSignalId before the assignment below
          // overwrites it — otherwise the condition is always true and the
          // count never increments past 1.
          seenCount: sql`CASE WHEN ${people.lastSeenSignalId} = ${input.sourceSignalId} THEN ${people.seenCount} ELSE ${people.seenCount} + 1 END`,
          lastSeenSignalId: input.sourceSignalId,
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

export interface ProjectEntityGraphPeopleToOrgPeopleInput {
  clerkOrgId: string;
  resolverVersion: string;
  source?: Record<string, unknown>;
  sourceIdentityKeys: string[];
}

export async function projectEntityGraphPeopleToOrgPeople(
  db: Database,
  input: ProjectEntityGraphPeopleToOrgPeopleInput
): Promise<Person[]> {
  const sourceIdentityKeys = Array.from(
    new Set(input.sourceIdentityKeys.map((key) => key.trim()).filter(Boolean))
  );
  if (sourceIdentityKeys.length === 0) {
    return [];
  }

  const sourceIdentities = await db
    .select()
    .from(orgEntitySourceIdentities)
    .where(
      and(
        eq(orgEntitySourceIdentities.clerkOrgId, input.clerkOrgId),
        inArray(orgEntitySourceIdentities.identityKey, sourceIdentityKeys)
      )
    )
    .limit(sourceIdentityKeys.length);

  const bridgeableSourceIdentities = sourceIdentities.filter(
    isBridgeableGraphSourceIdentity
  );
  if (bridgeableSourceIdentities.length === 0) {
    return [];
  }

  const graphPeople = await loadGraphPeopleForSourceIdentities(db, {
    clerkOrgId: input.clerkOrgId,
    sourceIdentities: bridgeableSourceIdentities,
  });
  const projectedPeople: Person[] = [];
  const seenBridgeIdentityKeys = new Set<string>();

  for (const graphPerson of graphPeople) {
    const graphPersonSourceIdentities = bridgeableSourceIdentities.filter(
      (sourceIdentity) =>
        graphPersonContainsSourceIdentity(graphPerson, sourceIdentity)
    );
    const sourceIdentity = selectPrimaryBridgeSourceIdentity(
      graphPerson,
      graphPersonSourceIdentities
    );
    if (!sourceIdentity) {
      continue;
    }

    const normalized = normalizePersonIdentityCandidate({
      identityProvider: sourceIdentity.provider,
      identityType: "handle",
      identityValue: sourceIdentity.identityValue,
    });
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
    if (seenBridgeIdentityKeys.has(identityKey)) {
      continue;
    }
    seenBridgeIdentityKeys.add(identityKey);

    const metadata = entityGraphPeopleBridgeMetadata({
      graphPerson,
      resolverVersion: input.resolverVersion,
      source: input.source,
      sourceIdentities: graphPersonSourceIdentities,
      sourceIdentity,
    });
    const displayName = normalizeDisplayName(graphPerson.displayName);

    await db
      .insert(people)
      .values({
        clerkOrgId: input.clerkOrgId,
        displayName,
        identityProvider: normalized.identityProvider,
        identityType: normalized.identityType,
        identityValue: sourceIdentity.identityValue,
        normalizedIdentityValue: normalized.normalizedIdentityValue,
        identityKey,
        firstSeenSignalId: null,
        lastSeenSignalId: null,
        seenCount: 1,
        metadata,
        personSource: "entity_graph",
      })
      .onDuplicateKeyUpdate({
        set: {
          displayName: sql`COALESCE(${displayName}, ${people.displayName})`,
          metadata,
          personSource: sql`CASE WHEN ${people.personSource} = 'entity_graph' THEN 'entity_graph' ELSE 'mixed' END`,
        },
      });

    const row = await getPersonByIdentityKey(db, {
      clerkOrgId: input.clerkOrgId,
      identityKey,
    });
    if (row) {
      projectedPeople.push(row);
    }
  }

  return projectedPeople;
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

export async function getPersonByPublicId(
  db: Database,
  input: { clerkOrgId: string; publicId: string }
): Promise<Person | undefined> {
  const [row] = await db
    .select()
    .from(people)
    .where(
      and(
        eq(people.clerkOrgId, input.clerkOrgId),
        eq(people.publicId, input.publicId)
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

async function loadGraphPeopleForSourceIdentities(
  db: Database,
  input: {
    clerkOrgId: string;
    sourceIdentities: EntitySourceIdentity[];
  }
): Promise<EntityPerson[]> {
  const sourceIdentityIds = input.sourceIdentities.map(
    (identity) => identity.id
  );
  const matchConditions = [
    inArray(orgEntityPeople.primarySourceIdentityId, sourceIdentityIds),
    ...input.sourceIdentities.map((identity) =>
      canonicalPersonKeyContainsIdentity(identity.identityKey)
    ),
  ];

  return db
    .select()
    .from(orgEntityPeople)
    .where(
      and(
        eq(orgEntityPeople.clerkOrgId, input.clerkOrgId),
        or(...matchConditions)
      )
    )
    .limit(100);
}

function graphPersonContainsSourceIdentity(
  graphPerson: EntityPerson,
  sourceIdentity: EntitySourceIdentity
): boolean {
  return (
    graphPerson.primarySourceIdentityId === sourceIdentity.id ||
    canonicalPersonKeyMembers(graphPerson.canonicalKey).includes(
      sourceIdentity.identityKey
    )
  );
}

function canonicalPersonKeyContainsIdentity(identityKey: string) {
  const escapedIdentityKey = escapeLikePattern(identityKey);
  return or(
    eq(orgEntityPeople.canonicalKey, `person:${identityKey}`),
    like(orgEntityPeople.canonicalKey, `person:${escapedIdentityKey}|%`),
    like(orgEntityPeople.canonicalKey, `%|${escapedIdentityKey}|%`),
    like(orgEntityPeople.canonicalKey, `%|${escapedIdentityKey}`)
  );
}

function canonicalPersonKeyMembers(canonicalKey: string): string[] {
  const prefix = "person:";
  if (!canonicalKey.startsWith(prefix)) {
    return [];
  }
  return canonicalKey.slice(prefix.length).split("|").filter(Boolean);
}

function selectPrimaryBridgeSourceIdentity(
  graphPerson: EntityPerson,
  sourceIdentities: BridgeableGraphSourceIdentity[]
): BridgeableGraphSourceIdentity | undefined {
  return (
    sourceIdentities.find(
      (sourceIdentity) =>
        graphPerson.primarySourceIdentityId === sourceIdentity.id
    ) ?? sourceIdentities[0]
  );
}

function isBridgeableGraphSourceIdentity(
  sourceIdentity: EntitySourceIdentity
): sourceIdentity is BridgeableGraphSourceIdentity {
  return (
    sourceIdentity.identityType === "handle" &&
    (sourceIdentity.provider === "x" || sourceIdentity.provider === "github")
  );
}

function entityGraphPeopleBridgeMetadata(input: {
  graphPerson: EntityPerson;
  resolverVersion: string;
  source?: Record<string, unknown>;
  sourceIdentities: BridgeableGraphSourceIdentity[];
  sourceIdentity: BridgeableGraphSourceIdentity;
}): EntityGraphMetadata {
  return {
    entityGraph: {
      personCanonicalKey: input.graphPerson.canonicalKey,
      personConfidence: input.graphPerson.confidence,
      personPublicId: input.graphPerson.publicId,
      personStatus: input.graphPerson.status,
      resolverVersion: input.resolverVersion,
      source: input.source ?? null,
      sourceIdentities: input.sourceIdentities.map(toBridgeSourceIdentity),
      sourceIdentityKey: input.sourceIdentity.identityKey,
      sourceIdentityKeys: input.sourceIdentities.map(
        (sourceIdentity) => sourceIdentity.identityKey
      ),
      sourceIdentityPublicId: input.sourceIdentity.publicId,
      sourceIdentityPublicIds: input.sourceIdentities.map(
        (sourceIdentity) => sourceIdentity.publicId
      ),
    },
  };
}

function toBridgeSourceIdentity(sourceIdentity: BridgeableGraphSourceIdentity) {
  return {
    identityKey: sourceIdentity.identityKey,
    identityType: sourceIdentity.identityType,
    identityValue: sourceIdentity.identityValue,
    normalizedValue: sourceIdentity.normalizedValue,
    provider: sourceIdentity.provider,
    publicId: sourceIdentity.publicId,
  };
}
