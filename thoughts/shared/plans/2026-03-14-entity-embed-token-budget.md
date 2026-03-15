# Entity Embed Token Budget Implementation Plan

## Overview

Fix silent Cohere token truncation in `entity-embed.ts`. Cohere `embed-english-v3.0` has a
512-token context window. The current narrative can reach ~725 tokens (identity + genesis +
temporal span + 3 events + 10 edges). No `truncate` parameter is passed to the Cohere SDK, so the
API silently discards tokens from the **tail** of the narrative string — meaning graph edges (the
last section) are the first to be lost with no error, no log, and no visibility.

The fix is two-phased:

1. **Phase 1 — Explicit token budget**: Reduce the graph edge DB fetch from `LIMIT 10` → `LIMIT 3`,
   update the defensive slice in `narrative-builder.ts` to match, add a hard narrative cap of
   `1,800 chars` before the embed step (≈ 450 tokens, leaving a 62-token safety buffer under the
   512-token ceiling), and add comments explaining the 512-token rationale throughout.

2. **Phase 2 — Surface errors explicitly**: Add `truncate: "NONE"` to the Cohere SDK call in
   `vendor/embed/src/provider/cohere.ts` so that if the cap ever fails to hold — due to unbounded
   `entity.value` or `entity.key` in Section 1 — Cohere throws an error instead of silently
   truncating.

---

## Current State Analysis

| File | Relevant lines | Current behaviour |
|---|---|---|
| `entity-embed.ts` | `:132` | `LIMIT 10` on graph edge query |
| `entity-embed.ts` | `:152-158` | narrative passed to embed with no length cap |
| `entity-embed.ts` | `:162-178` | `embed([narrative])` — full string, no preprocessing |
| `narrative-builder.ts` | `:72` | `edges.slice(0, 10)` — defensive guard matches old DB limit |
| `vendor/embed/src/provider/cohere.ts` | `:111-116` | SDK call has no `truncate` param; Cohere default is `"END"` (silent tail cut) |

**Realistic max narrative length today**: ~2,900 chars ≈ ~725 tokens (10 edges × ~180 chars each).
After Phase 1 (3 edges): ~1,360 chars ≈ ~340 tokens — well within the 512-token limit.
The 1,800-char cap is defence-in-depth for any unexpected growth in Section 1 (`entity.value`).

---

## Desired End State

After this plan:
- Max narrative fed to Cohere is **≤ 1,800 chars (≈ 450 tokens)** — enforced by the cap in
  `entity-embed.ts` before the embed step
- Graph edge DB fetch is **`LIMIT 3`** — reducing the realistic max to ~340 tokens
- `narrative-builder.ts` `slice` guard is **`slice(0, 3)`** — consistent with the DB limit
- `vendor/embed/src/provider/cohere.ts` passes **`truncate: "NONE"`** — Cohere throws an error
  if the cap somehow fails, making the failure visible in Inngest retries and Sentry
- **Comments** in `entity-embed.ts`, `narrative-builder.ts`, and `cohere.ts` explain the
  512-token limit, section ordering rationale, and why the cap exists — so future engineers do
  not silently revert these constraints

### Verification

`pnpm check && pnpm typecheck`

No runtime/integration test changes required — these files have no unit tests today. Manual
verification is confirming that entity embed Inngest runs succeed and entity vectors appear in
Pinecone after a test event is processed.

---

## What We're NOT Doing

- **No chunking (multi-vector per entity)**: The architecture is intentionally one vector per
  entity. Chunking would require chunk-indexed IDs, dedup in search, and schema changes — out of
  scope.
- **No token-counting pre-flight**: We are not importing a tokeniser to count tokens before the
  embed call. The char cap is a simpler, dependency-free approximation (4 chars/token for English
  text from Cohere docs).
- **No change to `inputType`**: `search_document` is correct for entity indexing — unchanged.
- **No change to edge query columns**: The `relationshipType`, `targetCategory`, `targetKey`
  columns fetched remain the same; only the row count changes (10 → 3).

---

## Implementation Approach

Phase 1 first, Phase 2 second. Phase 1 ensures we are within budget before Phase 2 makes
over-budget an explicit error. Deploying Phase 2 before Phase 1 would cause Inngest failures for
any entity whose narrative currently exceeds 512 tokens.

