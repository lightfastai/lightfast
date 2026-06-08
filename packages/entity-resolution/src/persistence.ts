import { createHash } from "node:crypto";
import type {
  EntityGraphStatus,
  ResolutionCandidateType,
  SourceIdentityProvider,
  SourceIdentityType,
} from "@repo/entity-graph-contract";

import type {
  EntityResolutionResult,
  EntityResolutionStatus,
  ResolvedBusinessCandidate,
  ResolvedPersonAffiliation,
  ResolvedPersonCandidate,
  SourceIdentity,
} from "./index";

export interface EntityResolutionPersistenceSourceIdentity {
  identityKey: string;
  identityType: SourceIdentityType;
  identityValue: string;
  metadata: Record<string, unknown>;
  normalizedValue: string;
  provider: SourceIdentityProvider;
  status: EntityGraphStatus;
}

export interface EntityResolutionPersistenceCandidateGroup {
  candidateKey: string;
  candidateType: ResolutionCandidateType;
  confidence: string;
  inputHash: string;
  metadata: Record<string, unknown>;
  outputHash: string;
  outputJson: Record<string, unknown>;
  status: EntityGraphStatus;
}

export interface EntityResolutionPersistenceBatch {
  candidateGroups: EntityResolutionPersistenceCandidateGroup[];
  sourceIdentities: EntityResolutionPersistenceSourceIdentity[];
}

export function entityResolutionResultToPersistenceBatch(
  result: EntityResolutionResult
): EntityResolutionPersistenceBatch {
  const sourceIdentityByKey = new Map<
    string,
    EntityResolutionPersistenceSourceIdentity
  >();
  const accountKeyByName = new Map<string, string>();
  const candidateGroups: EntityResolutionPersistenceCandidateGroup[] = [];

  for (const business of result.businesses) {
    const accountKey = accountCandidateKey(business);
    accountKeyByName.set(normalizedNameKey(business.displayName), accountKey);
    for (const identity of business.sourceIdentities) {
      upsertPersistenceSourceIdentity(sourceIdentityByKey, identity, {
        candidateType: "account",
        status: business.status,
      });
    }
    candidateGroups.push(accountCandidateGroup(business, accountKey));
  }

  for (const person of result.people) {
    const personKey = personCandidateKey(person);
    for (const identity of person.sourceIdentities) {
      upsertPersistenceSourceIdentity(sourceIdentityByKey, identity, {
        candidateType: "person",
        status: person.status,
      });
    }
    candidateGroups.push(personCandidateGroup(person, personKey));

    for (const affiliation of person.affiliations) {
      const accountKey =
        accountKeyByName.get(normalizedNameKey(affiliation.businessName)) ??
        fallbackAccountCandidateKey(affiliation.businessName);
      candidateGroups.push(
        affiliationCandidateGroup({
          accountKey,
          affiliation,
          person,
          personKey,
        })
      );
    }
  }

  return {
    candidateGroups: candidateGroups.sort((left, right) =>
      left.candidateKey.localeCompare(right.candidateKey)
    ),
    sourceIdentities: [...sourceIdentityByKey.values()].sort((left, right) =>
      left.identityKey.localeCompare(right.identityKey)
    ),
  };
}

function upsertPersistenceSourceIdentity(
  sourceIdentityByKey: Map<string, EntityResolutionPersistenceSourceIdentity>,
  identity: SourceIdentity,
  input: { candidateType: "account" | "person"; status: EntityResolutionStatus }
): void {
  const existing = sourceIdentityByKey.get(identity.key);
  const status = strongestStatus(existing?.status, toGraphStatus(input.status));

  sourceIdentityByKey.set(identity.key, {
    identityKey: identity.key,
    identityType: identity.type,
    identityValue: identity.value,
    metadata: {
      candidateTypes: sortedUnique([
        ...metadataStringArray(existing?.metadata.candidateTypes),
        input.candidateType,
      ]),
      url: identity.url ?? null,
    },
    normalizedValue: identity.value.trim().toLowerCase(),
    provider: identity.provider,
    status,
  });
}

function personCandidateGroup(
  person: ResolvedPersonCandidate,
  candidateKey: string
): EntityResolutionPersistenceCandidateGroup {
  const outputJson = {
    affiliationCount: person.affiliations.length,
    conflicts: person.conflicts,
    displayName: person.displayName,
    evidenceIds: sortedUnique(person.evidence.map((item) => item.id)),
    sourceIdentityKeys: sortedUnique(
      person.sourceIdentities.map((identity) => identity.key)
    ),
  };

  return candidateGroup({
    candidateKey,
    candidateType: "person",
    confidence: person.confidence,
    input: {
      evidenceIds: outputJson.evidenceIds,
      sourceIdentityKeys: outputJson.sourceIdentityKeys,
    },
    metadata: {
      conflictCount: person.conflicts.length,
      sourceIdentityCount: person.sourceIdentities.length,
    },
    outputJson,
    status: person.status,
  });
}

