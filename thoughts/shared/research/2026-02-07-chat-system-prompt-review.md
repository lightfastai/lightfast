---
date: 2026-02-07
reviewer: senior-dev
topic: "Chat Agent System Prompt Redesign — Senior Review"
tags: [review, architecture, system-prompt]
status: complete
verdict: APPROVED
---

# Senior Review: Chat Agent System Prompt Architecture Design

## Verdict: APPROVED

### Summary

The architecture design is well-grounded in the actual codebase, proposes changes with appropriate scope, and follows existing monorepo conventions. The composable `PromptSection` / `SectionProvider` pattern is a clean evolution of the current `buildSystemPrompt()` approach that preserves backward compatibility while enabling incremental enrichment. The 3-phase migration is realistic.

### Strengths

1. **Faithful to actual codebase state**: The architect correctly identified all 6 injection points in the agent creation flow, accurately described the guard enrichment pattern in `route-policies.ts`, and properly mapped the `ChatRouteResources` → prompt builder data flow. I verified every file reference against the actual codebase — they check out.

2. **No new packages**: All new code stays in `apps/chat/src/ai/prompts/`, consistent with the existing separation of concerns (`prompts/`, `providers/`, `runtime/`). This avoids monorepo churn and dependency graph complexity.

3. **Backward compatibility via thin wrapper**: The existing `buildSystemPrompt(options: SystemPromptOptions)` function preserved as a wrapper means the 10 eval files (`apps/chat/src/eval/*.eval.ts`) and the route handler continue working unchanged during Phase 1.

4. **Guard pipeline integration is clean**: The design correctly consumes `ChatRouteResources` post-guard-evaluation rather than adding a new guard. The prompt builder is a pure function of enriched resources — no side effects, no mutations.

5. **Memory interface untouched**: Temporal context is built separately and injected into `PromptContext`, not bolted onto the `Memory<TMessage, TContext>` interface. This is the right call — the Memory interface is shared across `core/ai-sdk` and shouldn't know about prompt concerns.

6. **Per-tool guidance complements (not replaces) tool schemas**: The design correctly notes that `createTool()` descriptions are set at definition time and cannot be dynamically adjusted. System prompt guidance fills this gap without touching the tool factory pattern.

7. **Model recommendation is pragmatic**: Keeping `google/gemini-2.5-flash` as default rather than switching to Claude Sonnet (despite the external research recommending Claude) is the right call given it's already the default, is anonymous-accessible, cheapest, and has 1M token context. The design says "optimize later with eval data" — correct approach.

### Minor Notes (Non-blocking)

1. **Token estimation accuracy**: The `estimateTokens()` method uses hardcoded estimates (e.g., `() => 80` for identity, `() => 200` for core behavior). These are rough approximations. The architecture acknowledges this in Open Question #2 and recommends starting with estimates. This is fine for Phase 1, but for Phase 2+ when user context and temporal context add variable-length content, consider a simple `Math.ceil(content.length / 4)` heuristic (average ~4 chars/token) applied post-render rather than pre-render. This would be more accurate for dynamic sections without needing a tokenizer dependency.

2. **`PromptContext.billing.limits` typed as `Record<string, unknown>`**: The actual `PlanLimits` type from `route-policies.ts` has specific shape (`allowedModels`, `hasWebSearch`, `hasAttachments`, etc.). The loose typing here means section providers can't safely access billing features without casting. Consider using the actual `PlanLimits` type or at minimum `{ hasWebSearch: boolean; hasAttachments: boolean; allowedModels: string[] }` for the fields sections actually need. Low priority since only the `capabilitiesSection` currently uses billing data.

3. **`buildPromptContextFromLegacyOptions` referenced but not defined**: The backward-compat wrapper in the migration section references `buildPromptContextFromLegacyOptions(options)` but the function isn't defined in the design. This is straightforward to implement (map `SystemPromptOptions` booleans to a `PromptContext` with defaults), but should be explicitly noted in the implementation spec.

