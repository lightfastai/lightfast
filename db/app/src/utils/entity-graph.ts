import { createHash } from "node:crypto";
import type {
  AccountType,
  AffiliationRelationship,
  EntityGraphStatus,
  ObservationStatus,
  ResolutionCandidateType,
  SourceIdentityProvider,
  SourceIdentityType,
} from "@repo/entity-graph-contract";
import {
  entityResolutionResultToPersistenceBatch,
  normalizeHandle,
  type EntityObservation as ResolutionEntityObservation,
  resolveEntityCandidates,
} from "@repo/entity-resolution";
import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../client";
import {
  type EntityAccount,
  type EntityGraphCandidateOutput,
  type EntityGraphConfidence,
  type EntityGraphMetadata,
  type EntityGraphSnapshot,
  type EntityObservation,
  type EntityPerson,
  type EntityPersonAccountAffiliation,
  type EntityResolutionCandidateGroup,
  type EntityResolutionCandidateVersion,
  type EntitySourceIdentity,
  orgEntityAccounts,
  orgEntityObservations,
  orgEntityPeople,
  orgEntityPersonAccountAffiliations,
  orgEntityResolutionCandidateGroups,
  orgEntityResolutionCandidateVersions,
  orgEntitySourceIdentities,
} from "../schema";

const DEFAULT_METADATA: EntityGraphMetadata = {};

export interface UpsertSourceIdentityInput {
  clerkOrgId: string;
  identityKey: string;
  identityType: SourceIdentityType;
  identityValue: string;
  metadata?: EntityGraphMetadata;
  normalizedValue: string;
  provider: SourceIdentityProvider;
  status?: EntityGraphStatus;
}

export async function upsertSourceIdentity(
  db: Database,
  input: UpsertSourceIdentityInput
): Promise<EntitySourceIdentity> {
  const status = input.status ?? "likely";
  const metadata = input.metadata ?? DEFAULT_METADATA;

  await db
    .insert(orgEntitySourceIdentities)
    .values({
      clerkOrgId: input.clerkOrgId,
      identityKey: input.identityKey,
      identityType: input.identityType,
      identityValue: input.identityValue,
      metadata,
      normalizedValue: input.normalizedValue,
      provider: input.provider,
      status,
    })
    .onDuplicateKeyUpdate({
      set: {
        identityType: input.identityType,
        identityValue: input.identityValue,
        metadata,
        normalizedValue: input.normalizedValue,
        provider: input.provider,
        status,
      },
    });

  const row = await getSourceIdentityByKey(db, {
    clerkOrgId: input.clerkOrgId,
    identityKey: input.identityKey,
  });
  if (!row) {
    throw new Error(`Source identity was not persisted: ${input.identityKey}`);
  }
  return row;
}

export interface AppendEntityObservationInput {
  clerkOrgId: string;
  contentHash: string;
  normalizedSnapshot: EntityGraphSnapshot;
  observedAt: Date;
  provider: SourceIdentityProvider;
  rawExpiresAt?: Date | null;
  rawSnapshot?: EntityGraphSnapshot | null;
  sourceIdentityId: number;
  status?: ObservationStatus;
}

export async function appendEntityObservation(
  db: Database,
  input: AppendEntityObservationInput
): Promise<EntityObservation> {
  await db
    .insert(orgEntityObservations)
    .values({
      clerkOrgId: input.clerkOrgId,
      contentHash: input.contentHash,
      normalizedSnapshot: input.normalizedSnapshot,
      observedAt: input.observedAt,
      provider: input.provider,
      rawExpiresAt: input.rawExpiresAt ?? null,
      rawSnapshot: input.rawSnapshot ?? null,
      sourceIdentityId: input.sourceIdentityId,
      status: input.status ?? "active",
    })
    .onDuplicateKeyUpdate({
      set: {
        contentHash: input.contentHash,
      },
    });

  const row = await getObservationByContentHash(db, {
    contentHash: input.contentHash,
    sourceIdentityId: input.sourceIdentityId,
  });
  if (!row) {
    throw new Error(
      `Entity observation was not persisted: ${input.sourceIdentityId}/${input.contentHash}`
    );
  }
  return row;
}

