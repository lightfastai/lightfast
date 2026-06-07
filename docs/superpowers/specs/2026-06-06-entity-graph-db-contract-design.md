# Entity Graph DB Contract Design

**Date:** 2026-06-06
**Status:** Drafted from grill-me decisions

## Summary

Lightfast will introduce an org-scoped entity graph for CRM-style people and
external accounts. The graph separates canonical truth from source identities,
observations, evidence, resolver candidates, and reversible links.

The model intentionally uses `accounts` instead of `companies` or
`organizations`. `organizations` conflicts with Lightfast and Clerk tenant
language, while `companies` is too narrow for open-source projects,
communities, funds, agencies, products, and personal brands. The product UI may
still say "Companies" for company-like account views.

## Context

The current `lightfast_org_people` table is identity-centric. It stores one
durable identity per row and works for people extracted from signals, but it is
not enough for evidence-backed enrichment:

- one person can have many source identities
- one source identity can be proposed, rejected, superseded, or confirmed
- one person can have multiple current or historical account affiliations
- accounts can exist before a canonical person exists
- weak observations should remain candidates instead of polluting canonical
  People or Accounts
- resolver output needs versioned auditability while tuning local rules

The local `@repo/entity-resolution` package already models source identities,
evidence, candidates, statuses, conflicts, and current/historical
affiliations. This design turns those concepts into a DB contract.

## Resolved Decisions

- Canonical People and Accounts are scoped by `clerk_org_id`.
- Durable source identities and normalized observations are persisted even when
  no canonical entity is created.
- Canonical People and Accounts are created automatically only from `likely`,
  `confirmed`, or system-confirmed resolver output.
- `possible` stays candidate-only.
- `confirmed` may be assigned by the system at extreme confidence, but every
  confirmation records `confirmed_by_type`, `confirmation_policy`, and
  `confirmed_at`.
- `confirmed` state applies separately to canonical entities, source identity
  links, and affiliations.
- Observations, evidence, and candidate versions are append-only. Supersession
  is explicit.
- Raw provider snapshots are retained only temporarily or behind a retention
  policy. Normalized observations and evidence are durable.
- Resolver candidates are persisted separately from canonical People/Accounts.
- Candidate groups have deterministic keys; candidate versions are append-only
  when meaningful output changes.
- Source identity links and auto-merges are reversible through explicit link
  rows.
- One source identity can have at most one active canonical Person/Account link
  per org; rejected and superseded history is allowed.
- A Person can have multiple current account affiliations.
- Personal brands, open-source projects, communities, products, agencies, and
  funds are Accounts with `account_type`.

## Goals

- Introduce canonical `people`, `accounts`, and
  `person_account_affiliations`.
- Introduce durable source/evidence tables for `source_identities`,
  `entity_observations`, and `evidence_items`.
- Introduce reversible link/audit tables for `entity_links`,
  `resolution_candidate_groups`, and `resolution_candidate_versions`.
- Keep the schema compatible with existing DB conventions: scope-first table
  names, `clerk_org_id`, unsigned bigint primary keys, prefixed public ids,
  `datetime(3)` timestamps, and no SQL foreign keys.
- Keep the existing `lightfast_org_people` table untouched in the first slice.
- Make the first implementation useful for local simulated resolver output
  before wiring live X/GitHub/Gmail ingestion.

## Non-Goals

- No Gmail ingestion in this slice.
- No live X/GitHub/Exa enrichment in this slice.
- No final CRM UI in this slice.
- No migration or removal of current `lightfast_org_people` in this slice.
- No global cross-customer entity graph.
- No SQL foreign keys.
- No manual SQL migration files.

## Naming

Use tenant language only for Lightfast customer workspaces:

```text
clerk_org_id
lightfast_orgs
```

Use CRM graph language for external entities:

```text
people
accounts
person_account_affiliations
```

Use source/evidence language for provider facts:

```text
source_identities
entity_observations
evidence_items
entity_links
resolution_candidate_groups
resolution_candidate_versions
```

## Status Model

The shared status vocabulary is:

```text
possible
likely
confirmed
conflicting
rejected
superseded
```

Status semantics:

- `possible`: weak machine candidate; do not auto-create canonical entities.
- `likely`: strong machine belief; canonical records may be created.
- `confirmed`: accepted by user, trusted workflow, or named system policy.
- `conflicting`: blocked because strong claims disagree.
- `rejected`: suppressed by user, trusted workflow, or deterministic rule.
- `superseded`: replaced by a newer observation, evidence item, link, or
  candidate version.

