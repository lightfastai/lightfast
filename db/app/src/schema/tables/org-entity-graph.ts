import { randomUUID } from "node:crypto";
import type {
  AccountType,
  AffiliationRelationship,
  ConfirmedByType,
  EntityGraphStatus,
  EntityLinkCreatedByType,
  EntityLinkEntityType,
  EvidenceClaimType,
  EvidenceSubjectType,
  ObservationStatus,
  ResolutionCandidateType,
  SourceIdentityProvider,
  SourceIdentityType,
} from "@repo/entity-graph-contract";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  datetime,
  decimal,
  index,
  json,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const PUBLIC_ID_LENGTH = 80;
const CLERK_ID_LENGTH = 64;
const CODE_LENGTH = 64;
const DISPLAY_NAME_LENGTH = 256;
const DOMAIN_LENGTH = 255;
const HASH_LENGTH = 128;
const KEY_LENGTH = 512;
const POLICY_LENGTH = 128;
const RESOLVER_VERSION_LENGTH = 128;
const USER_REF_LENGTH = 128;

export const ENTITY_PERSON_ID_PREFIX = "person_";
export const ENTITY_ACCOUNT_ID_PREFIX = "acct_";
export const ENTITY_AFFILIATION_ID_PREFIX = "aff_";
export const ENTITY_SOURCE_IDENTITY_ID_PREFIX = "sid_";
export const ENTITY_OBSERVATION_ID_PREFIX = "obs_";
export const ENTITY_EVIDENCE_ID_PREFIX = "evi_";
export const ENTITY_LINK_ID_PREFIX = "link_";
export const ENTITY_CANDIDATE_GROUP_ID_PREFIX = "candgrp_";
export const ENTITY_CANDIDATE_VERSION_ID_PREFIX = "candver_";

export type EntityGraphMetadata = Record<string, unknown>;
export type EntityGraphSnapshot = Record<string, unknown>;
export type EntityGraphCandidateOutput = Record<string, unknown>;
export type EntityGraphConfidence = string;
export type EntityGraphPrimaryFlag = boolean;

export type {
  AccountType,
  AffiliationRelationship,
  ConfirmedByType,
  EntityGraphStatus,
  EntityLinkCreatedByType,
  EntityLinkEntityType,
  EvidenceClaimType,
  EvidenceSubjectType,
  ObservationStatus,
  ResolutionCandidateType,
  SourceIdentityProvider,
  SourceIdentityType,
};

export function createEntityPersonId() {
  return `${ENTITY_PERSON_ID_PREFIX}${randomUUID()}`;
}

export function createEntityAccountId() {
  return `${ENTITY_ACCOUNT_ID_PREFIX}${randomUUID()}`;
}

export function createEntityAffiliationId() {
  return `${ENTITY_AFFILIATION_ID_PREFIX}${randomUUID()}`;
}

export function createEntitySourceIdentityId() {
  return `${ENTITY_SOURCE_IDENTITY_ID_PREFIX}${randomUUID()}`;
}

export function createEntityObservationId() {
  return `${ENTITY_OBSERVATION_ID_PREFIX}${randomUUID()}`;
}

export function createEntityEvidenceId() {
  return `${ENTITY_EVIDENCE_ID_PREFIX}${randomUUID()}`;
}

export function createEntityLinkId() {
  return `${ENTITY_LINK_ID_PREFIX}${randomUUID()}`;
}

export function createEntityCandidateGroupId() {
  return `${ENTITY_CANDIDATE_GROUP_ID_PREFIX}${randomUUID()}`;
}

export function createEntityCandidateVersionId() {
  return `${ENTITY_CANDIDATE_VERSION_ID_PREFIX}${randomUUID()}`;
}