export interface IngestEntityObservationsInput {
  clerkOrgId: string;
  observations: ResolutionEntityObservation[];
  observedAt?: Date;
  rawExpiresAt?: Date | null;
  resolverVersion: string;
}

export interface IngestEntityObservationsResult
  extends PersistEntityResolutionBatchResult {
  observations: number;
}

export async function ingestEntityObservations(
  db: Database,
  input: IngestEntityObservationsInput
): Promise<IngestEntityObservationsResult> {
  const resolutionResult = resolveEntityCandidates({
    observations: input.observations,
  });

  let observations = 0;
  for (const observation of input.observations) {
    const sourceIdentity = await upsertSourceIdentity(db, {
      clerkOrgId: input.clerkOrgId,
      ...sourceIdentityInputForObservation(observation),
    });
    const normalizedSnapshot = normalizedSnapshotForObservation(observation);
    await appendEntityObservation(db, {
      clerkOrgId: input.clerkOrgId,
      contentHash: sha256Json(normalizedSnapshot),
      normalizedSnapshot,
      observedAt: observedAtForObservation(observation, input.observedAt),
      provider: observation.provider,
      rawExpiresAt: input.rawExpiresAt ?? null,
      rawSnapshot: null,
      sourceIdentityId: sourceIdentity.id,
    });
    observations += 1;
  }

  const batch = entityResolutionResultToPersistenceBatch(resolutionResult);
  const summary = await persistEntityResolutionBatch(db, {
    batch,
    clerkOrgId: input.clerkOrgId,
    resolverVersion: input.resolverVersion,
  });

  return {
    ...summary,
    observations,
  };
}

export interface UpsertResolutionCandidateGroupInput {
  candidateKey: string;
  candidateType: ResolutionCandidateType;
  clerkOrgId: string;
  metadata?: EntityGraphMetadata;
  status: EntityGraphStatus;
}

export async function upsertResolutionCandidateGroup(
  db: Database,
  input: UpsertResolutionCandidateGroupInput
): Promise<EntityResolutionCandidateGroup> {
  const metadata = input.metadata ?? DEFAULT_METADATA;

  await db
    .insert(orgEntityResolutionCandidateGroups)
    .values({
      candidateKey: input.candidateKey,
      candidateType: input.candidateType,
      clerkOrgId: input.clerkOrgId,
      metadata,
      status: input.status,
    })
    .onDuplicateKeyUpdate({
      set: {
        metadata,
        status: input.status,
      },
    });

  const row = await getResolutionCandidateGroupByKey(db, {
    candidateKey: input.candidateKey,
    candidateType: input.candidateType,
    clerkOrgId: input.clerkOrgId,
  });
  if (!row) {
    throw new Error("Resolution candidate group was not persisted.");
  }
  return row;
}

export interface AppendResolutionCandidateVersionInput {
  candidateGroupId: number;
  clerkOrgId: string;
  confidence: EntityGraphConfidence;
  inputHash: string;
  metadata?: EntityGraphMetadata;
  outputHash: string;
  outputJson: EntityGraphCandidateOutput;
  resolverVersion: string;
  status: EntityGraphStatus;
}

export interface AppendResolutionCandidateVersionResult {
  appended: boolean;
  version: EntityResolutionCandidateVersion;
}