function accountCandidateGroup(
  business: ResolvedBusinessCandidate,
  candidateKey: string
): EntityResolutionPersistenceCandidateGroup {
  const sourceIdentityKeys = sortedUnique(
    business.sourceIdentities.map((identity) => identity.key)
  );
  const outputJson = {
    displayName: business.displayName,
    domains: sortedUnique(business.domains),
    evidenceIds: sortedUnique(business.evidence.map((item) => item.id)),
    sourceIdentityKeys,
  };

  return candidateGroup({
    candidateKey,
    candidateType: "account",
    confidence: business.confidence,
    input: {
      domains: outputJson.domains,
      sourceIdentityKeys,
    },
    metadata: {
      accountType: business.domains.length > 0 ? "company" : "unknown",
    },
    outputJson,
    status: business.status,
  });
}

function affiliationCandidateGroup(input: {
  accountKey: string;
  affiliation: ResolvedPersonAffiliation;
  person: ResolvedPersonCandidate;
  personKey: string;
}): EntityResolutionPersistenceCandidateGroup {
  const candidateKey = [
    "affiliation",
    input.personKey,
    input.accountKey,
    input.affiliation.relationship,
  ].join(":");
  const outputJson = {
    accountCandidateKey: input.accountKey,
    accountDisplayName: input.affiliation.businessName,
    evidenceIds: sortedUnique(
      input.affiliation.evidence.map((item) => item.id)
    ),
    personCandidateKey: input.personKey,
    personDisplayName: input.person.displayName,
    relationship: input.affiliation.relationship,
  };

  return candidateGroup({
    candidateKey,
    candidateType: "affiliation",
    confidence: input.affiliation.confidence,
    input: {
      accountKey: input.accountKey,
      evidenceIds: outputJson.evidenceIds,
      personKey: input.personKey,
      relationship: input.affiliation.relationship,
    },
    metadata: {
      relationship: input.affiliation.relationship,
    },
    outputJson,
    status: input.affiliation.status,
  });
}

function candidateGroup(input: {
  candidateKey: string;
  candidateType: ResolutionCandidateType;
  confidence: number;
  input: Record<string, unknown>;
  metadata: Record<string, unknown>;
  outputJson: Record<string, unknown>;
  status: EntityResolutionStatus;
}): EntityResolutionPersistenceCandidateGroup {
  return {
    candidateKey: input.candidateKey,
    candidateType: input.candidateType,
    confidence: toDecimalConfidence(input.confidence),
    inputHash: sha256Json(input.input),
    metadata: input.metadata,
    outputHash: sha256Json(input.outputJson),
    outputJson: input.outputJson,
    status: toGraphStatus(input.status),
  };
}

function personCandidateKey(person: ResolvedPersonCandidate): string {
  const identityKeys = sortedUnique(
    person.sourceIdentities.map((identity) => identity.key)
  );
  if (identityKeys.length > 0) {
    return `person:${identityKeys.join("|")}`;
  }
  return `person:name:${normalizedNameKey(person.displayName)}`;
}

function accountCandidateKey(business: ResolvedBusinessCandidate): string {
  const domain = sortedUnique(
    business.domains.map((value) => value.toLowerCase())
  )[0];
  if (domain) {
    return `account:domain:${domain}`;
  }
  return fallbackAccountCandidateKey(business.displayName);
}

function fallbackAccountCandidateKey(displayName: string): string {
  return `account:name:${normalizedNameKey(displayName)}:no-domain`;
}

function normalizedNameKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function toGraphStatus(status: EntityResolutionStatus): EntityGraphStatus {
  return status;
}

function strongestStatus(
  left: EntityGraphStatus | undefined,
  right: EntityGraphStatus
): EntityGraphStatus {
  if (!left) {
    return right;
  }
  return statusRank(right) > statusRank(left) ? right : left;
}

function statusRank(status: EntityGraphStatus): number {
  switch (status) {
    case "confirmed":
      return 5;
    case "likely":
      return 4;
    case "possible":
      return 3;
    case "conflicting":
      return 2;
    case "rejected":
      return 1;
    case "superseded":
      return 0;
    default:
      return 0;
  }
}

function toDecimalConfidence(value: number): string {
  return Math.max(0, Math.min(1, value)).toFixed(4);
}

function sha256Json(value: unknown): string {
  return createHash("sha256").update(stableJsonStringify(value)).digest("hex");
}

function stableJsonStringify(value: unknown): string {
  return JSON.stringify(stableJsonValue(value));
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableJsonValue);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableJsonValue(item)])
  );
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function metadataStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