export const orgEntityPeople = mysqlTable(
  "lightfast_org_entity_people",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createEntityPersonId),

    canonicalKey: varchar("canonical_key", { length: KEY_LENGTH }).notNull(),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    displayName: varchar("display_name", {
      length: DISPLAY_NAME_LENGTH,
    }).notNull(),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<EntityGraphStatus>()
      .notNull(),

    confidence: decimal("confidence", { precision: 5, scale: 4 })
      .$type<EntityGraphConfidence>()
      .notNull(),

    primarySourceIdentityId: bigint("primary_source_identity_id", {
      mode: "number",
      unsigned: true,
    }),

    confirmedByType: varchar("confirmed_by_type", {
      length: CODE_LENGTH,
    }).$type<ConfirmedByType>(),

    confirmedById: varchar("confirmed_by_id", { length: USER_REF_LENGTH }),

    confirmationPolicy: varchar("confirmation_policy", {
      length: POLICY_LENGTH,
    }),

    confirmedAt: datetime("confirmed_at", { mode: "date", fsp: 3 }),

    metadata: json("metadata")
      .$type<EntityGraphMetadata>()
      .default(sql`(JSON_OBJECT())`)
      .notNull(),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("org_entity_people_public_id_uq").on(
      table.publicId
    ),
    canonicalKeyUq: uniqueIndex("org_entity_people_canonical_key_uq").on(
      table.clerkOrgId,
      table.canonicalKey
    ),
    orgStatusIdx: index("org_entity_people_org_status_idx").on(
      table.clerkOrgId,
      table.status,
      table.updatedAt,
      table.id
    ),
    orgPrimarySourceIdx: index("org_entity_people_primary_source_idx").on(
      table.clerkOrgId,
      table.primarySourceIdentityId
    ),
  })
);

export const orgEntityAccounts = mysqlTable(
  "lightfast_org_entity_accounts",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createEntityAccountId),

    canonicalKey: varchar("canonical_key", { length: KEY_LENGTH }).notNull(),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    displayName: varchar("display_name", {
      length: DISPLAY_NAME_LENGTH,
    }).notNull(),

    normalizedName: varchar("normalized_name", {
      length: DISPLAY_NAME_LENGTH,
    }).notNull(),

    accountType: varchar("account_type", { length: CODE_LENGTH })
      .$type<AccountType>()
      .default("unknown")
      .notNull(),

    primaryDomain: varchar("primary_domain", { length: DOMAIN_LENGTH }),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<EntityGraphStatus>()
      .notNull(),

    confidence: decimal("confidence", { precision: 5, scale: 4 })
      .$type<EntityGraphConfidence>()
      .notNull(),

    confirmedByType: varchar("confirmed_by_type", {
      length: CODE_LENGTH,
    }).$type<ConfirmedByType>(),

    confirmedById: varchar("confirmed_by_id", { length: USER_REF_LENGTH }),

    confirmationPolicy: varchar("confirmation_policy", {
      length: POLICY_LENGTH,
    }),

    confirmedAt: datetime("confirmed_at", { mode: "date", fsp: 3 }),

    metadata: json("metadata")
      .$type<EntityGraphMetadata>()
      .default(sql`(JSON_OBJECT())`)
      .notNull(),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("org_entity_accounts_public_id_uq").on(
      table.publicId
    ),
    canonicalKeyUq: uniqueIndex("org_entity_accounts_canonical_key_uq").on(
      table.clerkOrgId,
      table.canonicalKey
    ),
    orgDomainIdx: index("org_entity_accounts_org_domain_idx").on(
      table.clerkOrgId,
      table.primaryDomain
    ),
    orgNameIdx: index("org_entity_accounts_org_name_idx").on(
      table.clerkOrgId,
      table.normalizedName
    ),
    orgStatusIdx: index("org_entity_accounts_org_status_idx").on(
      table.clerkOrgId,
      table.status,
      table.updatedAt,
      table.id
    ),
  })
);