export async function appendResolutionCandidateVersionIfChanged(
  db: Database,
  input: AppendResolutionCandidateVersionInput
): Promise<AppendResolutionCandidateVersionResult> {
  const existing = await getResolutionCandidateVersionByOutputHash(db, {
    candidateGroupId: input.candidateGroupId,
    outputHash: input.outputHash,
  });
  if (existing) {
    return { appended: false, version: existing };
  }

  await db
    .insert(orgEntityResolutionCandidateVersions)
    .values({
      candidateGroupId: input.candidateGroupId,
      clerkOrgId: input.clerkOrgId,
      confidence: input.confidence,
      inputHash: input.inputHash,
      metadata: input.metadata ?? DEFAULT_METADATA,
      outputHash: input.outputHash,
      outputJson: input.outputJson,
      resolverVersion: input.resolverVersion,
      status: input.status,
    })
    .onDuplicateKeyUpdate({
      set: {
        outputHash: input.outputHash,
      },
    });

  const version = await getResolutionCandidateVersionByOutputHash(db, {
    candidateGroupId: input.candidateGroupId,
    outputHash: input.outputHash,
  });
  if (!version) {
    throw new Error("Resolution candidate version was not persisted.");
  }

  await db
    .update(orgEntityResolutionCandidateGroups)
    .set({
      currentCandidateVersionId: version.id,
      status: input.status,
    })
    .where(eq(orgEntityResolutionCandidateGroups.id, input.candidateGroupId));

  return { appended: true, version };
}

export interface UpsertEntityPersonInput {
  canonicalKey: string;
  clerkOrgId: string;
  confidence: EntityGraphConfidence;
  displayName: string;
  metadata?: EntityGraphMetadata;
  primarySourceIdentityId?: number | null;
  status: EntityGraphStatus;
}

export async function upsertEntityPerson(
  db: Database,
  input: UpsertEntityPersonInput
): Promise<EntityPerson> {
  const metadata = input.metadata ?? DEFAULT_METADATA;
  const primarySourceIdentityId = input.primarySourceIdentityId ?? null;

  await db
    .insert(orgEntityPeople)
    .values({
      canonicalKey: input.canonicalKey,
      clerkOrgId: input.clerkOrgId,
      confidence: input.confidence,
      displayName: input.displayName,
      metadata,
      primarySourceIdentityId,
      status: input.status,
    })
    .onDuplicateKeyUpdate({
      set: {
        confidence: input.confidence,
        displayName: input.displayName,
        metadata,
        primarySourceIdentityId,
        status: input.status,
      },
    });

  const row = await getEntityPersonByCanonicalKey(db, {
    canonicalKey: input.canonicalKey,
    clerkOrgId: input.clerkOrgId,
  });
  if (!row) {
    throw new Error(`Entity person was not persisted: ${input.canonicalKey}`);
  }
  return row;
}

export interface UpsertEntityAccountInput {
  accountType?: AccountType;
  canonicalKey: string;
  clerkOrgId: string;
  confidence: EntityGraphConfidence;
  displayName: string;
  metadata?: EntityGraphMetadata;
  primaryDomain?: string | null;
  status: EntityGraphStatus;
}

export async function upsertEntityAccount(
  db: Database,
  input: UpsertEntityAccountInput
): Promise<EntityAccount> {
  const metadata = input.metadata ?? DEFAULT_METADATA;
  const normalizedName = normalizeEntityName(input.displayName);
  const primaryDomain = input.primaryDomain ?? null;

  await db
    .insert(orgEntityAccounts)
    .values({
      accountType: input.accountType ?? "unknown",
      canonicalKey: input.canonicalKey,
      clerkOrgId: input.clerkOrgId,
      confidence: input.confidence,
      displayName: input.displayName,
      metadata,
      normalizedName,
      primaryDomain,
      status: input.status,
    })
    .onDuplicateKeyUpdate({
      set: {
        accountType: input.accountType ?? "unknown",
        confidence: input.confidence,
        displayName: input.displayName,
        metadata,
        normalizedName,
        primaryDomain,
        status: input.status,
      },
    });

  const row = await getEntityAccountByCanonicalKey(db, {
    canonicalKey: input.canonicalKey,
    clerkOrgId: input.clerkOrgId,
  });
  if (!row) {
    throw new Error(`Entity account was not persisted: ${input.canonicalKey}`);
  }
  return row;
}

export interface UpsertPersonAccountAffiliationInput {
  accountId: number;
  canonicalKey: string;
  clerkOrgId: string;
  confidence: EntityGraphConfidence;
  endedAt?: Date | null;
  isPrimary?: boolean;
  metadata?: EntityGraphMetadata;
  personId: number;
  relationship: AffiliationRelationship;
  startedAt?: Date | null;
  status: EntityGraphStatus;
  title?: string | null;
}

