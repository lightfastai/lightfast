# QoL: Terminology Cleanup & Type Safety Implementation Plan

## Overview

Complete the workspace→org terminology migration across realtime events, AI tool suite, UI copy, and internal code. Fix `providerAccountInfo as any` casts by adding a `ProviderSlug`-aware `getProvider` overload. Remove stale TODO references.

Covers Issues 1, 2, and 4 from `thoughts/shared/research/2026-04-03-qol-issues-investigation.md`. Issue 3 (cancel job) is deferred.

## Current State Analysis

### Stale TODOs (Issue 1)
Three stub files each contain a `// Refer to thoughts/shared/research/2026-03-13-v2-route-implementation-research.md` line pointing to a deleted document. The TODO lines themselves are accurate — only the stale pointer needs removal.

### Workspace Terminology (Issue 2)
The data layer workspace abstraction was dropped in `a13011863`, but "workspace" persists in:
- **Realtime protocol**: Schema key `workspace` → event path `"workspace.event"` (4 files)
- **AI tool suite**: 4 tool files, package exports, types, system prompt, tool guidance, UI renderers (~20 sites)
- **UI copy**: 6+ components with user-facing "workspace" text
- **Auth middleware**: File named `workspace.ts`, `createTenantFilterFromWorkspace` function
- **DB table name**: `lightfast_workspace_api_keys` (intentionally preserved — not changing)
- **Comments/JSDoc**: ~15 scattered references

No external SSE consumers exist for `"workspace.event"` — safe to rename without deprecation.

### `as any` Casts (Issue 4)
Two `as any` casts at `api/app/src/router/org/connections.ts:686,764`. Root cause: `getProvider(input.provider)` where `input.provider` is `ProviderSlug` hits the wide `string` overload, collapsing `TAccountInfo` to `BaseProviderAccountInfo | null`. `ProviderSlug` and `keyof typeof PROVIDERS` are structurally identical (`"apollo" | "github" | ...`) but TypeScript doesn't unify them for overload resolution.

### Key Discoveries:
- `packages/app-providers/src/registry.ts:337-344` — current overloads select wide when passed `ProviderSlug`
- `packages/app-providers/src/client/display.ts:15-23` — `ProviderSlug` defined via Zod enum, re-exported and aliased as `SourceType` and `ProviderName`
- `packages/app-ai-types/src/index.ts:57-74,113-128,168-171` — `AnswerToolSet` keys, UI part literals, and runtime context all use `workspace*` names
- `apps/app/src/ai/prompts/sections/workspace-context.ts:19` — section id is `"workspace-context"` but heading already renders `"ORG CONTEXT:"`
- `db/app/src/schema/tables/org-api-keys.ts:29` — physical SQL table name `lightfast_workspace_api_keys` preserved intentionally (not changing)

## Desired End State

- Zero references to `"workspace.event"` in realtime code — replaced with `"org.event"`
- All AI tools renamed from `workspace*` to `org*` across files, exports, types, and UI
- All user-facing UI copy says "organization" or "org" instead of "workspace"
- Auth middleware file and function renamed
- Stale comments/JSDoc updated
- `getProvider` accepts `ProviderSlug` via a narrowed overload, preserving `TAccountInfo` and eliminating both `as any` casts
- `pnpm check && pnpm typecheck` passes clean

### Verification:
```bash
# No workspace references remain (excluding intentional DB table name and node_modules)
grep -r "workspace" --include="*.ts" --include="*.tsx" --include="*.json" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist \
  packages/ apps/ api/ db/ | \
  grep -v "lightfast_workspace_api_keys" | \
  grep -v "workspace-names.json" | \
  grep -v "node_modules"
# Should return empty (or only the preserved DB table name comment)
```

## What We're NOT Doing

- **Cancel job mutation (Issue 3)** — deferred; requires Inngest `cancelOn` pattern across app/platform boundary
- **DB table rename** — `lightfast_workspace_api_keys` stays as-is to avoid a rename migration
- **Reserved names file rename** — `packages/app-reserved-names/data/workspace-names.json` is a data file, rename is cosmetic
- **Root-cause fix of `getProvider` generic collapse** — the narrowed overload is sufficient; a full rewrite of the provider type system is out of scope