---

## Phase 1: Explicit Token Budget

### Overview

Reduce the edge fetch to 3 rows, add the narrative char cap before the embed call, update the
defensive slice in `narrative-builder.ts` to match, and add explanatory comments in all three
files.

### Changes Required

#### 1. `entity-embed.ts` — edge LIMIT + narrative cap + comments

**File**: `api/console/src/inngest/workflow/neural/entity-embed.ts`

**Change 1** — Add a module-level constant for the narrative char cap above the function
definition. Insert after the imports (after line 27):

```ts
/**
 * Hard character cap applied to the narrative before embedding.
 *
 * Cohere embed-english-v3.0 has a 512-token context window. English text
 * averages ~4 chars/token, so 512 tokens ≈ 2,048 chars. We cap at 1,800
 * (≈ 450 tokens) to leave a 62-token safety buffer and accommodate any
 * non-English content in entity keys or values.
 *
 * The narrative sections are ordered most-important-first (identity →
 * genesis → temporal span → recent events → graph edges), so if the cap
 * ever fires, it discards from the least-important tail.
 *
 * @see vendor/embed/src/provider/cohere.ts — truncate: "NONE" will surface
 * an error if this cap fails to hold (e.g. a very long entity.value in
 * Section 1).
 */
const NARRATIVE_CHAR_CAP = 1_800;
```

**Change 2** — Add a comment to the edge query (currently at line 119-132) explaining why
the limit is 3:

```ts
// Graph edges with target entity details.
// LIMIT 3 (not 10): each edge line is ~180 chars / ~45 tokens.
// 10 edges ≈ 450 tokens alone — would push the narrative over Cohere's
// 512-token limit. 3 edges ≈ 135 tokens, leaving budget for all other
// sections. See NARRATIVE_CHAR_CAP for the full token budget reasoning.
db
  .select({ ... })
  .from(workspaceEdges)
  ...
  .limit(3),  // ← was 10
```

**Change 3** — Cap the narrative before the embed step. Between the `narrativeHash` call and the
`embed-narrative` step, replace the bare `narrative` reference:

```ts
// Cap the narrative to NARRATIVE_CHAR_CAP characters before embedding.
// Sections are ordered most-important-first; the cap discards from the tail.
// truncate: "NONE" in the Cohere provider will surface an error if this cap
// ever fails to hold (e.g. an unusually long entity.value in Section 1).
const cappedNarrative = narrative.slice(0, NARRATIVE_CHAR_CAP);
```

Then in the `embed-narrative` step, pass `cappedNarrative` instead of `narrative`:

```ts
const { embeddings } = await embeddingProvider.embed([cappedNarrative]);
```

#### 2. `narrative-builder.ts` — update defensive slice + add comment block

**File**: `api/console/src/inngest/workflow/neural/narrative-builder.ts`

**Change 1** — Replace `edges.slice(0, 10)` at line 72 with `edges.slice(0, 3)` and update the
surrounding comment:

```ts
// ── Related entities (from graph edges)
// slice(0, 3): matches the LIMIT 3 in entity-embed.ts fetch-narrative-inputs.
// Keeping this guard consistent with the DB limit prevents accidental
// over-embedding if this function is called from other contexts in future.
if (edges.length > 0) {
  const edgeLines = edges
    .slice(0, 3)  // ← was slice(0, 10)
    .map(
      (e) => `  ${e.relationshipType} → ${e.targetCategory} ${e.targetKey}`
    );
  sections.push(`Related:\n${edgeLines.join("\n")}`);
}
```

**Change 2** — Add a comment block to `buildEntityNarrative` explaining section ordering and the
token budget (insert above the `const sections: string[] = []` line at ~37):

```ts
// Narrative section order is intentional and must not be changed without
// revisiting the NARRATIVE_CHAR_CAP in entity-embed.ts.
//
// Cohere embed-english-v3.0 has a 512-token context window (≈ 2,048 chars).
// Sections are ordered most-important-first so that if the cap fires,
// only the least semantically important content (graph edges) is lost:
//
//   1. Identity          — always present; the primary signal
//   2. Genesis event     — founding context; never lost with LIMIT 1 query
//   3. Temporal span     — first/last seen dates + event count
//   4. Recent events     — recency signal (up to 3 events)
//   5. Related entities  — graph edges (up to 3 edges)  ← first to be cut
```