export const orgEntityPersonAccountAffiliations = mysqlTable(
  "lightfast_org_entity_person_account_affiliations",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createEntityAffiliationId),

    canonicalKey: varchar("canonical_key", { length: KEY_LENGTH }).notNull(),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    personId: bigint("person_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    accountId: bigint("account_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    relationship: varchar("relationship", { length: CODE_LENGTH })
      .$type<AffiliationRelationship>()
      .notNull(),

    isPrimary: boolean("is_primary").default(false).notNull(),

    title: varchar("title", { length: DISPLAY_NAME_LENGTH }),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<EntityGraphStatus>()
      .notNull(),

    confidence: decimal("confidence", { precision: 5, scale: 4 })
      .$type<EntityGraphConfidence>()
      .notNull(),

    confirmedByType: varchar("confirmed_by_type", {
      length: CODE_LENGTH,
    }).$type<ConfirmedByType>(),

    confirmedById: varchar("confirmed_by_id", { length: USER_REF_LENGTH }),

    confirmationPolicy: varchar("confirmation_policy", {
      length: POLICY_LENGTH,
    }),

    confirmedAt: datetime("confirmed_at", { mode: "date", fsp: 3 }),

    startedAt: datetime("started_at", { mode: "date", fsp: 3 }),

    endedAt: datetime("ended_at", { mode: "date", fsp: 3 }),

    metadata: json("metadata")
      .$type<EntityGraphMetadata>()
      .default(sql`(JSON_OBJECT())`)
      .notNull(),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("org_entity_affiliations_public_id_uq").on(
      table.publicId
    ),
    canonicalKeyUq: uniqueIndex("org_entity_affiliations_canonical_key_uq").on(
      table.clerkOrgId,
      table.canonicalKey
    ),
    orgPersonAccountRelUq: uniqueIndex(
      "org_entity_affiliations_person_account_rel_uq"
    ).on(table.clerkOrgId, table.personId, table.accountId, table.relationship),
    personStatusIdx: index("org_entity_affiliations_person_status_idx").on(
      table.personId,
      table.status,
      table.updatedAt,
      table.id
    ),
    accountStatusIdx: index("org_entity_affiliations_account_status_idx").on(
      table.accountId,
      table.status,
      table.updatedAt,
      table.id
    ),
  })
);

export const orgEntitySourceIdentities = mysqlTable(
  "lightfast_org_entity_source_identities",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createEntitySourceIdentityId),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    provider: varchar("provider", { length: CODE_LENGTH })
      .$type<SourceIdentityProvider>()
      .notNull(),

    identityType: varchar("identity_type", { length: CODE_LENGTH })
      .$type<SourceIdentityType>()
      .notNull(),

    identityValue: text("identity_value").notNull(),

    normalizedValue: varchar("normalized_value", {
      length: KEY_LENGTH,
    }).notNull(),

    identityKey: varchar("identity_key", { length: KEY_LENGTH }).notNull(),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<EntityGraphStatus>()
      .notNull(),

    metadata: json("metadata")
      .$type<EntityGraphMetadata>()
      .default(sql`(JSON_OBJECT())`)
      .notNull(),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("org_entity_sources_public_id_uq").on(
      table.publicId
    ),
    orgIdentityKeyUq: uniqueIndex("org_entity_sources_identity_key_uq").on(
      table.clerkOrgId,
      table.identityKey
    ),
    orgProviderIdx: index("org_entity_sources_provider_idx").on(
      table.clerkOrgId,
      table.provider,
      table.identityType
    ),
  })
);

export const orgEntityObservations = mysqlTable(
  "lightfast_org_entity_observations",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createEntityObservationId),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    sourceIdentityId: bigint("source_identity_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    provider: varchar("provider", { length: CODE_LENGTH })
      .$type<SourceIdentityProvider>()
      .notNull(),

    observedAt: datetime("observed_at", { mode: "date", fsp: 3 }).notNull(),

    contentHash: varchar("content_hash", { length: HASH_LENGTH }).notNull(),

    normalizedSnapshot: json("normalized_snapshot")
      .$type<EntityGraphSnapshot>()
      .notNull(),

    rawSnapshot: json("raw_snapshot").$type<EntityGraphSnapshot | null>(),

    rawExpiresAt: datetime("raw_expires_at", { mode: "date", fsp: 3 }),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<ObservationStatus>()
      .default("active")
      .notNull(),

    supersededByObservationId: bigint("superseded_by_observation_id", {
      mode: "number",
      unsigned: true,
    }),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("org_entity_observations_public_id_uq").on(
      table.publicId
    ),
    identityHashUq: uniqueIndex("org_entity_observations_identity_hash_uq").on(
      table.sourceIdentityId,
      table.contentHash
    ),
    identityObservedIdx: index(
      "org_entity_observations_identity_observed_idx"
    ).on(table.sourceIdentityId, table.observedAt, table.id),
    orgProviderObservedIdx: index(
      "org_entity_observations_provider_observed_idx"
    ).on(table.clerkOrgId, table.provider, table.observedAt, table.id),
  })
);