Confirmation metadata:

```text
confirmed_by_type: system | user | trusted_workflow
confirmed_by_id: string or null
confirmation_policy: string or null
confirmed_at: timestamp or null
```

System confirmation requires a named policy such as:

```text
x_github_crosslink_domain_match_v1
```

## Core Tables

### `lightfast_org_entity_people`

Canonical external people for one Lightfast org.

Key fields:

- `public_id`: prefixed `person_` id.
- `clerk_org_id`: tenant key.
- `display_name`: best current display name.
- `status`: current canonical entity status.
- `confidence`: current aggregate confidence.
- `primary_source_identity_id`: optional bigint id cache.
- `metadata`: JSON for non-indexed display attributes.
- confirmation fields.

Canonical People do not store a single hard company field. Account
affiliations live in `lightfast_org_entity_person_account_affiliations`.

### `lightfast_org_entity_accounts`

Canonical external accounts for one Lightfast org.

Key fields:

- `public_id`: prefixed `acct_` id.
- `clerk_org_id`: tenant key.
- `display_name`: best current display name.
- `normalized_name`: normalized display name for matching.
- `account_type`: `company`, `personal_brand`, `open_source_project`,
  `community`, `fund`, `agency`, `product`, or `unknown`.
- `primary_domain`: nullable domain cache.
- `status`: current canonical account status.
- `confidence`: current aggregate confidence.
- confirmation fields.
- `metadata`: JSON for display attributes and non-indexed enrichment.

### `lightfast_org_entity_person_account_affiliations`

Canonical relationship between a Person and an Account.

Key fields:

- `public_id`: prefixed `aff_` id.
- `clerk_org_id`: tenant key.
- `person_id`: bigint id of canonical person.
- `account_id`: bigint id of canonical account.
- `relationship`: `current`, `historical`, `founder`, `employee`, `advisor`,
  `investor`, `maintainer`, `creator`, `owner`, or `possible`.
- `is_primary`: boolean.
- `title`: nullable role/title.
- `status`: relationship status.
- `confidence`: relationship confidence.
- confirmation fields.
- `started_at`, `ended_at`: optional dates when known.

The first slice uses bigint references without SQL foreign keys, matching the
repo schema convention.

## Source And Evidence Tables

### `lightfast_org_entity_source_identities`

Durable source identities observed from providers.

Persist identities such as:

- email address
- domain
- website URL
- X handle
- GitHub username
- GitHub org handle
- LinkedIn profile URL
- MCP/provider account id

Do not persist free-text display names, titles, locations, or company names as
source identities. Those are evidence claims.

Key fields:

- `public_id`: prefixed `sid_` id.
- `clerk_org_id`: tenant key.
- `provider`: `x`, `github`, `gmail`, `email`, `domain`, `website`,
  `linkedin`, or `mcp`.
- `identity_type`: `handle`, `email`, `profile_url`, `domain`, `url`,
  `org_handle`, or `provider_account_id`.
- `identity_value`: original value.
- `normalized_value`: normalized value.
- `identity_key`: deterministic key such as `x:handle:ava_ai`.
- `status`: source identity status.
- `metadata`: JSON.

Unique index:

```text
clerk_org_id + identity_key
```

### `lightfast_org_entity_observations`

Normalized source snapshots. Raw snapshots are optional and retention-controlled.

Key fields:

- `public_id`: prefixed `obs_` id.
- `clerk_org_id`: tenant key.
- `source_identity_id`: observed identity.
- `provider`: provider that produced the observation.
- `observed_at`: when the provider state was observed.
- `content_hash`: hash of normalized snapshot.
- `normalized_snapshot`: durable JSON.
- `raw_snapshot`: nullable JSON, retained only under policy.
- `raw_expires_at`: nullable timestamp.
- `status`: `active` or `superseded`.
- `superseded_by_observation_id`: nullable bigint id.

Exact duplicate observations may be deduped by `content_hash` and
`source_identity_id`, but meaningful changes create append-only rows.

### `lightfast_org_entity_evidence_items`

Append-only claims extracted from observations or resolver output.

Key fields:

- `public_id`: prefixed `evi_` id.
- `clerk_org_id`: tenant key.
- `subject_type`: `person`, `account`, `affiliation`, `source_identity`, or
  `candidate`.