export async function upsertPersonAccountAffiliation(
  db: Database,
  input: UpsertPersonAccountAffiliationInput
): Promise<EntityPersonAccountAffiliation> {
  const metadata = input.metadata ?? DEFAULT_METADATA;

  await db
    .insert(orgEntityPersonAccountAffiliations)
    .values({
      accountId: input.accountId,
      canonicalKey: input.canonicalKey,
      clerkOrgId: input.clerkOrgId,
      confidence: input.confidence,
      endedAt: input.endedAt ?? null,
      isPrimary: input.isPrimary ?? false,
      metadata,
      personId: input.personId,
      relationship: input.relationship,
      startedAt: input.startedAt ?? null,
      status: input.status,
      title: input.title ?? null,
    })
    .onDuplicateKeyUpdate({
      set: {
        accountId: input.accountId,
        confidence: input.confidence,
        endedAt: input.endedAt ?? null,
        isPrimary: input.isPrimary ?? false,
        metadata,
        personId: input.personId,
        relationship: input.relationship,
        startedAt: input.startedAt ?? null,
        status: input.status,
        title: input.title ?? null,
      },
    });

  const row = await getPersonAccountAffiliationByCanonicalKey(db, {
    canonicalKey: input.canonicalKey,
    clerkOrgId: input.clerkOrgId,
  });
  if (!row) {
    throw new Error(
      `Entity affiliation was not persisted: ${input.canonicalKey}`
    );
  }
  return row;
}

export interface EntityResolutionPersistenceSourceIdentityInput {
  identityKey: string;
  identityType: SourceIdentityType;
  identityValue: string;
  metadata: EntityGraphMetadata;
  normalizedValue: string;
  provider: SourceIdentityProvider;
  status: EntityGraphStatus;
}

export interface EntityResolutionPersistenceCandidateGroupInput {
  candidateKey: string;
  candidateType: ResolutionCandidateType;
  confidence: EntityGraphConfidence;
  inputHash: string;
  metadata: EntityGraphMetadata;
  outputHash: string;
  outputJson: EntityGraphCandidateOutput;
  status: EntityGraphStatus;
}

export interface EntityResolutionPersistenceBatchInput {
  candidateGroups: EntityResolutionPersistenceCandidateGroupInput[];
  sourceIdentities: EntityResolutionPersistenceSourceIdentityInput[];
}

export interface PersistEntityResolutionBatchInput {
  batch: EntityResolutionPersistenceBatchInput;
  clerkOrgId: string;
  resolverVersion: string;
}

export interface PersistEntityResolutionBatchResult {
  candidateGroups: number;
  candidateVersionsAppended: number;
  candidateVersionsUnchanged: number;
  canonicalAccounts: number;
  canonicalAffiliations: number;
  canonicalPeople: number;
  skippedCanonicalCandidates: number;
  sourceIdentities: number;
}