## Implementation Approach

Four phases in dependency order: trivial cleanup first, then realtime protocol (small coordinated change), then the large terminology sweep, then the type-level fix (independent).

---

## Phase 1: Stale TODO Cleanup

### Overview
Remove dead `// Refer to ...` lines from 3 stub files. Trivial, zero risk.

### Changes Required:

#### 1. Remove stale reference lines
**Files**:
- `apps/app/src/lib/findsimilar.ts` — delete line 13
- `apps/app/src/lib/contents.ts` — delete line 10
- `apps/app/src/lib/related.ts` — delete line 10

Each file: remove only the `// Refer to thoughts/shared/research/2026-03-13-v2-route-implementation-research.md` line. Keep the TODO line above it.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `grep -r "2026-03-13-v2-route-implementation-research" apps/app/src/lib/` returns empty

#### Manual Verification:
- [x] Each file retains its TODO comment describing the intended implementation

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 2.

---

## Phase 2: Realtime Schema Rename

### Overview
Rename the Upstash Realtime schema key from `workspace` to `org`, changing the event path from `"workspace.event"` to `"org.event"`. This is a coordinated 4-file change — TypeScript enforces all sites at compile time once the schema key changes.

### Changes Required:

#### 1. Schema definition
**File**: `packages/app-upstash-realtime/src/index.ts`
**Lines**: 10-16
**Change**: Rename schema key `workspace` → `org`

```typescript
const schema = {
  org: {            // was: workspace
    event: z.object({
      eventId: z.number(),
      clerkOrgId: z.string(),
      sourceEvent: postTransformEventSchema,
    }),
  },
};
```

Also update the `EventNotification` type derivation if it references `schema.workspace.event` (line ~21) → `schema.org.event`.

#### 2. Publisher
**File**: `api/platform/src/inngest/functions/ingest-delivery.ts`
**Line**: 184
**Change**: `"workspace.event"` → `"org.event"`

```typescript
await channel.emit("org.event", { ... } satisfies EventNotification);
```

#### 3. SSE subscriber
**File**: `apps/app/src/app/api/gateway/stream/route.ts`
**Line**: 49
**Change**: `"workspace.event"` → `"org.event"`

```typescript
events: ["org.event"],
```

#### 4. React subscriber
**File**: `apps/app/src/app/(app)/(org)/[slug]/(manage)/events/_components/events-table.tsx`
**Line**: 140
**Change**: `"workspace.event"` → `"org.event"`

