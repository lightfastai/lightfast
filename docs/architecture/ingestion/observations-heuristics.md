---
title: Observations Heuristics — High‑Signal Extraction
description: What to extract, multi-view construction, importance scoring, privacy and dedupe
status: working
owner: platform-ingest
audience: engineering
last_updated: 2025-10-28
tags: [ingestion, observations]
---

# Observations Heuristics — High‑Signal Extraction

Last Updated: 2025-10-28

Observations are atomic, high‑signal “moments” captured from source systems to power Neural Memory. This guide defines what to extract, how to craft multi‑view text (title/body/summary), how to score importance, and how to handle privacy and deduplication.

---

## Anatomy of an Observation

- Required fields
  - text (body): normalized core content
  - occurredAt: source event time
  - importance: float [0..1]
  - embeddingModel/embeddingVersion: for vector namespaces
  - contentHash: deterministic hash of normalized body (+ salient metadata)
- Optional fields
  - title: concise headline for retrieval (≤120 chars)
  - summary: distilled 1–3 sentence gist (≤320 chars)
  - tags: string[] taxonomy (e.g., incident, release, decision, goal, owner)
  - subjectRefs: references to entities/messages (resolved later)
  - privacy: org|private (defaults to org; see Privacy)

Multi‑view embeddings
- Embed body (always), title (when present), summary (when present) with document role.
- Keep views concise and de‑duplicated to avoid semantic redundancy.

---

## Source‑Specific Extraction

GitHub — Pull Request
- Extract
  - PR title (title view)
  - First paragraph of description or “Summary/Changelog” section (body)
  - “This PR …”, “Fixes #123/Resolves …” lines (body)
  - Optional: generate a summary view if description ≥500 chars
- Tags
  - release, refactor, incident‑fix, breaking‑change
- SubjectRefs
  - repo url, codeowners (OWNED_BY), referenced issue IDs, touched components (paths → component map)

GitHub — Issue/Discussion
- Extract
  - Issue title (title)
  - First paragraph / acceptance criteria (body)
  - “Decision:” or “Resolution:” markers from comments (body)
- Tags: bug, incident, decision, rfc
- SubjectRefs: repo url, assignee, labels → goal/project when present

Linear — Ticket/Project
- Extract
  - Title (title)
  - Description first paragraph (body)
  - Status change to “Done/Cancelled” with final note (body)
- Tags: objective, initiative, blocked, dependency
- SubjectRefs: team, assignee, project

Notion — Page/Doc
- Extract
  - Page title (title)
  - First section summary or TL;DR callout (body)
  - “Decision/Outcome” sections (body)
- Tags: rfc, decision, goal, policy
- SubjectRefs: author, page URL, related database relations

Slack — Message/Thread
- Extract
  - First message of a thread with clear outcome (“Decision: …”, incident summary)
  - Skip trivial reactions/bots; avoid ephemeral noise
- Privacy: default private for DMs and restricted channels
- Tags: incident, handoff, decision
- SubjectRefs: channel id, mentioned entities

---

## Importance Scoring (0..1)

Formula (example)

```
importance = clamp01(
  base(source,type)
  + 0.25 * feature(severity|labels)
  + 0.20 * feature(discussion_volume)
  + 0.20 * feature(reviewers|participants)
  + 0.15 * feature(linked_incident|release)
  + 0.10 * feature(org_impact)
)
```

Heuristics by source
- GitHub: add weight for “Fixes/Resolves”, many reviewers, large diff, labels (security/incident)
- Linear: add weight for blockers/dependencies, high priority/severity
- Notion: add weight for “Decision/Outcome”, policy/goal pages
- Slack: add weight for long threads with “Decision:”/“Summary:” and incident channels

Recency bias is applied at retrieval time (wr term), not baked into importance.

---

## Deduplication & Updates

- contentHash = hash(normalized body + key metadata)
- UNIQUE(workspaceId, contentHash) prevents duplicates
- When upstream content changes significantly (hash delta), write a new observation
- Minor updates should update tags/subjectRefs rather than rewriting body

---

## Privacy & Redaction

- Default privacy
  - GitHub/Linear/Notion: org
  - Slack DM and restricted channels: private
- Redaction
  - On write, apply PII redaction if configured (emails, phone, tokens)
  - Store unredacted raw only in S3 with restricted ACLs when necessary
- Access
  - Observations marked private are excluded from cross‑workspace scopes; retrieval respects workspace + privacy

---

## Tags & SubjectRefs

- Tags taxonomy (suggested): incident, decision, rfc, release, owner, dependency, goal, policy, handoff
- SubjectRefs format (example)

```json
[
  { "kind": "entity", "id": "team_billing" },
  { "kind": "repo", "url": "https://github.com/acme/billing" },
  { "kind": "issue", "source": "github", "id": "123" }
]
```

Entity resolution occurs later using `entity_aliases` and deterministic rules.

---

## Summaries & Profiles (Consolidation)

- Nightly jobs cluster observations by entity/topic/time to produce `memory_summaries` (short text + embeddings + coverage)
- Profiles compute per‑entity centroids from observations/summaries; used to bias retrieval
- Track drift and coverage; rebuild on thresholds or schedule

---

## Quality Checklist

- Titles are ≤120 chars and informative
- Summaries are ≤320 chars, complete sentences, and faithful to body
- Importance present and within [0..1]
- contentHash computed and stable for identical content
- Privacy set correctly; DMs/private channels not leaked

---

## References

- ../ingestion/sync-design.md
- ../../architecture/storage/implementation-guide.md
- ../retrieval/search-design.md
- ../../architecture/memory/graph.md