export async function persistEntityResolutionBatch(
  db: Database,
  input: PersistEntityResolutionBatchInput
): Promise<PersistEntityResolutionBatchResult> {
  const sourceIdentityByKey = new Map<string, EntitySourceIdentity>();
  const accountByCandidateKey = new Map<string, EntityAccount>();
  const personByCandidateKey = new Map<string, EntityPerson>();
  const result: PersistEntityResolutionBatchResult = {
    canonicalAccounts: 0,
    canonicalAffiliations: 0,
    canonicalPeople: 0,
    candidateGroups: 0,
    candidateVersionsAppended: 0,
    candidateVersionsUnchanged: 0,
    skippedCanonicalCandidates: 0,
    sourceIdentities: 0,
  };

  for (const sourceIdentity of input.batch.sourceIdentities) {
    const row = await upsertSourceIdentity(db, {
      clerkOrgId: input.clerkOrgId,
      ...sourceIdentity,
    });
    sourceIdentityByKey.set(sourceIdentity.identityKey, row);
    result.sourceIdentities += 1;
  }

  for (const candidate of input.batch.candidateGroups) {
    const group = await upsertResolutionCandidateGroup(db, {
      candidateKey: candidate.candidateKey,
      candidateType: candidate.candidateType,
      clerkOrgId: input.clerkOrgId,
      metadata: candidate.metadata,
      status: candidate.status,
    });
    result.candidateGroups += 1;

    const versionResult = await appendResolutionCandidateVersionIfChanged(db, {
      candidateGroupId: group.id,
      clerkOrgId: input.clerkOrgId,
      confidence: candidate.confidence,
      inputHash: candidate.inputHash,
      metadata: candidate.metadata,
      outputHash: candidate.outputHash,
      outputJson: candidate.outputJson,
      resolverVersion: input.resolverVersion,
      status: candidate.status,
    });

    if (versionResult.appended) {
      result.candidateVersionsAppended += 1;
    } else {
      result.candidateVersionsUnchanged += 1;
    }
  }

  for (const candidate of input.batch.candidateGroups) {
    if (candidate.candidateType !== "account") {
      continue;
    }
    if (!canCreateCanonical(candidate.status)) {
      result.skippedCanonicalCandidates += 1;
      continue;
    }
    const displayName = readString(candidate.outputJson.displayName);
    if (!displayName) {
      result.skippedCanonicalCandidates += 1;
      continue;
    }
    const domains = readStringArray(candidate.outputJson.domains);
    const account = await upsertEntityAccount(db, {
      accountType: readAccountType(candidate.metadata.accountType),
      canonicalKey: candidate.candidateKey,
      clerkOrgId: input.clerkOrgId,
      confidence: candidate.confidence,
      displayName,
      metadata: candidate.metadata,
      primaryDomain: domains[0] ?? null,
      status: candidate.status,
    });
    accountByCandidateKey.set(candidate.candidateKey, account);
    result.canonicalAccounts += 1;
  }

  for (const candidate of input.batch.candidateGroups) {
    if (candidate.candidateType !== "person") {
      continue;
    }
    if (!canCreateCanonical(candidate.status)) {
      result.skippedCanonicalCandidates += 1;
      continue;
    }
    const displayName = readString(candidate.outputJson.displayName);
    if (!displayName) {
      result.skippedCanonicalCandidates += 1;
      continue;
    }
    const sourceIdentityKeys = readStringArray(
      candidate.outputJson.sourceIdentityKeys
    );
    const primarySourceIdentityId = sourceIdentityKeys
      .map((key) => sourceIdentityByKey.get(key)?.id)
      .find((id): id is number => typeof id === "number");
    const person = await upsertEntityPerson(db, {
      canonicalKey: candidate.candidateKey,
      clerkOrgId: input.clerkOrgId,
      confidence: candidate.confidence,
      displayName,
      metadata: candidate.metadata,
      primarySourceIdentityId: primarySourceIdentityId ?? null,
      status: candidate.status,
    });
    personByCandidateKey.set(candidate.candidateKey, person);
    result.canonicalPeople += 1;
  }

  for (const candidate of input.batch.candidateGroups) {
    if (candidate.candidateType !== "affiliation") {
      continue;
    }
    if (!canCreateCanonical(candidate.status)) {
      result.skippedCanonicalCandidates += 1;
      continue;
    }
    const personKey = readString(candidate.outputJson.personCandidateKey);
    const accountKey = readString(candidate.outputJson.accountCandidateKey);
    const relationship = readAffiliationRelationship(
      candidate.outputJson.relationship
    );
    const person = personKey ? personByCandidateKey.get(personKey) : undefined;
    const account = accountKey
      ? accountByCandidateKey.get(accountKey)
      : undefined;
    if (!(person && account && relationship)) {
      result.skippedCanonicalCandidates += 1;
      continue;
    }
    await upsertPersonAccountAffiliation(db, {
      accountId: account.id,
      canonicalKey: candidate.candidateKey,
      clerkOrgId: input.clerkOrgId,
      confidence: candidate.confidence,
      isPrimary: relationship === "current",
      metadata: candidate.metadata,
      personId: person.id,
      relationship,
      status: candidate.status,
    });
    result.canonicalAffiliations += 1;
  }

  return result;
}