4. **Style default "formal" for a chat app**: The external research correctly identifies developer tool voice patterns (Claude Code = "direct, concise"; Cursor = "terse, action-oriented"). A chat interface for developers might default better to `"concise"` or `"technical"` than `"formal"`. This is a product decision, not an architecture issue — easy to change later.

5. **No `try/catch` in `buildPrompt()` around `provider(context)`**: The design mentions in the Error Handling section that providers that throw should be caught with a warning log, but the actual `buildPrompt()` code shown doesn't include this wrapping. The implementation should add it.

6. **Workspace search tools in `TOOL_GUIDANCE`**: The design includes guidance entries for `workspaceSearch`, `workspaceContents`, `workspaceGraph`, `workspaceFindSimilar`, and `workspaceRelated` — but these tools don't exist in `apps/chat`. They're console-only tools. The `toolGuidanceSection` already filters by `ctx.activeTools` so these entries are dead code that won't render. Not harmful, but could confuse future developers. Consider adding a comment or moving them to a separate console-specific guidance map.

7. **Phase 2 `fetchUserContext` cross-app data access**: The design correctly identifies the cross-app barrier (chat can't query `@db/console`). However, the `fetchUserContext` function shown in Phase 2 doesn't specify where workspace data comes from. The codebase deep dive listed 3 options (API bridge, shared service layer, pre-computed context). The architecture should recommend one, even tentatively — I'd suggest pre-computed context via Inngest (summarize workspace state periodically, store in Redis, chat reads from Redis) as it avoids adding a synchronous cross-app dependency on the hot path.

### Codebase Verification Results

| Claim | Verified | Notes |
|-------|----------|-------|
| `buildSystemPrompt()` at `system-prompt-builder.ts:44-96` | Yes | Function signature and section composition match |
| `createAgent` accepts `system: string` | Yes | `agent.ts:132` stores it in `lightfastConfig.system` |
| Guard pipeline enriches `resources` via mutation | Yes | `policy-engine.ts:49` does `Object.assign(context.resources, result.resources)` |
| `getActiveToolsForUser` returns tool name array | Yes | `user-utils.ts:21-41` returns `(keyof typeof c010Tools)[]` |
| `c010Tools` has only `webSearch` and `createDocument` | Yes | `tools.ts:17-20` |
| Memory interface has no temporal query API | Yes | `memory/index.ts` only has message/session/stream operations |
| Console answer agent uses `HARDCODED_WORKSPACE_CONTEXT` | Yes | `system-prompt.ts:29-33` and used at `route.ts:78,240` |
| V2 agent also accepts `systemPrompt: string` | Yes | `v2/agent.ts` uses string-based system prompt |
| 10 eval files exist in `apps/chat/src/eval/` | Yes | Confirmed 10 `.eval.ts` files + 1 tools file |
| All active models route through gateway | Yes | `providers/models/active.ts` all have `provider: "gateway"` |

### Architecture Assessment

| Criterion | Rating | Comment |
|-----------|--------|---------|
| Feasibility given codebase state | Strong | All integration points verified |
| Follows existing patterns | Strong | Guard enrichment → pure function → agent creation |
| Over/under-engineered | Appropriate | Composable sections without framework overhead |
| Edge cases addressed | Good | Null providers, token budget overflow, missing resources |
| Security model consistent | Strong | Auth boundaries preserved, no user input in system prompt |
| File/package structure | Consistent | All in `apps/chat/src/ai/prompts/`, no new packages |
| Model recommendation | Pragmatic | Keep default, optimize later with data |
| Temporal memory integration | Realistic | Separate from Memory interface, phases incrementally |
| User context pipeline | Safe | Parallel fetch with catch, non-blocking |
| Communication style system | Clean | Zod enum, simple map, easy to extend |
| Migration path | Feasible | 3 phases, backward compat, feature flaggable |
| Scope | Appropriate | Focused on prompt builder, doesn't try to solve cross-app data bridge |