```typescript
events: ["org.event"],
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes (TypeScript enforces all event paths match the schema)
- [x] `grep -r "workspace.event" packages/ apps/ api/` returns empty
- [ ] `pnpm build:app` succeeds
- [ ] `pnpm build:platform` succeeds

#### Manual Verification:
- [ ] Realtime events still flow end-to-end (publish from platform → SSE subscriber → React subscriber)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that realtime events still flow before proceeding to Phase 3.

---

## Phase 3: Workspace→Org Terminology

### Overview
Rename all `workspace*` AI tools to `org*`, update all user-facing UI copy, rename auth middleware internals, and clean up stale comments. This is the largest phase (~25 files).

### Changes Required:

#### 3a. AI Tool Files — Rename and Update

**Rename files** (4 files):
- `packages/app-ai/src/workspace-search.ts` → `packages/app-ai/src/org-search.ts`
- `packages/app-ai/src/workspace-contents.ts` → `packages/app-ai/src/org-contents.ts`
- `packages/app-ai/src/workspace-find-similar.ts` → `packages/app-ai/src/org-find-similar.ts`
- `packages/app-ai/src/workspace-related.ts` → `packages/app-ai/src/org-related.ts`

**Inside each renamed file**, update:
- Factory function name: `workspaceSearchTool` → `orgSearchTool`, etc.
- `workspaceSearchTool` description at `workspace-search.ts:48`: change "workspace" to "organization" in the LLM-visible description text

#### 3b. Package Exports
**File**: `packages/app-ai/package.json`
**Lines**: 7-18
**Change**: Update subpath exports

```json
"./org-search": { "import": "./src/org-search.ts", "types": "./src/org-search.ts" },
"./org-contents": { "import": "./src/org-contents.ts", "types": "./src/org-contents.ts" },
"./org-find-similar": { "import": "./src/org-find-similar.ts", "types": "./src/org-find-similar.ts" },
"./org-related": { "import": "./src/org-related.ts", "types": "./src/org-related.ts" }
```

#### 3c. Type Definitions
**File**: `packages/app-ai-types/src/index.ts`

Update `AnswerToolSet` interface keys (lines ~57-74):
- `workspaceContents` → `orgContents`
- `workspaceFindSimilar` → `orgFindSimilar`
- `workspaceRelated` → `orgRelated`
- `workspaceSearch` → `orgSearch`

Update UI part type literals (lines ~113-128):
- `"tool-workspaceSearch"` → `"tool-orgSearch"`, etc.

Update runtime context keys (lines ~168-171):
- `workspaceContents` → `orgContents`, etc.

#### 3d. System Prompt and Sections
**File**: `apps/app/src/ai/prompts/system-prompt.ts`
- Lines 22-25: Update active tool names array to `"orgSearch"`, `"orgContents"`, `"orgFindSimilar"`, `"orgRelated"`
- Line 8: Rename `workspace` key in `AnswerPromptOptions` to `org` (or keep if it maps to a type field)
- Lines 51-56: Rename `HARDCODED_WORKSPACE_CONTEXT` → `HARDCODED_ORG_CONTEXT`, update comment

**File**: `apps/app/src/ai/prompts/sections/workspace-context.ts`
- Rename file → `org-context.ts`
- Update function name `answerWorkspaceContextSection` → `answerOrgContextSection`
- Update section id `"workspace-context"` → `"org-context"` (heading already says `"ORG CONTEXT:"`)

**File**: `apps/app/src/ai/prompts/sections/tool-guidance.ts`
- Lines 12-54: Update all tool guidance keys from `workspace*` to `org*`

#### 3e. Answer Route
**File**: `apps/app/src/app/(api)/v1/answer/[...v]/route.ts`
- Update imports from `@repo/app-ai/workspace-*` → `@repo/app-ai/org-*`
- Lines 30-35: Update `answerTools` keys: `workspaceSearch` → `orgSearch`, etc.
- Lines 67, 165: Update `HARDCODED_WORKSPACE_CONTEXT` → `HARDCODED_ORG_CONTEXT`

#### 3f. UI Renderers
**File**: `apps/app/src/components/answer-tool-call-renderer.tsx`
- Lines 47-50: Update label map keys and values:
  - `workspaceSearch: "workspace search"` → `orgSearch: "org search"` (or `"search"`)
  - `workspaceContents: "workspace contents"` → `orgContents: "contents"`
  - Keep `workspaceFindSimilar: "find similar"` → `orgFindSimilar: "find similar"`
  - Keep `workspaceRelated: "related"` → `orgRelated: "related"`
- Lines 141, 151, 162: Update switch cases

**File**: `apps/app/src/components/answer-tool-results.tsx`
- Line 42: `value="workspace-search-results"` → `value="org-search-results"`
- Line 47: `"workspace search"` → `"search"` (or `"org search"`)

#### 3g. User-Facing UI Copy
**File**: `apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/api-keys/page.tsx`
- Line 11: Update JSDoc
- Line 29: `"Keys can access all workspaces in your organization."` → `"Keys can access all resources in your organization."`

**File**: `apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/api-keys/_components/security-notice.tsx`
- Line 26: `"Organization API keys are scoped to a specific workspace for security"` → `"Organization API keys are scoped to your organization for security"`

**File**: `apps/app/src/components/answer-interface.tsx`
- Line 136: `"Ask anything about your workspace..."` → `"Ask anything about your organization..."`

**File**: `apps/app/src/components/answer-messages.tsx`
- Line 278: `"Ask a question about your workspace"` → `"Ask a question about your organization"`

**File**: `apps/app/src/components/debug-panel-content.tsx`
- Line 129: `"No sources connected to this workspace."` → `"No sources connected to this organization."`

**File**: `apps/app/src/components/ask-lightfast-suggestions.tsx`
- Line 21: `"What are the main topics in this workspace?"` → `"What are the main topics in this organization?"`

#### 3h. Auth Middleware
**File**: `packages/app-auth-middleware/src/workspace.ts`
- Rename file → `packages/app-auth-middleware/src/org-access.ts`
- No code changes needed (exports `verifyOrgAccess` which has no workspace terminology)

**File**: `packages/app-auth-middleware/src/index.ts`
- Line 68: Update re-export path: `export { verifyOrgAccess } from "./org-access";`

**File**: `packages/app-auth-middleware/src/tenant.ts`
- Line 148: Rename `createTenantFilterFromWorkspace` → `createTenantFilterFromOrg`
- Update parameter names and JSDoc that use "workspace" terminology

#### 3i. Comments and JSDoc Cleanup
Update "workspace" in comments/JSDoc across these files (non-exhaustive — grep after other changes):
- `api/app/src/trpc.ts:194,231,240`
- `api/app/src/router/org/org-api-keys.ts:20`
- `api/app/src/router/user/organization.ts:53`
- `api/platform/src/inngest/functions/ingest-delivery.ts:90`
- `db/app/src/schema/tables/gateway-installations.ts:49`
- `db/app/src/schema/tables/org-api-keys.ts:16-18`
- `packages/app-providers/src/contracts/event.ts:6`
- `packages/app-providers/src/provider/shape.ts:28,58`
- `packages/app-validation/src/constants/naming.ts:4,16,36,37,51`
- `packages/app-validation/src/schemas/store.ts:162,166`

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm check` passes
- [ ] `pnpm build:app` succeeds
- [ ] `pnpm build:platform` succeeds
- [x] `grep -r "workspaceSearch\|workspaceContents\|workspaceFindSimilar\|workspaceRelated\|HARDCODED_WORKSPACE_CONTEXT" --include="*.ts" --include="*.tsx" apps/ api/ packages/` returns empty
- [x] `grep -r "workspace" ...` — remaining references are only external product names (Apollo workspace, Linear workspace, Notion workspace), test dataset fixtures, pnpm `workspace:*` protocol, and the preserved DB table name