export interface ListEntityPeopleInput {
  clerkOrgId: string;
  limit?: number;
  status?: EntityGraphStatus;
}

export async function listEntityPeople(
  db: Database,
  input: ListEntityPeopleInput
): Promise<EntityPerson[]> {
  const conditions = [
    eq(orgEntityPeople.clerkOrgId, input.clerkOrgId),
    input.status ? eq(orgEntityPeople.status, input.status) : undefined,
  ].filter(isDefined);

  return db
    .select()
    .from(orgEntityPeople)
    .where(and(...conditions))
    .orderBy(desc(orgEntityPeople.updatedAt), desc(orgEntityPeople.id))
    .limit(normalizeLimit(input.limit));
}

export async function getEntityPersonByPublicId(
  db: Database,
  input: { clerkOrgId: string; publicId: string }
): Promise<EntityPerson | undefined> {
  const [row] = await db
    .select()
    .from(orgEntityPeople)
    .where(
      and(
        eq(orgEntityPeople.clerkOrgId, input.clerkOrgId),
        eq(orgEntityPeople.publicId, input.publicId)
      )
    )
    .limit(1);
  return row;
}

export interface ListEntityAccountsInput {
  clerkOrgId: string;
  limit?: number;
  status?: EntityGraphStatus;
}

export async function listEntityAccounts(
  db: Database,
  input: ListEntityAccountsInput
): Promise<EntityAccount[]> {
  const conditions = [
    eq(orgEntityAccounts.clerkOrgId, input.clerkOrgId),
    input.status ? eq(orgEntityAccounts.status, input.status) : undefined,
  ].filter(isDefined);

  return db
    .select()
    .from(orgEntityAccounts)
    .where(and(...conditions))
    .orderBy(desc(orgEntityAccounts.updatedAt), desc(orgEntityAccounts.id))
    .limit(normalizeLimit(input.limit));
}

export async function getEntityAccountByPublicId(
  db: Database,
  input: { clerkOrgId: string; publicId: string }
): Promise<EntityAccount | undefined> {
  const [row] = await db
    .select()
    .from(orgEntityAccounts)
    .where(
      and(
        eq(orgEntityAccounts.clerkOrgId, input.clerkOrgId),
        eq(orgEntityAccounts.publicId, input.publicId)
      )
    )
    .limit(1);
  return row;
}

export interface ListEntityPersonAccountAffiliationsInput {
  clerkOrgId: string;
  limit?: number;
  personId: number;
  status?: EntityGraphStatus;
}

export async function listEntityPersonAccountAffiliations(
  db: Database,
  input: ListEntityPersonAccountAffiliationsInput
): Promise<EntityPersonAccountAffiliation[]> {
  const conditions = [
    eq(orgEntityPersonAccountAffiliations.clerkOrgId, input.clerkOrgId),
    eq(orgEntityPersonAccountAffiliations.personId, input.personId),
    input.status
      ? eq(orgEntityPersonAccountAffiliations.status, input.status)
      : undefined,
  ].filter(isDefined);

  return db
    .select()
    .from(orgEntityPersonAccountAffiliations)
    .where(and(...conditions))
    .orderBy(
      desc(orgEntityPersonAccountAffiliations.updatedAt),
      desc(orgEntityPersonAccountAffiliations.id)
    )
    .limit(normalizeLimit(input.limit));
}

export interface GetEntityPersonEvidenceTrailInput {
  canonicalKey: string;
  clerkOrgId: string;
}

export interface EntityPersonEvidenceTrail {
  candidateGroup: EntityResolutionCandidateGroup | undefined;
  candidateVersions: EntityResolutionCandidateVersion[];
  person: EntityPerson | undefined;
}

