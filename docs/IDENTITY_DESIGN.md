# IDENTITY DESIGN — Multi‑Account Users and Graph Persons

Last Updated: 2025-10-27

Scope: Define how a human user with multiple provider accounts (GitHub, Linear, Notion, Slack, SSO) maps to a single Person entity per workspace in the Memory Graph. Provide schema (PlanetScale), matching rules, connector integration, APIs, and evaluation/rollout.

---

## Goals

- Separate login identity (Auth User) from graph identity (Person in Memory) per workspace.
- Deterministic, high‑precision mapping from provider identities to Person via alias tables.
- Safe merges/splits with audit; no cross‑tenant leakage.
- First‑class support for SSO/SCIM provisioning of users and groups.

---

## Data Model (PlanetScale/MySQL)

```sql
-- App-level users (login identity)
CREATE TABLE users (
  id              varchar(40) PRIMARY KEY,
  primary_email   varchar(255) NULL,
  created_at      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_primary_email (primary_email)
);

-- Linked identities (IdPs and product accounts)
CREATE TABLE user_identities (
  id                 varchar(40) PRIMARY KEY,
  user_id            varchar(40) NOT NULL,
  provider           varchar(32) NOT NULL,  -- google|okta|github|slack|linear|notion|microsoft|saml
  provider_user_id   varchar(255) NOT NULL, -- stable subject/id from provider
  email              varchar(255) NULL,
  email_verified     tinyint(1) NOT NULL DEFAULT 0,
  metadata_json      json NOT NULL,
  created_at         timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_provider_subject (provider, provider_user_id),
  INDEX idx_uid_user (user_id)
);

-- Workspace membership and roles for app users
CREATE TABLE workspace_users (
  id              varchar(40) PRIMARY KEY,
  workspace_id    varchar(40) NOT NULL,
  user_id         varchar(40) NOT NULL,
  role            varchar(16) NOT NULL, -- admin|editor|viewer
  created_at      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_ws_user (workspace_id, user_id)
);

-- Map an app user to a graph Person entity within a workspace
CREATE TABLE workspace_person_map (
  id                varchar(40) PRIMARY KEY,
  workspace_id      varchar(40) NOT NULL,
  user_id           varchar(40) NOT NULL,
  person_entity_id  varchar(40) NOT NULL,
  created_at        timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_ws_user_map (workspace_id, user_id),
  UNIQUE KEY uniq_ws_person_map (workspace_id, person_entity_id)
);
```

Alias coverage (extends Memory Graph)
- Use existing `entity_aliases` with new `alias_type` values (workspace‑scoped, unique):
  - email, github_id, github_login, slack_user_id, slack_email, linear_user_id, notion_user_id,
    google_sub, microsoft_sub, okta_user_id, saml_nameid, app_user_id, canonical_name, domain
- Constraint: UNIQUE (workspace_id, alias_type, value)

---

## Matching & Resolution

Deterministic‑first matching order (per workspace):
1) provider_user_id exact match (e.g., github_id, slack_user_id)
2) verified email exact match (email or slack_email)
3) strong multi‑signal: same domain email + same display name/handle across ≥2 providers

If no match → create a new Person entity and add aliases from hints. Never overwrite deterministic aliases; add new ones over time.

Merges are never automatic unless confidence ≥0.98 from fully deterministic cross‑provider keys.

---

## Connector Integration

On every event (PR/issue/message/page):
- Extract identity hints: provider_user_id, email, handle, provider, source URL.
- Call `resolvePerson(workspaceId, hints)` to get `person_entity_id`.
- Use the person in edges: AUTHORED_BY, ASSIGNED_TO, MEMBER_OF; add `document_entities` rows linking docs to the person.
- Upsert aliases when new provider IDs are observed.

---

## APIs (Sketch)

```typescript
// Hints gathered from connectors or UI
interface IdentityHints {
  provider?: 'github' | 'slack' | 'linear' | 'notion' | 'google' | 'microsoft' | 'okta' | 'saml';
  providerUserId?: string;
  email?: string;
  handle?: string; // e.g., github login, slack handle
  displayName?: string;
}

// Resolve or create a Person entity for a workspace
export async function resolvePerson(
  workspaceId: string,
  hints: IdentityHints,
): Promise<{ personEntityId: string; matchedBy: 'provider_id' | 'email' | 'multi_signal' | 'created'; addedAliases?: string[] }>; 

// Link a new identity to an app user and optional workspace person
export async function linkIdentity(
  userId: string,
  identity: { provider: string; providerUserId: string; email?: string; emailVerified?: boolean },
  workspaceId?: string,
): Promise<void>;

// Admin: merge two Person entities (moves aliases and edges; writes audit)
export async function mergePersons(
  workspaceId: string,
  fromPersonId: string,
  intoPersonId: string,
  reason: string,
): Promise<void>;

// Admin: split some aliases into a new Person entity
export async function splitPerson(
  workspaceId: string,
  personId: string,
  aliasIdsToMove: string[],
  reason: string,
): Promise<{ newPersonEntityId: string }>;
```

Cache
- Redis alias lookups: `alias:{ws}:{type}:{value} → person_id` (short TTL, write‑through)
- Warm per‑workspace maps on SCIM sync and after connector runs

---

## SSO/SCIM Provisioning

- SSO: OIDC/SAML for login; store subject as user_identity (google_sub/okta_user_id/saml_nameid)
- SCIM: provision users into `workspace_users`; provision groups as Team entities, create MEMBER_OF edges
- Map SSO identities into `entity_aliases` (alias_type = app_user_id or provider subject) when linking to a workspace person

---

## Evaluation & Observability

Metrics
- Resolution precision/recall on a labeled set (per provider)
- Coverage: % artifacts with resolved authors/assignees
- Merge accuracy: % auto‑merges confirmed; review queue size/latency
- Drift: rename/handle changes reconciled within SLA (e.g., 24h)

Logs
- resolvePerson decisions (signals used), merges/splits with reasons, conflicts on alias uniqueness

---

## Rollout

- Phase A: Deterministic mapping + connector wiring; admin backfill job to enrich aliases
- Phase B: SSO/SCIM integration + group → team mapping
- Phase C: Admin UI for People (merge/split) + audits
- Phase D: Heuristic/LLM suggestions under review queue; never downgrade deterministic matches

---

## Security & Privacy

- Workspace RLS for all tables; no cross‑workspace matching
- Redaction on export; support “forget” for personal conversation memories
- Mark bots/service accounts as non‑person entities to avoid ownership confusion

---

## References

- Memory Graph aliasing and person entities: `docs/memory/GRAPH.md`
- Research‑mode rollout and acceptance: `docs/memory/SPEC.md`