export const orgEntityEvidenceItems = mysqlTable(
  "lightfast_org_entity_evidence_items",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createEntityEvidenceId),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    subjectType: varchar("subject_type", { length: CODE_LENGTH })
      .$type<EvidenceSubjectType>()
      .notNull(),

    subjectId: bigint("subject_id", {
      mode: "number",
      unsigned: true,
    }),

    claimType: varchar("claim_type", { length: CODE_LENGTH })
      .$type<EvidenceClaimType>()
      .notNull(),

    claimValue: text("claim_value").notNull(),

    sourceObservationId: bigint("source_observation_id", {
      mode: "number",
      unsigned: true,
    }),

    confidence: decimal("confidence", { precision: 5, scale: 4 })
      .$type<EntityGraphConfidence>()
      .notNull(),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<EntityGraphStatus>()
      .notNull(),

    observedAt: datetime("observed_at", { mode: "date", fsp: 3 }).notNull(),

    supersededByEvidenceId: bigint("superseded_by_evidence_id", {
      mode: "number",
      unsigned: true,
    }),

    metadata: json("metadata")
      .$type<EntityGraphMetadata>()
      .default(sql`(JSON_OBJECT())`)
      .notNull(),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("org_entity_evidence_public_id_uq").on(
      table.publicId
    ),
    subjectIdx: index("org_entity_evidence_subject_idx").on(
      table.clerkOrgId,
      table.subjectType,
      table.subjectId,
      table.claimType
    ),
    observationIdx: index("org_entity_evidence_observation_idx").on(
      table.sourceObservationId,
      table.observedAt,
      table.id
    ),
  })
);

export const orgEntityLinks = mysqlTable(
  "lightfast_org_entity_links",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createEntityLinkId),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    sourceIdentityId: bigint("source_identity_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    entityType: varchar("entity_type", { length: CODE_LENGTH })
      .$type<EntityLinkEntityType>()
      .notNull(),

    entityId: bigint("entity_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<EntityGraphStatus>()
      .notNull(),

    confidence: decimal("confidence", { precision: 5, scale: 4 })
      .$type<EntityGraphConfidence>()
      .notNull(),

    confirmedByType: varchar("confirmed_by_type", {
      length: CODE_LENGTH,
    }).$type<ConfirmedByType>(),

    confirmedById: varchar("confirmed_by_id", { length: USER_REF_LENGTH }),

    confirmationPolicy: varchar("confirmation_policy", {
      length: POLICY_LENGTH,
    }),

    confirmedAt: datetime("confirmed_at", { mode: "date", fsp: 3 }),

    createdByType: varchar("created_by_type", { length: CODE_LENGTH })
      .$type<EntityLinkCreatedByType>()
      .notNull(),

    resolverVersion: varchar("resolver_version", {
      length: RESOLVER_VERSION_LENGTH,
    }),

    supersededByLinkId: bigint("superseded_by_link_id", {
      mode: "number",
      unsigned: true,
    }),

    metadata: json("metadata")
      .$type<EntityGraphMetadata>()
      .default(sql`(JSON_OBJECT())`)
      .notNull(),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("org_entity_links_public_id_uq").on(table.publicId),
    identityEntityStatusIdx: index(
      "org_entity_links_identity_entity_status_idx"
    ).on(
      table.clerkOrgId,
      table.sourceIdentityId,
      table.entityType,
      table.status
    ),
    entityStatusIdx: index("org_entity_links_entity_status_idx").on(
      table.clerkOrgId,
      table.entityType,
      table.entityId,
      table.status
    ),
  })
);

