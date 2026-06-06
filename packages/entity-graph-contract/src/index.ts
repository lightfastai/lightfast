import { z } from "zod";

export const ENTITY_GRAPH_STATUSES = [
  "possible",
  "likely",
  "confirmed",
  "conflicting",
  "rejected",
  "superseded",
] as const;
export const entityGraphStatusSchema = z.enum(ENTITY_GRAPH_STATUSES);
export type EntityGraphStatus = z.infer<typeof entityGraphStatusSchema>;

export const OBSERVATION_STATUSES = ["active", "superseded"] as const;
export const observationStatusSchema = z.enum(OBSERVATION_STATUSES);
export type ObservationStatus = z.infer<typeof observationStatusSchema>;

export const CONFIRMED_BY_TYPES = [
  "system",
  "user",
  "trusted_workflow",
] as const;
export const confirmedByTypeSchema = z.enum(CONFIRMED_BY_TYPES);
export type ConfirmedByType = z.infer<typeof confirmedByTypeSchema>;

export const ACCOUNT_TYPES = [
  "company",
  "personal_brand",
  "open_source_project",
  "community",
  "fund",
  "agency",
  "product",
  "unknown",
] as const;
export const accountTypeSchema = z.enum(ACCOUNT_TYPES);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const AFFILIATION_RELATIONSHIPS = [
  "current",
  "historical",
  "founder",
  "employee",
  "advisor",
  "investor",
  "maintainer",
  "creator",
  "owner",
  "possible",
] as const;
export const affiliationRelationshipSchema = z.enum(AFFILIATION_RELATIONSHIPS);
export type AffiliationRelationship = z.infer<
  typeof affiliationRelationshipSchema
>;

export const SOURCE_IDENTITY_PROVIDERS = [
  "x",
  "github",
  "gmail",
  "email",
  "domain",
  "website",
  "linkedin",
  "mcp",
] as const;
export const sourceIdentityProviderSchema = z.enum(SOURCE_IDENTITY_PROVIDERS);
export type SourceIdentityProvider = z.infer<
  typeof sourceIdentityProviderSchema
>;

export const SOURCE_IDENTITY_TYPES = [
  "handle",
  "email",
  "profile_url",
  "domain",
  "url",
  "org_handle",
  "provider_account_id",
] as const;
export const sourceIdentityTypeSchema = z.enum(SOURCE_IDENTITY_TYPES);
export type SourceIdentityType = z.infer<typeof sourceIdentityTypeSchema>;

export const EVIDENCE_SUBJECT_TYPES = [
  "person",
  "account",
  "affiliation",
  "source_identity",
  "candidate",
] as const;
export const evidenceSubjectTypeSchema = z.enum(EVIDENCE_SUBJECT_TYPES);
export type EvidenceSubjectType = z.infer<typeof evidenceSubjectTypeSchema>;

export const EVIDENCE_CLAIM_TYPES = [
  "name",
  "domain",
  "role",
  "affiliation",
  "cross_link",
  "location",
  "website",
  "account_type",
  "relationship",
] as const;
export const evidenceClaimTypeSchema = z.enum(EVIDENCE_CLAIM_TYPES);
export type EvidenceClaimType = z.infer<typeof evidenceClaimTypeSchema>;

export const ENTITY_LINK_ENTITY_TYPES = ["person", "account"] as const;
export const entityLinkEntityTypeSchema = z.enum(ENTITY_LINK_ENTITY_TYPES);
export type EntityLinkEntityType = z.infer<typeof entityLinkEntityTypeSchema>;

export const ENTITY_LINK_CREATED_BY_TYPES = [
  "resolver",
  "system",
  "user",
  "trusted_workflow",
] as const;
export const entityLinkCreatedByTypeSchema = z.enum(
  ENTITY_LINK_CREATED_BY_TYPES
);
export type EntityLinkCreatedByType = z.infer<
  typeof entityLinkCreatedByTypeSchema
>;

export const RESOLUTION_CANDIDATE_TYPES = [
  "person",
  "account",
  "affiliation",
  "source_link",
] as const;
export const resolutionCandidateTypeSchema = z.enum(RESOLUTION_CANDIDATE_TYPES);
export type ResolutionCandidateType = z.infer<
  typeof resolutionCandidateTypeSchema
>;