export async function getEntityPersonEvidenceTrail(
  db: Database,
  input: GetEntityPersonEvidenceTrailInput
): Promise<EntityPersonEvidenceTrail> {
  const person = await getEntityPersonByCanonicalKey(db, input);
  const candidateGroup = await getResolutionCandidateGroupByKey(db, {
    candidateKey: input.canonicalKey,
    candidateType: "person",
    clerkOrgId: input.clerkOrgId,
  });
  const candidateVersions = candidateGroup
    ? await listResolutionCandidateVersions(db, {
        candidateGroupId: candidateGroup.id,
        limit: 50,
      })
    : [];

  return {
    candidateGroup,
    candidateVersions,
    person,
  };
}

export interface GetEntityAccountEvidenceTrailInput {
  canonicalKey: string;
  clerkOrgId: string;
}

export interface EntityAccountEvidenceTrail {
  account: EntityAccount | undefined;
  candidateGroup: EntityResolutionCandidateGroup | undefined;
  candidateVersions: EntityResolutionCandidateVersion[];
}

export async function getEntityAccountEvidenceTrail(
  db: Database,
  input: GetEntityAccountEvidenceTrailInput
): Promise<EntityAccountEvidenceTrail> {
  const account = await getEntityAccountByCanonicalKey(db, input);
  const candidateGroup = await getResolutionCandidateGroupByKey(db, {
    candidateKey: input.canonicalKey,
    candidateType: "account",
    clerkOrgId: input.clerkOrgId,
  });
  const candidateVersions = candidateGroup
    ? await listResolutionCandidateVersions(db, {
        candidateGroupId: candidateGroup.id,
        limit: 50,
      })
    : [];

  return {
    account,
    candidateGroup,
    candidateVersions,
  };
}

async function getSourceIdentityByKey(
  db: Database,
  input: { clerkOrgId: string; identityKey: string }
): Promise<EntitySourceIdentity | undefined> {
  const [row] = await db
    .select()
    .from(orgEntitySourceIdentities)
    .where(
      and(
        eq(orgEntitySourceIdentities.clerkOrgId, input.clerkOrgId),
        eq(orgEntitySourceIdentities.identityKey, input.identityKey)
      )
    )
    .limit(1);
  return row;
}

async function getObservationByContentHash(
  db: Database,
  input: { contentHash: string; sourceIdentityId: number }
): Promise<EntityObservation | undefined> {
  const [row] = await db
    .select()
    .from(orgEntityObservations)
    .where(
      and(
        eq(orgEntityObservations.sourceIdentityId, input.sourceIdentityId),
        eq(orgEntityObservations.contentHash, input.contentHash)
      )
    )
    .limit(1);
  return row;
}

async function getResolutionCandidateGroupByKey(
  db: Database,
  input: {
    candidateKey: string;
    candidateType: ResolutionCandidateType;
    clerkOrgId: string;
  }
): Promise<EntityResolutionCandidateGroup | undefined> {
  const [row] = await db
    .select()
    .from(orgEntityResolutionCandidateGroups)
    .where(
      and(
        eq(orgEntityResolutionCandidateGroups.clerkOrgId, input.clerkOrgId),
        eq(
          orgEntityResolutionCandidateGroups.candidateType,
          input.candidateType
        ),
        eq(orgEntityResolutionCandidateGroups.candidateKey, input.candidateKey)
      )
    )
    .limit(1);
  return row;
}

async function getResolutionCandidateVersionByOutputHash(
  db: Database,
  input: { candidateGroupId: number; outputHash: string }
): Promise<EntityResolutionCandidateVersion | undefined> {
  const [row] = await db
    .select()
    .from(orgEntityResolutionCandidateVersions)
    .where(
      and(
        eq(
          orgEntityResolutionCandidateVersions.candidateGroupId,
          input.candidateGroupId
        ),
        eq(orgEntityResolutionCandidateVersions.outputHash, input.outputHash)
      )
    )
    .limit(1);
  return row;
}

async function getEntityPersonByCanonicalKey(
  db: Database,
  input: { canonicalKey: string; clerkOrgId: string }
): Promise<EntityPerson | undefined> {
  const [row] = await db
    .select()
    .from(orgEntityPeople)
    .where(
      and(
        eq(orgEntityPeople.clerkOrgId, input.clerkOrgId),
        eq(orgEntityPeople.canonicalKey, input.canonicalKey)
      )
    )
    .limit(1);
  return row;
}

