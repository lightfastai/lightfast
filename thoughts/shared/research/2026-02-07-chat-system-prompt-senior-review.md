---
date: 2026-02-07
reviewer: senior-reviewer
topic: "Chat Agent System Prompt Redesign — Senior Review"
tags: [review, architecture, system-prompt, approval]
status: approved
documents_reviewed:
  - 2026-02-07-chat-system-prompt-codebase-deep-dive.md
  - 2026-02-07-chat-system-prompt-external-research.md
  - 2026-02-07-chat-system-prompt-architecture-design.md
verdict: APPROVED
---

# Senior Review: Chat Agent System Prompt Redesign

## Verdict: APPROVED

The architecture design is well-grounded, appropriately scoped, and consistent with the existing codebase patterns. The actual implementation (already present in the codebase as untracked files) demonstrates the design is feasible and has been refined beyond the original spec in positive ways.

---

## Review Methodology

Reviewed all three research documents, then verified against the actual codebase by reading:
- `apps/chat/src/ai/prompts/builders/system-prompt-builder.ts` — existing builder (unchanged)
- `apps/chat/src/ai/prompts/builders/prompt-builder.ts` — new composable builder (implemented)
- `apps/chat/src/ai/prompts/builders/standard-providers.ts` — section provider set (implemented)
- `apps/chat/src/ai/prompts/types.ts` — core types with `PromptFeatureFlags` (implemented)
- `apps/chat/src/ai/prompts/context.ts` — context bridge function (implemented)
- `apps/chat/src/ai/prompts/index.ts` — barrel exports preserving backward compat (implemented)
- `apps/chat/src/ai/prompts/sections/*.ts` — all 9 section providers (implemented)
- `core/ai-sdk/src/core/primitives/agent.ts` — Agent class (unchanged, compatible)
- `core/ai-sdk/src/core/primitives/tool.ts` — Tool factory (unchanged, compatible)
- `apps/chat/src/app/(chat)/(ai)/api/v/[...v]/route.ts` — route handler (unchanged)
- `apps/chat/src/app/(chat)/(ai)/api/v/[...v]/_lib/route-policies.ts` — guard pipeline (unchanged)

---

## Checklist Results

- [x] **Feasible given actual codebase state** — Implementation already exists and matches the architecture. The `PromptSection` / `SectionProvider` / `buildPrompt()` chain integrates cleanly with the existing `createAgent({ system: string })` pattern.
- [x] **Follows existing patterns** — No new packages. All code in `apps/chat/src/ai/prompts/`. Guard enrichment pattern preserved. Vendor abstractions untouched. `workspace:*` protocol respected.
- [x] **Appropriately engineered** — The composable builder is the minimum viable abstraction. `PromptFeatureFlags` with sensible defaults gate Phase 2/3 sections without premature complexity.
- [x] **Edge cases and failure modes addressed** — Section providers return `null` to skip. `try/catch` wraps each provider in `buildPrompt()`. Token budget overflow handled by priority-based trimming. Missing resources produce functional minimal prompt via defensive defaults.
- [x] **Security model consistent** — Prompt builder only reads guard-enriched data. No direct DB access. Security section is `critical` priority (never trimmed). Anonymous users get minimal context. User context comes from trusted DB, not user input. Style validated via Zod enum.
- [x] **External API limitations accounted for** — Model-specific token budgets in `MODEL_TOKEN_BUDGETS`. Gateway routing preserved. No model-specific prompt formatting (correctly deferred).
- [x] **File/package structure consistent** — `sections/` for providers, `builders/` for composition, barrel `index.ts` with legacy exports. Clean, discoverable layout.
- [x] **Integration points complete** — Guard pipeline -> `buildPromptContext()` -> `buildPrompt(context, STANDARD_PROVIDERS)` -> `createAgent({ system: prompt })`. No gaps.
- [x] **Scope appropriate** — Focused on chat prompt system. Console alignment, memory windowing, cross-app data bridge all explicitly deferred.
- [x] **Model selection well-justified** — Keeps Gemini 2.5 Flash as default (10x cheaper than Claude Sonnet). Upgrade path through billing tiers. No forced migration.
- [x] **Temporal memory practical** — Phase 1: `currentTimestamp` only, gated by `features.temporalContext: false` default. Expansion interfaces defined but dormant.
- [x] **Per-tool prompts specific** — `TOOL_GUIDANCE` record with `whenToUse` and `howToUse` per tool. Only renders for active tools. Future workspace tools pre-defined in architecture doc but correctly omitted from implementation.
- [x] **Communication style simple** — 4-style Zod enum. Static string lookup. Default `"formal"`. Adding a style = 1 enum entry + 1 string.
- [x] **Token budgeting realistic** — Conservative defaults (4K base, 8K for Gemini). Rough estimates via `estimateTokens()` are sufficient for current prompt sizes (~700 tokens total).
- [x] **Migration path feasible** — Legacy `buildSystemPrompt()`, `buildAnonymousSystemPrompt()`, etc. all preserved as exports. Existing evals continue to work unchanged.