#### 3. `vendor/embed/src/provider/cohere.ts` — add `truncate: "NONE"` (Phase 2 prep comment)

> **Note**: The actual `truncate: "NONE"` change is in Phase 2. In Phase 1 only, add a TODO
> comment inside the SDK call so reviewers can see the upcoming change is intentional:

```ts
const response = await this.client.embed({
  texts,
  model: this.model,
  inputType: this.inputType,
  embeddingTypes: ["float"],
  // truncate: "NONE" will be added in Phase 2 once all callers are within
  // the 512-token budget. Without it, Cohere silently truncates from "END".
});
```

### Success Criteria

#### Automated Verification
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`

#### Manual Verification
- [ ] Trigger a test entity embed Inngest run (e.g. via dev tools or backfill) and confirm
  the function completes successfully
- [ ] Confirm the entity vector appears in Pinecone with correct `narrativeHash` and `snippet`
  metadata
- [ ] Confirm no Sentry errors from the `embed-narrative` step

**Pause here for manual verification before proceeding to Phase 2.**

---

## Phase 2: Surface Errors Explicitly

### Overview

Add `truncate: "NONE"` to the Cohere SDK call in the vendor embed provider. Now that Phase 1
ensures all narratives are within budget, any over-budget text becomes an explicit Inngest error
(surfaced in Sentry and eligible for retry) rather than a silent data loss.

### Changes Required

#### 1. `vendor/embed/src/provider/cohere.ts` — add `truncate: "NONE"`

**File**: `vendor/embed/src/provider/cohere.ts`

Remove the Phase 1 TODO comment. Replace the SDK call with:

```ts
const response = await this.client.embed({
  texts,
  model: this.model,
  inputType: this.inputType,
  embeddingTypes: ["float"],
  // truncate: "NONE" — surface an error if any text exceeds the model's
  // 512-token context window instead of silently discarding from the tail.
  //
  // The default Cohere behaviour when this field is omitted is "END":
  // tokens beyond the limit are silently cut from the end of the input,
  // returning a valid embedding with no error or warning.
  //
  // All callers in this codebase apply a NARRATIVE_CHAR_CAP (1,800 chars ≈
  // 450 tokens) before reaching this point. If "NONE" ever throws, it means
  // a caller bypassed the cap or Section 1 of the narrative (entity.value)
  // grew unexpectedly long — both are conditions worth surfacing.
  truncate: "NONE",
});
```

### Success Criteria

#### Automated Verification
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check` (vendor/ excluded by design)

#### Manual Verification
- [ ] Trigger a test entity embed Inngest run and confirm the function completes successfully
  (no `truncate: "NONE"` errors in Inngest or Sentry)
- [ ] Optionally: synthesise a deliberately over-long narrative (> 1,800 chars) in a dev
  Inngest run to confirm the error from `truncate: "NONE"` appears in Inngest as a non-silent,
  retriable failure

---

## Testing Strategy

### Unit Tests
No unit tests exist today for `narrative-builder.ts`, `entity-embed.ts`, or `cohere.ts`.
These are candidates for future test coverage but are out of scope for this plan.

### Manual Testing Steps
1. Start `pnpm dev:console` (or ensure Inngest dev server is running)
2. Trigger an `apps-console/entity.graphed` event for a real entity
3. Confirm the `entity.embed` Inngest function runs to completion
4. In Pinecone (or via `pnpm db:studio`), verify the entity vector exists with correct metadata
5. (Phase 2 only) Confirm no `truncate` errors appear in Sentry or Inngest logs

---

## References

- Research doc: `thoughts/shared/research/2026-03-14-entity-embed-chunking-analysis.md`
- Cohere SDK truncation: `node_modules/.pnpm/cohere-ai@7.20.0/.../EmbedRequest.d.ts:43-49`
- Narrative builder: `api/console/src/inngest/workflow/neural/narrative-builder.ts`
- Entity embed: `api/console/src/inngest/workflow/neural/entity-embed.ts`
- Cohere vendor provider: `vendor/embed/src/provider/cohere.ts:111-116`