- `subject_id`: nullable bigint id.
- `claim_type`: `name`, `domain`, `role`, `affiliation`, `cross_link`,
  `location`, `website`, `account_type`, or `relationship`.
- `claim_value`: text value.
- `source_observation_id`: nullable bigint id.
- `confidence`: claim confidence.
- `status`: evidence status.
- `observed_at`: timestamp.
- `superseded_by_evidence_id`: nullable bigint id.
- `metadata`: JSON.

Evidence is never destructively updated. New evidence supersedes old evidence.

## Link And Candidate Tables

### `lightfast_org_entity_links`

Reversible links between source identities and canonical entities.

Key fields:

- `public_id`: prefixed `link_` id.
- `clerk_org_id`: tenant key.
- `source_identity_id`: source identity bigint id.
- `entity_type`: `person` or `account`.
- `entity_id`: canonical entity bigint id.
- `status`: `possible`, `likely`, `confirmed`, `rejected`, or `superseded`.
- `confidence`: link confidence.
- confirmation fields.
- `created_by_type`: `resolver`, `system`, `user`, or `trusted_workflow`.
- `resolver_version`: nullable string.
- `superseded_by_link_id`: nullable bigint id.
- `metadata`: JSON.

Application logic enforces at most one active non-rejected link per
`clerk_org_id`, `source_identity_id`, and `entity_type`.

### `lightfast_org_entity_resolution_candidate_groups`

Stable group for one deterministic candidate key.

Key fields:

- `public_id`: prefixed `candgrp_` id.
- `clerk_org_id`: tenant key.
- `candidate_type`: `person`, `account`, `affiliation`, or `source_link`.
- `candidate_key`: deterministic key from stable identities/domains/names.
- `current_candidate_version_id`: nullable bigint id.
- `status`: current group status.

Unique index:

```text
clerk_org_id + candidate_type + candidate_key
```

### `lightfast_org_entity_resolution_candidate_versions`

Append-only resolver output versions.

Key fields:

- `public_id`: prefixed `candver_` id.
- `clerk_org_id`: tenant key.
- `candidate_group_id`: bigint id.
- `resolver_version`: string.
- `input_hash`: hash of resolver input.
- `output_hash`: hash of normalized output.
- `status`: candidate status.
- `confidence`: candidate confidence.
- `output_json`: resolver candidate payload.
- `superseded_at`: nullable timestamp.
- `created_at`: timestamp.

Meaningful resolver output changes create a new version. Unchanged output may
reuse the current version.

## Candidate Keys

Candidate keys must be deterministic:

```text
person:x:handle:ava_ai|github:handle:avachen
source_link:x:handle:ava_ai->person:<id-or-candidate-key>
account:domain:acme.com
account:name:acme:no-domain
affiliation:<person-key>:<account-key>:current
```

Rules:

- If a candidate has source identities, sort and join source identity keys.
- If an account has a domain, use the normalized domain.
- If an account lacks a domain, use normalized name.
- If an affiliation lacks canonical ids, use candidate keys.

## Auto-Creation Rules

The first slice should encode policy boundaries without implementing full
workflow automation:

- `possible`: persist candidate only.
- `likely`: may create canonical person/account/link/affiliation.
- `confirmed`: may create canonical records and mark confirmation metadata.
- `conflicting`: persist candidate; do not auto-create or auto-link.
- `rejected`: suppress candidate and links.

System-confirmed policy examples:

- `x_github_exact_crosslink_domain_match_v1`
- `email_domain_signature_company_match_v1`

The first implementation may define policy names and fields without executing
system confirmation yet.

## Migration Strategy

Do not mutate or remove `lightfast_org_people` in the first slice.

First slice:

1. Add contract package for shared status/type enums.
2. Add new DB tables and generated migration.
3. Add DB utility functions for source identities, observations, candidate
   groups, candidate versions, and canonical entity upserts.
4. Add adapter tests that can persist output from the simulated
   `@repo/entity-resolution` fixture.

Later migration:

- Backfill `lightfast_org_people` into `source_identities` and candidate
  groups.
- Introduce read APIs over the new canonical graph.
- Gradually move People UI from identity rows to canonical People.

## Open Design Notes

- Raw snapshot retention duration is not fixed in this spec. The first
  implementation should make raw snapshots nullable and support `raw_expires_at`.
- Gmail-specific privacy rules are out of scope, but this design keeps raw
  snapshots optional so Gmail can use normalized-only storage later.
- SQL foreign keys are intentionally omitted to match current DB conventions.