---

## Strengths

1. **`PromptFeatureFlags` is a smart refinement over the architecture doc.** The architecture doc proposed optional fields on `PromptContext`; the implementation added explicit feature flags with defaults (`temporalContext: false`, `userContext: false`, `style: true`, `toolGuidance: true`). This is better — it decouples "is the data available" from "should we render the section," enabling feature-flag-based rollout and A/B testing.

2. **Simplified `PromptContext.model`** compared to the architecture doc. The doc proposed `model.features: { thinking, vision, functionCalling }` which doesn't match the actual `ChatRouteResources` shape. The implementation correctly simplified to `model: { id, provider, maxOutputTokens }` — only fields that actually exist and are used.

3. **`buildPromptContext()` accepts flat options** rather than consuming `ChatRouteResources` directly. This decouples the prompt builder from the route handler's internal types, making it testable in isolation. Good engineering.

4. **Error handling is genuinely non-blocking.** The `try/catch` in `buildPrompt()` (line 36-41 of `prompt-builder.ts`) silently skips failed section providers. This means a bug in one section (e.g., `userContextSection` throws due to malformed data) doesn't break the entire prompt.

5. **Backward compatibility is real, not theoretical.** The `index.ts` barrel file exports both new (`buildPrompt`, `STANDARD_PROVIDERS`, `buildPromptContext`) and legacy (`buildSystemPrompt`, `buildAnonymousSystemPrompt`, etc.) APIs. Evals using the old APIs won't break.

---

## Minor Notes (Non-Blocking)

1. **Architecture doc diverges from implementation on `PromptContext` shape.** The doc shows `model.features`, `style` as top-level (not feature-gated), and a separate `temporal.ts` file. The implementation consolidated types into `types.ts` with `PromptFeatureFlags`. The doc should be updated to reflect the refined implementation, but this doesn't block anything.

2. **`estimateTokens()` returns static values** (e.g., identity = 80, core-behavior = 200). When user context and temporal context become dynamic (Phase 2), these should scale with content. A simple heuristic: `Math.ceil(renderedContent.length / 4)` after rendering, or render-then-measure rather than estimate-then-render. Worth revisiting when token budget pressure becomes real.

3. **Temporal context section is minimal.** Only `currentTimestamp` is rendered. The architecture doc's richer vision (recent activity summary, active alerts, recent topics) is properly gated behind `features.temporalContext: false`. The interfaces exist (`TemporalContext`) but are intentionally thin for v1. This is correct.

4. **`STANDARD_PROVIDERS` includes null-returning sections.** `temporalContextSection` and `userContextSection` are in the array but return `null` when their feature flags are off. This is harmless (the builder filters nulls) and actually preferable — it documents the intended section order and makes Phase 2 activation trivial (flip a flag).

5. **No new evals for the new sections.** The architecture doc correctly identifies that identity adherence, tool guidance effectiveness, and style adherence evals should be added. This is implementation-phase work, not a design gap.

6. **Console Answer agent alignment** (Phase 3) should consider extracting the core builder into a shared package (`@repo/ai-prompt-builder` or similar) rather than duplicating the pattern. The architecture doc mentions this — just flagging it as an important Phase 3 consideration.

---

## Summary

The architecture is solid. The implementation already exists and demonstrates the design works in practice. The composable prompt builder is the right abstraction — simple enough to understand immediately, extensible enough for the planned Phase 2/3 evolution. The phased migration strategy eliminates risk. The feature flag mechanism enables gradual rollout.

**Proceed to implementation plan.**