async function getEntityAccountByCanonicalKey(
  db: Database,
  input: { canonicalKey: string; clerkOrgId: string }
): Promise<EntityAccount | undefined> {
  const [row] = await db
    .select()
    .from(orgEntityAccounts)
    .where(
      and(
        eq(orgEntityAccounts.clerkOrgId, input.clerkOrgId),
        eq(orgEntityAccounts.canonicalKey, input.canonicalKey)
      )
    )
    .limit(1);
  return row;
}

async function getPersonAccountAffiliationByCanonicalKey(
  db: Database,
  input: { canonicalKey: string; clerkOrgId: string }
): Promise<EntityPersonAccountAffiliation | undefined> {
  const [row] = await db
    .select()
    .from(orgEntityPersonAccountAffiliations)
    .where(
      and(
        eq(orgEntityPersonAccountAffiliations.clerkOrgId, input.clerkOrgId),
        eq(orgEntityPersonAccountAffiliations.canonicalKey, input.canonicalKey)
      )
    )
    .limit(1);
  return row;
}

async function listResolutionCandidateVersions(
  db: Database,
  input: { candidateGroupId: number; limit: number }
): Promise<EntityResolutionCandidateVersion[]> {
  return db
    .select()
    .from(orgEntityResolutionCandidateVersions)
    .where(
      eq(
        orgEntityResolutionCandidateVersions.candidateGroupId,
        input.candidateGroupId
      )
    )
    .orderBy(
      desc(orgEntityResolutionCandidateVersions.createdAt),
      desc(orgEntityResolutionCandidateVersions.id)
    )
    .limit(normalizeLimit(input.limit));
}

function canCreateCanonical(status: EntityGraphStatus): boolean {
  return status === "likely" || status === "confirmed";
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return 50;
  }
  return Math.max(1, Math.min(Math.trunc(limit), 100));
}

function normalizeEntityName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function readString(value: unknown): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => readString(item))
        .filter((item): item is string => Boolean(item))
    : [];
}

function readAccountType(value: unknown): AccountType {
  switch (value) {
    case "agency":
    case "community":
    case "company":
    case "fund":
    case "open_source_project":
    case "personal_brand":
    case "product":
    case "unknown":
      return value;
    default:
      return "unknown";
  }
}

function readAffiliationRelationship(
  value: unknown
): AffiliationRelationship | undefined {
  switch (value) {
    case "advisor":
    case "creator":
    case "current":
    case "employee":
    case "founder":
    case "historical":
    case "investor":
    case "maintainer":
    case "owner":
    case "possible":
      return value;
    default:
      return;
  }
}

function sourceIdentityInputForObservation(
  observation: ResolutionEntityObservation
): Omit<UpsertSourceIdentityInput, "clerkOrgId"> {
  const identity =
    observation.provider === "x"
      ? normalizeHandle("x", observation.profile.username)
      : normalizeHandle("github", observation.profile.login);

  if (!identity) {
    throw new Error("Unsupported entity observation identity.");
  }

  return {
    identityKey: identity.key,
    identityType: identity.type,
    identityValue: identity.value,
    metadata: {
      ingestionProvider: observation.provider,
    },
    normalizedValue: identity.value,
    provider: identity.provider,
    status: "likely",
  };
}

function normalizedSnapshotForObservation(
  observation: ResolutionEntityObservation
): EntityGraphSnapshot {
  return {
    profile: observation.profile,
    provider: observation.provider,
  };
}

function observedAtForObservation(
  observation: ResolutionEntityObservation,
  fallback: Date | undefined
): Date {
  if (!observation.observedAt) {
    return fallback ?? new Date();
  }

  const observedAt = new Date(observation.observedAt);
  if (Number.isNaN(observedAt.getTime())) {
    throw new Error("Invalid entity observation observedAt.");
  }
  return observedAt;
}

function sha256Json(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJsonValue(item)])
    );
  }
  return value;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
