# Local Entity Enrichment Core Design

**Date:** 2026-06-06
**Status:** Approved for initial local implementation

## Summary

Lightfast will add a local, fixture-driven entity enrichment core for X and
GitHub identities. The first version does not call live APIs, mutate CRM data,
or discover net-new leads. It takes normalized snapshots from connector tools,
MCP experiments, or checked-in fixtures and produces inspectable Person and
Business candidates with evidence, confidence, and lifecycle status.

This creates the substrate for future enrichment jobs and discovery features
without committing the product to one provider, prompt, or database schema.

## Goals

- Model X and GitHub profile snapshots as source observations.
- Normalize durable source identities such as X handles, GitHub handles,
  website URLs, domains, and GitHub org handles.
- Extract conservative person and business signals from profile fields.
- Resolve cross-source person candidates when there is explicit evidence, such
  as GitHub `twitterUsername` matching an observed X username.
- Produce evidence-backed candidate records with statuses:
  `confirmed`, `likely`, `possible`, `conflicting`, and `rejected`.
- Keep the resolver deterministic and local so fixtures can be used to tune
  scoring and extraction behavior.
- Avoid production connector, OAuth, database, and UI work in this slice.

## Non-Goals

- No Gmail ingestion.
- No live X, GitHub, Exa, or LLM calls.
- No database schema migration.
- No lead recommendation UX.
- No auto-merge into `orgPeople`.
- No attempt to parse every possible biography phrase.

## Architecture

Create `@repo/entity-resolution` as a TypeScript leaf package. It owns schemas,
normalization helpers, evidence types, and a deterministic resolver.

Input:

```ts
type EntityObservation =
  | XProfileObservation
  | GitHubProfileObservation;
```

Output:

```ts
interface EntityResolutionResult {
  people: ResolvedPersonCandidate[];
  businesses: ResolvedBusinessCandidate[];
}
```

The resolver runs these stages:

1. Validate and normalize observations.
2. Emit source identities for handles, profile URLs, websites, domains, and
   GitHub organizations.
3. Extract person claims from names, handles, bios, locations, URLs, and
   provider-specific links.
4. Extract business claims from GitHub company fields, X bios, and profile
   URLs.
5. Merge X and GitHub observations only when deterministic evidence supports
   the link.
6. Score candidates from evidence strength.
7. Assign lifecycle status from score and conflict state.

## Status Semantics

- `confirmed`: Reserved for explicit confirmation by a user or a future trusted
  system. The local resolver exposes the status but does not assign it by
  default.
- `likely`: Strong machine evidence. Safe to show as enriched, but not as
  user-confirmed truth.
- `possible`: Weak evidence. Useful as a suggestion.
- `conflicting`: Strong evidence exists, but observed facts disagree in a way
  that should block automatic merge or promotion.
- `rejected`: A candidate was explicitly ruled out. The local resolver exposes
  the status for future overrides but does not assign it by default.

## Scoring

Initial scoring is intentionally simple:

- Observed provider identity: baseline evidence.
- Explicit cross-link, such as GitHub `twitterUsername` matching X username:
  strong evidence.
- Shared domain/profile URL: strong business evidence.
- Matching person display names: supporting evidence.
- GitHub company and X bio company match: supporting affiliation evidence.
- Disagreeing strong business affiliations: conflict.

The package should make evidence visible instead of hiding decisions inside a
single score.

## Testing

Tests should cover:

- Status vocabulary and score-to-status behavior.
- Normalization of X/GitHub handles and profile URLs.
- A merged X and GitHub profile with explicit cross-link evidence.
- A conflicting affiliation case.
- A single-source GitHub profile that remains a possible person candidate.

## Future Work

- Add Exa-backed enrichment providers behind interfaces.
- Add fixture snapshot import/export helpers for MCP-driven research.
- Persist evidence graph records in `db/app`.
- Feed canonical candidates into the existing `orgPeople` persistence layer.
- Add discovery ranking for net-new people and businesses.