export const orgEntityResolutionCandidateGroups = mysqlTable(
  "lightfast_org_entity_resolution_candidate_groups",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createEntityCandidateGroupId),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    candidateType: varchar("candidate_type", { length: CODE_LENGTH })
      .$type<ResolutionCandidateType>()
      .notNull(),

    candidateKey: varchar("candidate_key", { length: KEY_LENGTH }).notNull(),

    currentCandidateVersionId: bigint("current_candidate_version_id", {
      mode: "number",
      unsigned: true,
    }),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<EntityGraphStatus>()
      .notNull(),

    metadata: json("metadata")
      .$type<EntityGraphMetadata>()
      .default(sql`(JSON_OBJECT())`)
      .notNull(),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("org_entity_cand_groups_public_id_uq").on(
      table.publicId
    ),
    candidateKeyUq: uniqueIndex("org_entity_cand_groups_key_uq").on(
      table.clerkOrgId,
      table.candidateType,
      table.candidateKey
    ),
    orgStatusIdx: index("org_entity_cand_groups_status_idx").on(
      table.clerkOrgId,
      table.status,
      table.updatedAt,
      table.id
    ),
  })
);

export const orgEntityResolutionCandidateVersions = mysqlTable(
  "lightfast_org_entity_resolution_candidate_versions",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createEntityCandidateVersionId),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    candidateGroupId: bigint("candidate_group_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    resolverVersion: varchar("resolver_version", {
      length: RESOLVER_VERSION_LENGTH,
    }).notNull(),

    inputHash: varchar("input_hash", { length: HASH_LENGTH }).notNull(),

    outputHash: varchar("output_hash", { length: HASH_LENGTH }).notNull(),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<EntityGraphStatus>()
      .notNull(),

    confidence: decimal("confidence", { precision: 5, scale: 4 })
      .$type<EntityGraphConfidence>()
      .notNull(),

    outputJson: json("output_json")
      .$type<EntityGraphCandidateOutput>()
      .notNull(),

    supersededAt: datetime("superseded_at", { mode: "date", fsp: 3 }),

    metadata: json("metadata")
      .$type<EntityGraphMetadata>()
      .default(sql`(JSON_OBJECT())`)
      .notNull(),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("org_entity_cand_versions_public_id_uq").on(
      table.publicId
    ),
    groupOutputUq: uniqueIndex("org_entity_cand_versions_group_output_uq").on(
      table.candidateGroupId,
      table.outputHash
    ),
    groupCreatedIdx: index("org_entity_cand_versions_group_created_idx").on(
      table.candidateGroupId,
      table.createdAt,
      table.id
    ),
  })
);

export type EntityPerson = typeof orgEntityPeople.$inferSelect;
export type InsertEntityPerson = typeof orgEntityPeople.$inferInsert;

export type EntityAccount = typeof orgEntityAccounts.$inferSelect;
export type InsertEntityAccount = typeof orgEntityAccounts.$inferInsert;

export type EntityPersonAccountAffiliation =
  typeof orgEntityPersonAccountAffiliations.$inferSelect;
export type InsertEntityPersonAccountAffiliation =
  typeof orgEntityPersonAccountAffiliations.$inferInsert;

export type EntitySourceIdentity =
  typeof orgEntitySourceIdentities.$inferSelect;
export type InsertEntitySourceIdentity =
  typeof orgEntitySourceIdentities.$inferInsert;

export type EntityObservation = typeof orgEntityObservations.$inferSelect;
export type InsertEntityObservation = typeof orgEntityObservations.$inferInsert;

export type EntityEvidenceItem = typeof orgEntityEvidenceItems.$inferSelect;
export type InsertEntityEvidenceItem =
  typeof orgEntityEvidenceItems.$inferInsert;

export type EntityLink = typeof orgEntityLinks.$inferSelect;
export type InsertEntityLink = typeof orgEntityLinks.$inferInsert;

export type EntityResolutionCandidateGroup =
  typeof orgEntityResolutionCandidateGroups.$inferSelect;
export type InsertEntityResolutionCandidateGroup =
  typeof orgEntityResolutionCandidateGroups.$inferInsert;

export type EntityResolutionCandidateVersion =
  typeof orgEntityResolutionCandidateVersions.$inferSelect;
export type InsertEntityResolutionCandidateVersion =
  typeof orgEntityResolutionCandidateVersions.$inferInsert;