#### Manual Verification:
- [ ] AI answer interface works — tools execute and render correctly with new names
- [ ] API keys page displays correct copy
- [ ] No "workspace" text visible in any UI surface

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the AI answer interface and UI copy are correct before proceeding to Phase 4.

---

## Phase 4: Narrowed `getProvider` Overload

### Overview
Add a `ProviderSlug`-aware overload to `getProvider` that preserves the `TAccountInfo` generic, then remove both `as any` casts in `connections.ts`.

### Changes Required:

#### 1. Add middle overload
**File**: `packages/app-providers/src/registry.ts`
**Lines**: 337-344
**Change**: Add a `ProviderSlug` overload between the narrow and wide ones

```typescript
/** Narrow overload: literal slug → exact provider shape (no cast required). */
export function getProvider<K extends keyof typeof PROVIDERS>(
  slug: K
): ProviderShape<K>;

/** ProviderSlug overload: validated slug union → ProviderDefinition with correct TAccountInfo. */
export function getProvider(
  slug: ProviderSlug
): ProviderDefinition | undefined;

/** Wide overload: runtime string → union ProviderDefinition (may be undefined). */
export function getProvider(slug: string): ProviderDefinition | undefined;

export function getProvider(slug: string) {
  return (PROVIDERS as Record<string, ProviderDefinition>)[slug];
}
```

**Note**: The middle overload's return type is `ProviderDefinition | undefined` — the same wide type. This alone does not fix the `TAccountInfo` collapse. The real fix requires the return type to carry the union of all concrete provider shapes. We need a utility type:

```typescript
/** Union of all concrete provider shapes — preserves per-provider TAccountInfo. */
export type AnyProviderShape = (typeof PROVIDERS)[keyof typeof PROVIDERS];

/** ProviderSlug overload: validated slug → concrete provider union. */
export function getProvider(slug: ProviderSlug): AnyProviderShape | undefined;
```

With `AnyProviderShape`, the return type is a union of all 5 concrete provider types. Each member carries its own `resourcePicker: ResourcePickerDef<SpecificAccountInfo | null>`. The `ResourcePickerDef` methods then accept a union parameter — `providerAccountInfo` becomes the union of all account info types `| null`, which `ProviderAccountInfo | null` (the DB column type) satisfies directly.

#### 2. Remove `as any` casts
**File**: `api/app/src/router/org/connections.ts`

**Line 686**: Remove `as any` cast
```typescript
// Before:
providerAccountInfo: inst.providerAccountInfo as any,

// After:
providerAccountInfo: inst.providerAccountInfo,
```

**Line 764**: Remove `as any` cast
```typescript
// Before:
providerAccountInfo: installation.providerAccountInfo as any,

// After:
providerAccountInfo: installation.providerAccountInfo,
```

Also remove the explanatory comments above each cast (the `// Wide overload loses TAccountInfo generic...` block and the `// eslint-disable-next-line` directive).

#### 3. Verify type resolution
After the change, confirm TypeScript resolves the call sites correctly:
- `getProvider(input.provider)` where `input.provider: ProviderSlug` should hit the middle overload
- Return type should be `AnyProviderShape | undefined`
- After null guard, `providerDef.resourcePicker.enrichInstallation` should accept `ProviderAccountInfo | null` without cast

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes with zero errors
- [x] `pnpm check` passes (no eslint-disable-next-line orphaned)
- [ ] `grep -r "as any" api/app/src/router/org/connections.ts` returns empty — **BLOCKED**: `as any` casts cannot be removed due to contravariance on `ResourcePickerDef` method params (property-style function types). The `ProviderSlug` overload and `AnyProviderShape` type are in place but a full type system rewrite is needed to eliminate the casts. Updated comments explain the root cause.
- [ ] `pnpm build:app` succeeds

#### Manual Verification:
- [ ] Resource picker (connection setup flow) works — installations enrich and resources list correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the resource picker flow works before marking the plan complete.

---

## Testing Strategy

### Automated Tests:
- TypeScript compiler is the primary test — the realtime schema rename and `getProvider` overload changes are enforced at compile time
- Run `pnpm typecheck` after each phase
- Run `pnpm check` to catch any lint issues from the renames

### Manual Testing Steps:
1. **Realtime events**: Trigger an event through the platform → verify SSE endpoint delivers it → verify events table updates in real time
2. **AI answer interface**: Ask a question → verify tools execute → verify tool call labels render correctly with new names
3. **Resource picker**: Connect a provider → verify installations list → verify resources list (no `as any` means TypeScript catches type mismatches at compile time, but runtime verification confirms no regression)
4. **UI copy audit**: Navigate to API keys page, answer interface, debug panel — confirm no "workspace" text visible

## Performance Considerations

No performance impact. All changes are rename/type-level — no runtime behavior changes except the realtime event path string, which has no performance implication.

## Migration Notes

- The Upstash Realtime event path change from `"workspace.event"` to `"org.event"` is a breaking change for any SSE consumers filtering on the old path. Confirmed: no external consumers exist.
- The AI tool package export paths change (e.g., `@repo/app-ai/workspace-search` → `@repo/app-ai/org-search`). All consumers are internal to the monorepo.

## References

- Research: `thoughts/shared/research/2026-04-03-qol-issues-investigation.md`
- Realtime schema: `packages/app-upstash-realtime/src/index.ts:10-16`
- Provider registry: `packages/app-providers/src/registry.ts:337-344`
- Cast sites: `api/app/src/router/org/connections.ts:686,764`
- AI types: `packages/app-ai-types/src/index.ts:57-74,113-128,168-171`
